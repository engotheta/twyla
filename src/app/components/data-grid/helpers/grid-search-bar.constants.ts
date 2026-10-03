// the unified search bar's fixed texts: how operators read, and which ones it can express

import { GridFilterOperator } from '../interfaces/grid-filter.interface';
import { DEFAULT_ENABLED_SEARCH_TYPES } from '../interfaces/grid-search.interface';

export interface GridSearchOperatorText {
  /** what the token shows, and what typing in the operator part is matched against */
  text: string;
  /** the operator said in full — a token's accessible name, and the list's dimmed description */
  words: string;
}

/** symbols where one is universally read (`=`, `>`…), plain words for the rest */
export const GRID_SEARCH_OPERATORS: Record<GridFilterOperator, GridSearchOperatorText> = {
  equals: { text: '=', words: 'is' },
  notEquals: { text: '!=', words: 'is not' },
  like: { text: 'contains', words: 'contains' },
  greaterThan: { text: '>', words: 'is greater than' },
  greaterThanOrEqual: { text: '>=', words: 'is at least' },
  lessThan: { text: '<', words: 'is less than' },
  lessThanOrEqual: { text: '<=', words: 'is at most' },
  in: { text: 'is one of', words: 'is one of' },
  notIn: { text: 'is not one of', words: 'is not one of' },
  between: { text: 'between', words: 'is between' },
  isNull: { text: 'is empty', words: 'is empty' },
  isNotNull: { text: 'is not empty', words: 'is not empty' },
};

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

/** the list row that turns the typed text into a free-text pill — GitLab's wording */
export const GRID_SEARCH_TEXT_OPTION = 'Search for this text';

/** `GridSearchSuggestion.value` of that row */
export const GRID_SEARCH_TEXT_VALUE = Symbol('grid-search-text');

export const GRID_SEARCH_COLUMNS_GROUP = 'Columns';
export const GRID_SEARCH_FILTERS_GROUP = 'Filters';
