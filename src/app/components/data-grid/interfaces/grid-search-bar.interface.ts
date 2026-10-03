// the unified search bar (GridParameter.unifiedSearch): what it can offer, and what it holds —
// see SPEC.md §12. Its config lives with the rest of search, in grid-search.interface.ts.

import { GridFilterOperator } from './grid-filter.interface';

/**
 * How a token's value is entered:
 *  - `text` / `number`: typed
 *  - `options`: picked from a list
 *  - `date` / `datetime` / `time` / `month` / `year`: a date filter, typed into a native input
 *  - `flag`: nothing to enter — picking the field completes the token (a toggle filter)
 */
export type GridSearchValueKind =
  'text' | 'number' | 'options' | 'date' | 'datetime' | 'time' | 'month' | 'year' | 'flag';

export interface GridSearchOption {
  value: unknown;
  label: string;
  icon?: string;
  disabled?: boolean;
}

/** one thing the bar can offer: a `searchable` column, or a `gridFilters` field */
export interface GridSearchToken {
  /** unique within a bar: `search:<column key>` or `filter:<field key>` */
  id: string;
  /** `search` writes to `GridState.searchFields`, `filter` to `GridState.filters` */
  source: 'search' | 'filter';
  /** the column's key (`SearchField.key`), or the filter's key in `GridState.filters` */
  key: string;
  title: string;
  icon?: string;
  /** a single entry is a fixed operator: shown on the token, never asked for */
  operators: GridFilterOperator[];
  defaultOperator: GridFilterOperator;
  valueKind: GridSearchValueKind;
  /** `valueKind: 'options'` */
  options?: GridSearchOption[];
  /** the value is an array of picked options */
  multiple?: boolean;
  /** how two option values compare — a select filter's own `compareWith` */
  compare?: (a: unknown, b: unknown) => boolean;
  /** false: a filter field currently hidden or disabled — its token stays in the bar while it
   *  holds a value, but the field is no longer offered */
  available: boolean;
}

/** one thing in the bar: a token with its operator and value, or a free-text pill */
export interface GridSearchBarItem {
  /** stable for as long as the bar lives — what the template tracks by */
  id: number;
  /** `GridSearchToken.id`; undefined for free text */
  token?: string;
  operator?: GridFilterOperator;
  /** a string for free text and column tokens; whatever the filter's control holds otherwise */
  value: unknown;
}

/** a row of the list that opens under the part being edited */
export interface GridSearchSuggestion {
  value: unknown;
  label: string;
  /** shown dimmed after the label: what an operator's symbol means */
  description?: string;
  icon?: string;
  disabled?: boolean;
  /** consecutive rows sharing a group sit under its heading */
  group?: string;
}

/** the three parts of a token, in order */
export type GridSearchPart = 'field' | 'operator' | 'value';

/** what one editable part reports — the bar handles all of them in one place */
export type GridSearchSegmentEvent =
  /** the part was clicked, or its input took focus */
  | { type: 'activate' }
  /** the text in the input changed */
  | { type: 'query'; text: string }
  /** a list row was taken; `carry` is a character typed past the list, meant for the next part */
  | { type: 'pick'; value: unknown; carry?: string }
  /** text typed into the operator part that turned out to be the value: no row was taken */
  | { type: 'overflow'; text: string }
  /** Enter with no row highlighted */
  | { type: 'submit'; text: string }
  /** Backspace in an empty input */
  | { type: 'backspace' }
  /** ← with the caret at the start */
  | { type: 'previous' }
  /** → with the caret at the end */
  | { type: 'next' }
  /** Esc with the list already closed (the first Esc closes it) */
  | { type: 'escape' }
  /** focus left the input */
  | { type: 'leave' };
