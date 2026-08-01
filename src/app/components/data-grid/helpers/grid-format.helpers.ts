// value display formatting and GridClassMap (conditional formatting) resolution

import { GridClassMap } from '../interfaces/grid-cell.interface';

export type GridValueType =
  'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'currency' | 'percent' | 'html';

/** Formats a raw cell value for display per `type`. `boolean`/`html` are rendered specially by the cell component, not as text, but fall back to a plain string here too. */
export function formatCellValue(value: unknown, type?: GridValueType, locale?: string): string {
  if (value == null || value === '') return '';

  try {
    switch (type) {
      case 'number':
        return new Intl.NumberFormat(locale).format(Number(value));
      case 'currency':
        return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
          Number(value),
        );
      case 'percent':
        return new Intl.NumberFormat(locale, { style: 'percent' }).format(Number(value));
      case 'date':
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(value as string),
        );
      case 'datetime':
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value as string),
        );
      case 'time':
        return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
          new Date(value as string),
        );
      case 'boolean':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  } catch {
    return String(value);
  }
}

/** Resolves a `GridClassMap` (independent class predicates) into a single space-joined class string. */
export function resolveClassMap<RowType = any>(
  map: GridClassMap<RowType> | undefined,
  row: RowType,
  index?: number,
): string {
  if (!map) return '';
  return Object.entries(map)
    .filter(([, predicate]) => predicate(row, index))
    .map(([className]) => className)
    .join(' ');
}
