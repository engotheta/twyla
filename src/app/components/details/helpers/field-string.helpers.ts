import { ModifierProps } from '../interfaces/details.interface';
import { mergeClasses } from '@utils/class-name.helpers';
import { deepClone } from '@utils/object.helpers';
import { keyFromFieldString } from './field-keys.helpers';
import { labelFromFieldString } from './field-labels.helpers';
import { FIELD_PROPS } from '../interfaces/field.interface';

type Obj = Record<string, any> | null | undefined;

export function inParensAfter(str: string, searchString: string): string | undefined {
  if (typeof str !== 'string') return undefined;

  const startIndex = str.indexOf(searchString);
  if (startIndex === -1) return undefined;

  const openIndex = str.indexOf('(', startIndex);
  if (openIndex === -1) return undefined;

  let depth = 0;
  for (let i = openIndex + 1; i < str.length; i++) {
    const char = str[i];
    if (char === '(') depth++;
    else if (char === ')') {
      if (depth === 0) return str.slice(openIndex + 1, i).trim();
      else depth--;
    }
  }

  return undefined; // no matching closing parenthesis found
}

export function propsFromString(
  str: string,
  fieldsProps: string[] = FIELD_PROPS,
  modifierProps?: ModifierProps,
): Obj {
  if (!str) return {};
  const props: Obj = {};

  if (modifierProps?.key) props[modifierProps.key] = keyFromFieldString(str);

  if (modifierProps?.label) {
    props[modifierProps.label] = labelFromFieldString(str, modifierProps?.lastDotAsName);
  }

  fieldsProps.forEach((propDef) => {
    const prop = propDef.split(' ')[0]?.trim();
    if (!prop) return;

    let searchIndex = 0;

    while (searchIndex < str.length) {
      // Look for both patterns: "prop(" and "prop ("
      const modIndexA = str.indexOf(`${prop}(`, searchIndex);
      const modIndexB = str.indexOf(`${prop} (`, searchIndex); //

      // Find the earliest valid occurrence
      let modIndex = -1;
      if (modIndexA !== -1 && modIndexB !== -1) modIndex = Math.min(modIndexA, modIndexB);
      else if (modIndexA !== -1) modIndex = modIndexA;
      else if (modIndexB !== -1) modIndex = modIndexB;

      if (modIndex === -1) break; // No more occurrences found

      // Check if we're inside nested parentheses
      const before = str.substring(0, modIndex);
      const openParenCount = (before.match(/\(/g) || []).length;
      const closeParenCount = (before.match(/\)/g) || []).length;
      const isNestedMod = openParenCount > closeParenCount;

      if (isNestedMod) {
        searchIndex = modIndex + prop.length + 1;
        continue;
      }

      // Extract the value after this property
      const value = inParensAfter(str.substring(modIndex), prop);

      if (value === undefined) {
        searchIndex = modIndex + prop.length + 1;
        continue;
      }

      // Parse the value based on type
      const typeMatch = propDef.match(/type\(([^)]+)\)/);
      const type = typeMatch?.[1]?.trim();

      let parsedValue: any = value;

      if (type === 'boolean') parsedValue = /^true$/i.test(value);
      //
      else if (type === 'number') {
        parsedValue = Number(value);
        if (isNaN(parsedValue)) parsedValue = value; // fallback to string if invalid number
      }
      //
      else if (type === 'numberArray') {
        parsedValue = value.split(',').map((v: string) => {
          const num = Number(v.trim());
          return isNaN(num) ? v.trim() : num; // fallback to string for invalid numbers
        });
      }
      //
      else if (['stringArray', 'array'].includes(<any>type)) {
        parsedValue = value.split(',').map((v: string) => v.trim());
      }

      // Handle mergeWith functionality
      const mergeWithMatch = str.match(/mergeWith\(([^)]+)\)/);
      const mergeWith = mergeWithMatch?.[1]?.trim();

      if (mergeWith && typeof parsedValue === 'string') {
        parsedValue = mergeClasses(parsedValue, modifierProps?.defaults?.[mergeWith] ?? '');
      }

      props[prop] = parsedValue;

      // Move search index past current match
      searchIndex = modIndex + prop.length + value.length + 3; // +3 for "()" and space
    }
  });

  // account for nested children
  if (modifierProps?.childrenKey && str.includes(modifierProps?.childrenKey)) {
    let temp = props[modifierProps?.childrenKey];
    let children_: string[] = Array.isArray(temp) ? temp : [];
    let children = children_.map((s) => propsFromString(s, fieldsProps, modifierProps));

    if (modifierProps?.inherit) {
      let propsToInherit = { ...props };
      delete propsToInherit[modifierProps?.childrenKey];
      children = children.map((c) => ({ ...deepClone(propsToInherit), ...c }));
    }

    props[modifierProps?.childrenKey] = children;
  }

  return props;
}

export function mergeFieldStrings(fieldStrings: string[]): string[] {
  const mergedMap: Map<string, string> = new Map();

  fieldStrings.forEach((fs) => {
    const key = keyFromFieldString(fs);
    const existingValue = mergedMap.get(key);

    if (existingValue) {
      // Extract modifiers from both field strings
      const existingModifiers = existingValue.replace(key, '').trim();
      const newModifiers = fs.replace(key, '').trim();

      //TODO: separate modifiers

      // Combine modifiers, removing duplicates
      let items = [...existingModifiers.split(/\s+/), ...newModifiers.split(/\s+/)].filter(Boolean);
      const allModifiers = [...new Set(items)].join(' ');

      mergedMap.set(key, `${key} ${allModifiers}`.trim());
    } else mergedMap.set(key, fs);
  });

  // Convert map values to array
  return Array.from(mergedMap.values());
}

export function splitFieldString(input: string) {
  if (!input || !input.includes(',')) return [input?.trim()].filter(Boolean); // Handle no commas

  // Find the start of modifiers (first occurrence of "word(")
  const modifierStart = input.search(/\b\w+\(/);

  if (modifierStart === -1) {
    return input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean); // No modifiers
  }

  // Split into fields and modifiers
  const fieldsPart = input.slice(0, modifierStart).trim();
  const modifiers = input.slice(modifierStart).trim();

  return fieldsPart
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field)
    .map((field) => `${field} ${modifiers}`); // Add space before modifiers
}
