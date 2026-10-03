// grid data-fetch cycle: what a fetch request carries, and what the grid currently holds

import { GridColumnState } from './grid-column.interface';
import { GridRenderMode } from './grid-render-mode.interface';
import { SearchField } from './grid-search.interface';

export interface GridSort {
  key: string;
  direction: 'asc' | 'desc';
}

/**
 * Passed to `fetchFn` on every fetch (initial load, page/size change, sort change,
 * search fields change, or filters change). Column-state changes (order/visible/width/pinned)
 * never produce a fetch — see `GridParameter.onColumnStateChange`.
 */
export interface PageDetails {
  page: number;
  size: number;
  /** always at least one entry — a `key: undefined` entry means "search all columns", the
   *  fallback used when the grid has zero `searchable` columns. See grid-search.interface.ts.
   *  From the unified search bar: its free text comes first (`key: undefined`, one entry per text
   *  pill), then one entry per column token; an empty bar sends a single `key: undefined` entry
   *  with an empty value. */
  searchFields: SearchField[];
  filters?: Record<string, any>;
  sort?: GridSort;
  [key: string]: any;
}

export interface GridData<RowType = any> {
  content: RowType[];
  totalLength?: number;
  page?: number;
  size?: number;
}

/**
 * Snapshot of everything the grid currently holds — passed as the `data` context to toolbar
 * `ActionButton<GridState<RowType>>`s, so a button like "Delete selected" can read `selected`.
 */
export interface GridState<RowType = any> {
  gridData: GridData<RowType>;
  searchFields: SearchField[];
  filters?: Record<string, any>;
  sort?: GridSort;
  selected?: RowType[];
  expandedRows?: RowType[];
  columnState?: GridColumnState[];
  renderMode?: GridRenderMode;
  [key: string]: any;
}
