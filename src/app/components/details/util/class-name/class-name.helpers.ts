import { CLASS_MODIFIERS, MODABLE_INITIALS, CLASS_PREFIXES } from './class-name.constants';

/**
 * Extracts the base class without variants (responsive, hover, etc.)
 * Example: 'hover:bg-blue-500' -> 'bg-blue-500'
 * Example: 'md:grid-cols-2' -> 'grid-cols-2'
 */
function getBaseClass(className: string): string {
  const parts = className.split(':');
  return parts[parts.length - 1];
}

/**
 * Gets the variant prefix of a class
 * Example: 'md:grid-cols-2' -> 'md:'
 * Example: 'hover:bg-blue-500' -> 'hover:'
 * Example: 'bg-blue-500' -> ''
 */
function getVariant(className: string): string {
  const lastColonIndex = className.lastIndexOf(':');
  return lastColonIndex !== -1 ? className.substring(0, lastColonIndex + 1) : '';
}

/**
 * Checks if a class matches any of the defined prefixes
 */
function matchesPrefix(className: string, prefixes: string[]): string | null {
  const baseClass = getBaseClass(className);

  for (const prefix of prefixes) {
    if (baseClass === prefix.replace(/-$/, '') || baseClass.startsWith(prefix)) {
      return prefix;
    }
  }

  return null;
}

/**
 * Merges two class strings, removing conflicts based on Tailwind conventions
 * @param classA Base classes
 * @param classB Override classes (takes priority)
 * @param strict If true, removes modified versions when base exists
 * @returns Merged class string
 */
export function mergeClasses(
  classA: string | string[],
  classB: string | string[],
  strict = false,
): string {
  if (!classA && classB) return Array.isArray(classB) ? classB.join(' ') : classB;
  if (!classB && classA) return Array.isArray(classA) ? classA.join(' ') : classA;
  if (!classA && !classB) return '';

  // Split the class strings into arrays and filter empty strings
  let A = (Array.isArray(classA) ? classA : classA.split(' ')).filter((a) => !!a?.trim());
  let B = (Array.isArray(classB) ? classB : classB.split(' ')).filter((a) => !!a?.trim());

  // Check if a string has a modified version (e.g., 'm-4' vs 'mt-4')
  const isModed = (str: string, modable: string): boolean => {
    const baseClass = getBaseClass(str);
    const regex = new RegExp(
      `^${modable}(?:${CLASS_MODIFIERS.map((m) => m.replace(':', '\\:')).join('|')})`,
    );
    return regex.test(baseClass);
  };

  // In strict mode, remove modified versions from B if base exists in A
  if (strict) {
    A.forEach((a) => {
      const baseA = getBaseClass(a);
      MODABLE_INITIALS.forEach((m) => {
        if (baseA.startsWith(`${m}-`)) {
          B = B.filter((b) => !isModed(b, m));
        }
      });
    });
  }

  // Remove classes from A that conflict with B based on prefixes AND variants
  A = A.filter((a) => {
    const aVariant = getVariant(a);
    const aPrefix = matchesPrefix(a, CLASS_PREFIXES);

    if (!aPrefix) return true; // Keep classes that don't match any prefix

    // Check if any class in B has the same prefix AND same variant
    const hasConflict = B.some((b) => {
      const bVariant = getVariant(b);
      const bPrefix = matchesPrefix(b, CLASS_PREFIXES);

      // Conflict exists if same prefix AND same variant
      return aPrefix === bPrefix && aVariant === bVariant;
    });

    return !hasConflict;
  });

  // Remove duplicates while preserving order (B classes come after A classes)
  const uniqueClasses = [...new Set([...A, ...B])];

  return uniqueClasses.join(' ');
}

/**
 * Preserves only specified classes from a class list
 * @param classList Space-separated class string
 * @param strs Array of class names or single class name to preserve
 * @returns Filtered class string
 */
export function preserveClass(classList: string, strs: string[] | string): string {
  if (!Array.isArray(strs)) strs = [strs];
  let classes = classList.split(' ').filter((x) => !!x.trim());
  classes = classes.filter((c) => strs.includes(c));
  return classes.join(' ');
}

/**
 * Removes specified classes from a class list
 * @param classList Space-separated class string
 * @param strs Array of class names or single class name to remove
 * @returns Filtered class string
 */
export function removeClass(classList: string, strs: string[] | string): string {
  if (!Array.isArray(strs)) strs = [strs];
  let classes = classList.split(' ').filter((x) => !!x.trim());
  classes = classes.filter((c) => !strs.includes(c));
  return classes.join(' ');
}
