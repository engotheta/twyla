// value display formatting and GridClassMap (conditional formatting) resolution

import { GridClassMap } from '../interfaces/grid-cell.interface';
import { getLabelField } from '../../details/field/field-labels.helpers';
import { isObject } from '../../details/util/util.helpers';

export type GridValueType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'currency'
  | 'percent'
  | 'html'
  | 'imageUrl';

/**
 * Formats a raw cell value for display per `type`. `boolean`/`html`/`imageUrl` are rendered
 * specially by the cell component, not as text, but fall back to a plain string here too — for
 * `imageUrl` that's just the raw URL.
 *
 * Non-scalar values (arrays and plain objects) are resolved BEFORE `type` is ever consulted —
 * they can show up on any column, typed or not (e.g. an auto-discovered/`allFields` export
 * column that was never declared with a matching `type`), and `String(value)` on either gives
 * `'[object Object]'`/nothing useful. An object resolves via `getLabelField` (same
 * best-representative-field heuristic `LabelPipe`/Details already use elsewhere — reused, not
 * reimplemented) down to its own display value, which is then run back through
 * `formatCellValue` itself (so a `type: 'date'` column whose value happens to be `{ date, tz }`
 * still formats the resolved date properly, not just stringifies it). An array recurses
 * per-element the same way, then joins with `Intl.ListFormat`'s natural-language conjunction —
 * `[a]` -> `'a'`, `[a, b]` -> `'a and b'`, `[a, b, c]` -> `'a, b, and c'` — the same `Intl.*`
 * convention this function already uses for numbers/currency/dates.
 */
export function formatCellValue(value: unknown, type?: GridValueType, locale?: string): string {
  if (value == null || value === '') return '';

  if (Array.isArray(value)) {
    const items = value
      .map((v) => formatCellValue(v, type, locale))
      .filter((s) => s !== '');
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  }
  if (isObject(value)) {
    return formatCellValue(getLabelField(value)?.value, type, locale);
  }

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
