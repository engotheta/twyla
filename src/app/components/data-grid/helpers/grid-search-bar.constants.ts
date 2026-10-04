// the unified search bar's fixed values: which operators it can express. Its text — how the
// operators read, the list's headings — is in `grid.messages.ts`, per language; the constants
// kept here for it are the English.

import { GRID_EN } from '../grid.messages';
import { GridFilterOperator } from '../interfaces/grid-filter.interface';
import { DEFAULT_ENABLED_SEARCH_TYPES } from '../interfaces/grid-search.interface';

export interface GridSearchOperatorText {
  /** what the token shows, and what typing in the operator part is matched against */
  text: string;
  /** the operator said in full — a token's accessible name, and the list's dimmed description */
  words: string;
}

/** how the operators read in English — in another language, `GRID_MESSAGES`'s `search.operators` */
export const GRID_SEARCH_OPERATORS: Record<GridFilterOperator, GridSearchOperatorText> =
  GRID_EN.search.operators;

/**
 * What a column token can use. A `SearchField.value` is one string, so only operators a single
 * text value can express work there (`matchesSearchFields` drops an entry with no value, and
 * `in`/`between` need several) — the same set the classic search fields offer by default.
 */
export const GRID_SEARCH_COLUMN_OPERATORS: ReadonlySet<GridFilterOperator> = new Set(
  DEFAULT_ENABLED_SEARCH_TYPES,
);

/** operators that take no value: the token is complete as soon as its field is picked */
export const GRID_SEARCH_VALUELESS_OPERATORS: ReadonlySet<GridFilterOperator> = new Set([
  'isNull',
  'isNotNull',
]);

/** operators whose value is a list of picked options */
export const GRID_SEARCH_LIST_OPERATORS: ReadonlySet<GridFilterOperator> = new Set(['in', 'notIn']);

/** the list row that turns the typed text into a free-text pill, in English */
export const GRID_SEARCH_TEXT_OPTION = GRID_EN.search.textOption;

/** `GridSearchSuggestion.value` of that row */
export const GRID_SEARCH_TEXT_VALUE = Symbol('grid-search-text');

/** the field list's two headings, in English */
export const GRID_SEARCH_COLUMNS_GROUP = GRID_EN.search.columnsGroup;
export const GRID_SEARCH_FILTERS_GROUP = GRID_EN.search.filtersGroup;
