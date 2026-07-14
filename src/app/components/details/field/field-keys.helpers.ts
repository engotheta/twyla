export function getKeys(items: string | (string | any)[]): string[] {
  const arr = Array.isArray(items) ? items : [items];

  return arr
    .map((item) => (typeof item === 'string' ? item : item?.key))
    .filter((k): k is string => typeof k === 'string')
    .map((k) => keysFromFieldString(k))
    .reduce((a, b) => a.concat(b), []);
}

export function keyFromFieldString(s: string): string {
  let key = s;
  if (!s) return s;
  return (key = s.split(' ')[0]);
}

export function keysFromFieldString(s: string): string[] {
  let keys = [];
  if (!s) return [];
  if (s.includes(',')) keys = s.split(',').map((k) => k.trim().split(' ')[0]);
  else keys = [s.split(' ')[0]];
  return keys;
}
