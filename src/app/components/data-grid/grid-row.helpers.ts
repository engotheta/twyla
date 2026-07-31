// pure functions: row identity, cell value extraction, and LOCAL (non-serverPaginated) search/filter/sort

import { getPathValue } from '../details/util/util.helpers';
import { GridFilterOperator } from './grid-filter.interface';
import { GridColumn_ } from './grid-column.interface';
import { SearchField } from './grid-search.interface';
import { GridSort } from './grid-state.interface';

const DEFAULT_IDENTIFIER_KEY = ['id'];

/** Stable identity string for a row, built from `identifierKey` paths (default `['id']`). */
export function getRowId<RowType = any>(row: RowType, identifierKey: string[] = DEFAULT_IDENTIFIER_KEY): unknown {
  const values = identifierKey.map((path) => getPathValue(row, path));
  return values.length === 1 ? values[0] : JSON.stringify(values);
}

export function rowsEqual<RowType = any>(a: RowType, b: RowType, identifierKey?: string[]): boolean {
  if (a === b) return true;
  const idA = getRowId(a, identifierKey);
  const idB = getRowId(b, identifierKey);
  return idA !== undefined && idA !== null && idA === idB;
}

export function getCellValue<RowType = any>(row: RowType, column: GridColumn_<RowType>): unknown {
  return getPathValue(row, column.key);
}

function toSearchableText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return '';
  return String(value);
}

export function matchesSearchTerm<RowType = any>(
  row: RowType,
  columns: GridColumn_<RowType>[],
  term: string,
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return columns.some((col) => toSearchableText(getCellValue(row, col)).toLowerCase().includes(needle));
}

function matchesOperator(value: unknown, operator: GridFilterOperator, target: unknown): boolean {
  switch (operator) {
    case 'equals':
      return value === target;
    case 'notEquals':
      return value !== target;
    case 'like':
      return toSearchableText(value).toLowerCase().includes(toSearchableText(target).toLowerCase());
    case 'in':
      return Array.isArray(target) && target.includes(value);
    case 'notIn':
      return Array.isArray(target) && !target.includes(value);
    case 'greaterThan':
      return (value as any) > (target as any);
    case 'greaterThanOrEqual':
      return (value as any) >= (target as any);
    case 'lessThan':
      return (value as any) < (target as any);
    case 'lessThanOrEqual':
      return (value as any) <= (target as any);
    case 'between': {
      const [min, max] = Array.isArray(target) ? target : [undefined, undefined];
      return (value as any) >= min && (value as any) <= max;
    }
    case 'isNull':
      return value == null;
    case 'isNotNull':
      return value != null;
  }
}

/**
 * Best-effort text→typed coercion for a `SearchField.value` (always a raw string, since it comes
 * from a plain text input) before comparing it against a column's actually-typed value.
 * `matchesOperator`'s `equals`/`notEquals`/`greaterThan*`/`lessThan*` cases do strict/raw
 * comparisons and are otherwise only ever fed already-typed values (from generic-form controls) —
 * without this, `'equals'` against a numeric column would silently never match (`30 === "30"` is
 * false). Deliberately NOT applied for `'like'` — coercing to a Date/number before `like`'s
 * fuzzy substring match would change its semantics (e.g. a partial "2024-01" match against a date).
 */
function coerceSearchValue(raw: string, columnType?: GridColumn_['type']): unknown {
  switch (columnType) {
    case 'number':
    case 'currency':
    case 'percent': {
      const n = Number(raw);
      return Number.isNaN(n) ? raw : n;
    }
    case 'boolean':
      if (raw.toLowerCase() === 'true') return true;
      if (raw.toLowerCase() === 'false') return false;
      return raw;
    case 'date':
    case 'datetime':
    case 'time': {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d;
    }
    default:
      return raw;
  }
}

/**
 * Compound multi-field search (GridState.searchFields) — OR-combined across `fields` (searching
 * across several fields is inclusive), unlike `matchesFilters`'s AND-default below (a separate,
 * unrelated feature — don't copy its combination semantics here). A `key: undefined` entry (the
 * zero-searchable-columns fallback) reuses `matchesSearchTerm`'s all-columns substring match.
 */
export function matchesSearchFields<RowType = any>(
  row: RowType,
  fields: SearchField[],
  columns: GridColumn_<RowType>[],
): boolean {
  const active = fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== '');
  if (!active.length) return true;

  return active.some((f) => {
    if (f.key === undefined) return matchesSearchTerm(row, columns, f.value);
    const column = columns.find((c) => c.key === f.key);
    const value = column ? getCellValue(row, column) : getPathValue(row, f.key);
    const target = f.searchType === 'like' ? f.value : coerceSearchValue(f.value, column?.type);
    return matchesOperator(value, f.searchType, target);
  });
}

export function matchesFilters<RowType = any>(
  row: RowType,
  filters: Record<string, any> | undefined,
  filterOperators?: Record<string, GridFilterOperator>,
  combination: 'and' | 'or' = 'and',
): boolean {
  // `false` is excluded the same as unset/empty — a checkbox/toggle `gridFilters` field's
  // unchecked state is `false`, and `FormInstance.submitValue()` always includes every field
  // (checked or not, visible or not — SPEC §6/§7), so an untouched toggle would otherwise ALWAYS
  // apply an `equals false` filter on every Apply click. This matches the near-universal "filter
  // toggle" convention (unchecked = no constraint, checked = show only true) — a filter that
  // genuinely needs to distinguish "unset" from "false" should use a tri-state select with a
  // `hasNoneOption`/`null` "unset" value instead (as this grid's own department filter does).
  const entries = Object.entries(filters ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && v !== false,
  );
  if (!entries.length) return true;

  const results = entries.map(([key, target]) => {
    const operator = filterOperators?.[key] ?? 'equals';
    return matchesOperator(getPathValue(row, key), operator, target);
  });

  return combination === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows<RowType = any>(rows: RowType[], sort: GridSort | undefined): RowType[] {
  if (!sort?.key) return rows;
  const factor = sort.direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => factor * compareValues(getPathValue(a, sort.key), getPathValue(b, sort.key)));
}
