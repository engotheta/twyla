// advanced-filter behavior — how GridParameter.gridFilters (a FormField[]) drives GridState.filters

/**
 * Server-facing operator for one filter key. `PageDetails.filters` stays a plain
 * `Record<string, any>` of raw values — this tells a `fetchFn` implementation how to
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
   * default 'modal' (today's behavior): a toggle button opens the filter panel in a
   * `cdkConnectedOverlay`. 'inline' renders the filter fields directly in the toolbar row,
   * with no toggle button — mirrors `GridSearchConfig.searchFieldsMode`. Independent of
   * `filtersTrigger` below (that's about WHEN filters apply, this is about WHERE they render).
   */
  filtersMode?: 'modal' | 'inline';

  /**
   * default 'manual': an Apply `ActionButton` calls the filter form instance's `submit()`.
   * 'live': the filter form's `onChange` (generic-form §15) pushes straight into
   * `GridState.filters` as the user types/selects, debounced via `changeDebounce`.
   */
  filtersTrigger?: 'manual' | 'live';

  /** per `gridFilters` field key; unlisted keys default to 'equals' */
  filterOperators?: Record<string, GridFilterOperator>;
  /** default 'and' */
  filterCombination?: GridFilterCombination;

  /** forwarded to `FormParameter.changeDebounce` when `filtersTrigger` is 'live' */
  changeDebounce?: number;

  /** default 'Apply'; only rendered when `filtersTrigger` is 'manual' */
  applyButtonLabel?: string;
  /** default 'Clear'; calls the filter form instance's `form.reset()` */
  clearButtonLabel?: string;
  /** default true when any filter currently has a value */
  showClearButton?: boolean;
}
