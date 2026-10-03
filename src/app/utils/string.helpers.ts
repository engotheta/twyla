export function stringAfter(str: string, char: string) {
  const index = str.indexOf(char);
  if (index !== -1) return str.substring(index + 1); // Or str.slice(index + 1);
  return undefined;
}

export function stringBefore(str: string, char: string) {
  const index = str.indexOf(char);
  if (index !== -1) return str.substring(0, index - 1); // Or str.slice(index + 1);
  return undefined;
}
