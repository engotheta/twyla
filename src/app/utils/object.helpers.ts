type Obj = Record<string, any>;

export function isObject(x: any) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export function objectHasKeys(object: any, keys: string[] | string, checkAll = true): boolean {
  if (typeof object !== 'object') return false;
  if (!object || !keys) return false;

  let hasKeys = checkAll ? true : false;
  if (!Array.isArray(keys)) keys = [keys];

  const hasProp = (key: string) => object?.hasOwnProperty(key);
  const hasKey = (key: string) => (checkAll ? hasKeys && hasProp(key) : hasKeys || hasProp(key));
  keys?.forEach((key) => (hasKeys = hasKey(key)));

  return hasKeys;
}

export function getPathValue(obj: any, path: string) {
  if (!path?.trim()) return obj;
  const normalized = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
  return normalized.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function isValue(value: any): boolean {
  return !!value || value === false || value === 0;
}

export function deepClone(obj: Obj) {
  if (obj === null || typeof obj !== 'object') return undefined;

  let clone = { ...obj };

  // Simple conversion
  try {
    const objJSON = JSON.stringify(obj);
    clone = JSON.parse(objJSON);
  } catch (err) {
    console.log('CLN Err');
  }

  return clone;
}
