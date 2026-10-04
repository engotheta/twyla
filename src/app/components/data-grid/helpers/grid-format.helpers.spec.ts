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

describe('formatCellValue — Date values', () => {
  const afternoon = new Date(2024, 0, 5, 14, 30);
  const midnight = new Date(2024, 0, 5);

  it('formats a Date by the column type', () => {
    expect(formatCellValue(afternoon, 'date', 'en-US')).toBe('Jan 5, 2024');
    expect(formatCellValue(afternoon, 'datetime', 'en-US')).toMatch(/^Jan 5, 2024, 2:30\sPM$/);
    expect(formatCellValue(afternoon, 'time', 'en-US')).toMatch(/^2:30\sPM$/);
  });

  it('shows the date on an untyped column, and the time only when the Date carries one', () => {
    expect(formatCellValue(midnight, undefined, 'en-US')).toBe('Jan 5, 2024');
    expect(formatCellValue(afternoon, undefined, 'en-US')).toMatch(/^Jan 5, 2024, 2:30\sPM$/);
    expect(formatCellValue(afternoon, 'text', 'en-US')).toMatch(/^Jan 5, 2024, 2:30\sPM$/);
  });

  it('formats the Dates inside an array, and shows nothing for an invalid Date', () => {
    expect(formatCellValue([midnight, new Date(2024, 1, 1)], 'date', 'en-US')).toBe(
      'Jan 5, 2024 and Feb 1, 2024',
    );
    expect(formatCellValue(new Date('nope'))).toBe('');
  });

  it('follows the locale it is given', () => {
    expect(formatCellValue(midnight, 'date', 'en-GB')).toBe('5 Jan 2024');
  });
});
