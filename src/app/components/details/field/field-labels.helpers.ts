import { isObject, isValue, objectHasKeys } from '../util/util.helpers';
import { NAME_KEYS, SENSITIVE_KEYS } from './field-keys.constants';
import { CompoundParameter, COMPOUND_NAMED_KEYS } from './field-maps.constants';
import { Field } from './field.interface';

type Obj = Record<string, any> | null | undefined;

const ID_SUFFIXES = ['Id', 'Uid'];

export function getLabelField(object: Obj): Field {
  if (!object || typeof object !== 'object') {
    return { key: '', value: object, label: 'item' };
  }

  // Check if the object matches a known compound shape (e.g. { firstName, lastName })
  const compoundMatch = COMPOUND_NAMED_KEYS.find((c) => objectHasKeys(object, c.keys ?? [], false));

  if (compoundMatch) {
    const cmp: CompoundParameter = { ...compoundMatch, object };
    return { key: '', value: cmp.mapper ? cmp.mapper(cmp) : combineValues(cmp) };
  }

  const fields = Object.entries(object)
    .filter(([key]) => !SENSITIVE_KEYS.includes(key) && !ID_SUFFIXES.some((s) => key.endsWith(s)))
    .map(([key, value]) => ({ key, value, label: camelToSpaced(key) }));

  let field = findLabelField(fields) ?? fields.find((f) => isValue(f.value));

  // Recurse into nested object/array to find a displayable name, preserving the parent key
  if (field) {
    const nested = isObject(field.value)
      ? field.value
      : Array.isArray(field.value) && field.value.length > 0
        ? field.value[0]
        : null;

    if (nested) return { ...getLabelField(nested), key: field.key };
  }

  return field ?? { label: 'item', key: 'item', value: undefined };
}

// Priority: exact key match > key ends with > key includes (checked in that order across all NAME_KEYS)
function findLabelField(fields: Field[]): Field | undefined {
  const candidates = fields.filter((f) => !ID_SUFFIXES.some((s) => f.key?.endsWith(s)));

  const matchers: Array<(f: Field, k: string) => boolean> = [
    (f, k) => f.key === k,
    (f, k) => !!f.key?.toLowerCase().endsWith(k.toLowerCase()),
    (f, k) => !!f.key?.toLowerCase().includes(k.toLowerCase()),
  ];

  for (const matches of matchers) {
    for (const k of NAME_KEYS) {
      const field = candidates.find((f) => matches(f, k));
      if (field) return field;
    }
  }
  return undefined;
}

export function combineValues(x: CompoundParameter) {
  let value = '';

  x?.keys?.forEach((key) => {
    const v = x?.object?.[key];
    if (!v) return;

    const resolved = isObject(v) ? getLabelField(v)?.value : v;
    value = `${value}${value ? x?.separator : ''} ${resolved ?? ''}`;
  });

  return value;
}

export function labelFromFieldString(str: string, lastDotAsName = false): string {
  // Strip one or more trailing "identifier(...)" segments,
  // e.g. "class(bg-blue) another()" or just "class(bg-blue)"
  const withoutClass = str.replace(/(\s*\S+\([^)]*\))+\s*$/, '').trim();

  // If "<key> as <label>" pattern exists, take everything after "as"
  const asMatch = withoutClass.match(/^.*?\s+as\s+(.*)$/);
  if (asMatch) return toTitleCase(asMatch[1].trim());

  let base = withoutClass;
  if (lastDotAsName && base.includes('.')) {
    base = base.split('.').pop() ?? base;
  }

  return toTitleCase(base);
}

export function toTitleCase(str: string) {
  return (
    str
      // Replace underscores, hyphens with space
      ?.replace(/[-_]+/g, ' ')
      // Put space between lower & upper (camel/Pascal case → spaced)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Put space between consecutive uppers followed by lower (e.g. "NASAProject" → "NASA Project")
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      // Normalize spaces
      .trim()
      .split(/\s+/)
      // Capitalize each word
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  );
}

export function camelToSpaced(y: string) {
  if (typeof y !== 'string' || y.includes(' ')) return y;
  const spaced = y.replace(/([A-Z]+)/g, ' $1').replace(/([A-Z][a-z])/g, '$1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function capFirstChar(s: string): string {
  return !s ? '' : s?.charAt(0).toUpperCase() + s?.slice(1);
}

export function getAttachmentIcon(value: any) {
  let icon = undefined;

  let isStr = (v: any) => typeof v === 'string';

  let map = { '.pdf': 'pdf', '.doc': 'word', '.xls': 'excel' };
  let entries = Object.entries(map);
  if (isStr(value)) entries.forEach(([k, val]) => value.includes(k) && (icon = val));

  if (Array.isArray(value) && !!value[0]) {
    let vals = Object.values(value[0]);
    entries.forEach(([k, val]) => !!vals.find((v) => isStr(v) && v.includes(k)) && (icon = val));
  }

  return icon;
}
