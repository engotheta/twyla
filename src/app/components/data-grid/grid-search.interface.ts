// searchable columns: compound multi-field search (GridState.searchFields), replacing the old
// single flat `searchTerm`. Distinct from grid-filter.interface.ts's `filters`/`GridFilterConfig`
// — that's the separate, coexisting advanced-filter-panel feature; don't conflate the two.

import { GridFilterOperator } from './grid-filter.interface';

/** reuses GridFilterOperator's 12 cases — `matchesOperator` (grid-row.helpers.ts) is already the
 *  single source of truth for both `filters` and `searchFields`. `GridSearchConfig.enabledSearchTypes`
 *  restricts the optional per-instance override picker to the value-friendly subset by default;
 *  see `coerceSearchValue` in grid-row.helpers.ts for how a raw text value is typed before compare. */
export type SearchType = GridFilterOperator;

/** one compound search instance: search `key` for `value` using `searchType`. */
export interface SearchField {
  /** the searchable column's key. Left undefined only when the grid has zero `searchable`
   *  columns — a single plain-text instance then searches across every leaf column, the same
   *  behavior the old single-string `searchTerm` had. */
  key?: string;
  value: string;
  searchType: SearchType;
}

export interface GridSearchConfig {
  /** default 'inline': instances beyond the first grow directly in the toolbar row.
   *  'modal' routes instances beyond the first into a dialog instead (mirrors grid-filters). */
  searchFieldsMode?: 'inline' | 'modal';
  /** default 'like'; a column's own `GridColumn_.searchType` wins over this when set */
  defaultSearchType?: SearchType;
  /** options offered by the optional per-instance searchType override (see `allowSearchTypeOverride`).
   *  default: equals, notEquals, like, greaterThan(OrEqual), lessThan(OrEqual) — operators a
   *  single free-text value can express; `in`/`notIn`/`between` need multi-value input and
   *  `isNull`/`isNotNull` need none, so none of those are offered by default. */
  enabledSearchTypes?: SearchType[];
  /** default false: shows a toggle that reveals a per-instance searchType dropdown, letting the
   *  user override the default/column-declared searchType for that one instance */
  allowSearchTypeOverride?: boolean;
  changeDebounce?: number;
}

export const DEFAULT_ENABLED_SEARCH_TYPES: SearchType[] = [
  'equals',
  'notEquals',
  'like',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
];
