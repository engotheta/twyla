import { formatCellValue } from './grid-format.helpers';

describe('formatCellValue — non-scalar values', () => {
  it('resolves a plain object via getLabelField instead of stringifying it as [object Object]', () => {
    const value = { id: 1, firstName: 'Ada', lastName: 'Lovelace' };
    expect(formatCellValue(value)).not.toContain('[object');
    expect(formatCellValue(value)).toContain('Ada');
  });

  it('runs an object-resolved value back through type-specific formatting (e.g. currency)', () => {
    const value = { key: 'amount', amount: 4200 };
    expect(formatCellValue(value, 'currency')).toContain('4,200');
  });

  it('joins an array of scalars with a natural-language conjunction', () => {
    expect(formatCellValue(['a'])).toBe('a');
    expect(formatCellValue(['a', 'b'])).toBe('a and b');
    // Intl.ListFormat's 'en' conjunction style is "a, b and c" (no Oxford comma) — locale-correct
    expect(formatCellValue(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('resolves each object in an array before joining', () => {
    const value = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Grace' },
    ];
    const result = formatCellValue(value);
    expect(result).toContain('Ada');
    expect(result).toContain('Grace');
    expect(result).toContain('and');
  });

  it('still returns an empty string for null/undefined/empty-string values', () => {
    expect(formatCellValue(null)).toBe('');
    expect(formatCellValue(undefined)).toBe('');
    expect(formatCellValue('')).toBe('');
  });
});
