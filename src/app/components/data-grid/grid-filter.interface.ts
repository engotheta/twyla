// advanced-filter behavior — how GridParameter.gridFilters (a FormField[]) drives GridState.filters

/**
 * Server-facing operator for one filter key. `PageDetails.filters` stays a plain
 * `Record<string, any>` of raw values — this tells a `gridDataFn` implementation how to
 * translate a given key's value into a query (e.g. a 'between' filter's value is a
 * two-element tuple). Keys not listed in `filterOperators` default to 'equals'.
 */
export type GridFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'like'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'isNull'
  | 'isNotNull';

export type GridFilterCombination = 'and' | 'or';

/** how `GridParameter.gridFilters` (a `FormField[]`) is wired up */
export interface GridFilterConfig {
  /**
   * default 'manual': an Apply `ActionButton` calls the filter form instance's `submit()`.
   * 'live': the filter form's `onChange` (generic-form §15) pushes straight into
   * `GridState.filters` as the user types/selects, debounced via `changeDebounce`.
   */
  filtersMode?: 'manual' | 'live';

  /** per `gridFilters` field key; unlisted keys default to 'equals' */
  filterOperators?: Record<string, GridFilterOperator>;
  /** default 'and' */
  filterCombination?: GridFilterCombination;

  /** forwarded to `FormParameters.changeDebounce` when `filtersMode` is 'live' */
  changeDebounce?: number;

  /** default 'Apply'; only rendered when `filtersMode` is 'manual' */
  applyButtonLabel?: string;
  /** default 'Clear'; calls the filter form instance's `form.reset()` */
  clearButtonLabel?: string;
  /** default true when any filter currently has a value */
  showClearButton?: boolean;
}
