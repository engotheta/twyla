// master grid config bag

import { Observable } from 'rxjs';
import { ActionButton, DynamicValue } from '@components/action-buttons/action-button.interface';
import { FormField } from '@components/generic-form';
import { GridClassMap } from './grid-cell.interface';
import { GridColumn, GridColumnState } from './grid-column.interface';
import { GridEditingConfig } from './grid-editing.interface';
import { GridExportConfig } from './grid-export.interface';
import { GridFilterConfig } from './grid-filter.interface';
import { GridRenderModeConfig } from './grid-render-mode.interface';
import { GridRowDetailConfig } from './grid-row-detail.interface';
import { GridSearchConfig } from './grid-search.interface';
import { GridData, GridSort, GridState, PageDetails } from './grid-state.interface';

export type GridSelectionMode = 'none' | 'single' | 'multiple';
export type GridSelectionControl = 'checkbox' | 'radio' | 'toggle';

export interface GridParameter<RowType = any> {
  icon?: string;
  label?: string;
  class?: string;
  animation?: string;

  // if true, the grid will show the toolbar, default is true
  // the toolbar will show the search input, grid filters, the grid options,
  //  and the table controls toggle button
  // if undefined, the grid will show the toolbar if any of the following are provided:
  //  gridFilters, gridOptions, buttons, showSearch, showTableControlsToggle
  // if false, the grid will not show the toolbar, even if any of the above are provided
  showToolbar?: boolean;

  // if true, the grid will show the search input, default is undefined
  // if undefined, the search input is visible whenever the paginator would be, OR whenever any
  //  searchFields entry currently has a value — so it never disappears out from under active typing
  //  just because the result set narrowed below one page (see DataGridComponent.showSearch)
  showSearch?: boolean;

  /** compound multi-field search config — see grid-search.interface.ts. Only relevant once at
   *  least one column is marked `searchable`; otherwise the toolbar shows a single plain search
   *  input searching every column, same as before. */
  searchConfig?: GridSearchConfig;

  /**
   * default true: the toolbar shows ONE search bar doing the job of both the search fields and
   * `gridFilters` — field / operator / value tokens in a single box, modelled on GitLab's
   * filtered search (SPEC.md §12). It writes the same `searchFields` and `filters`, so `fetchFn`
   * and everything else reading them is unaffected. false brings back the classic pair: the
   * search fields and the filter panel.
   */
  unifiedSearch?: boolean;

  // if true, the grid will show the table controls toggle button, default is true
  // toggle panel will list all the columns defined in the grid, and allow the user to
  // show/hide columns, pin/unpin columns, sort columns by dragging
  showTableControlsToggle?: boolean;

  // if true, the column panel shows a button that scans the current data for keys not already
  // declared as columns and adds them (initially hidden/unchecked, the user can then show them).
  // Session-only: discovered columns aren't persisted across a reload. Default is false.
  canAddColumns?: boolean;

  // grid options to change the grid features, e.g. pageSize, columns, etc.
  // only the properties defined in the gridOptions and not in excludedOptionKeys
  // will be overidden, other properties will remain the same
  // if options are provided, the grid will show available options to change from the grid options,
  // default is empty
  slug?: string; // setup initial selected option, default is the first option if some provided
  gridOptions?: GridParameter<RowType>[];
  optionChange?: (gridOptions: GridParameter<RowType>[]) => void;
  /** properties of the grid not overidden by option changes */
  excludedOptionKeys?: string[];

  // advanced filters: renders GridParameter.gridFilters (a FormField[]) via generic-form in the
  // toolbar, bound to GridState.filters — see GridFilterConfig for apply/clear/live behavior
  gridFilters?: FormField[];
  filterConfig?: GridFilterConfig;

  /** action buttons in the grid toolbar; data passed is the current GridState */
  buttons?: ActionButton<GridState<RowType>>[];

  noContentLabel?: string; // default 'No ' + label + ' found'
  noContentClick?: (data?: any) => any;

  // sources of data for the grid, can be an observable or an array of data
  // when gridData is resolved and its value is a valid GridData object,
  // the totalLength property of the gridData will be assigned to grid's totalLength property
  gridData?: Observable<GridData<RowType> | RowType[]> | GridData<RowType> | RowType[];

  // function to fetch data for the grid, e.g. from an API, it will be called with page details
  // if server paginated one would require return the GridData instead of just the data array,
  // so that the grid can show the paginator correctly
  fetchFn?: (
    page?: PageDetails,
  ) => Observable<GridData<RowType> | RowType[]> | GridData<RowType> | RowType[];

  // if serverPaginated is true, then the search input and the gridFilters,
  // will not filter the data locally in the grid,
  // but will be passed to the fetchFn as part of the page details,
  // so that the server can filter the data and return the correct data for the grid
  serverPaginated?: boolean; // default is false

  // parameter to fetch data for the grid, e.g. { page: 1, size: 10}
  page?: number;
  size?: number; // pagesize
  sizeOptions?: number[]; // default is [10, 25, 50, 100, 200, 500, 1000]

  // gives grid info if data was fetched in pagination and its receiving only a portion
  // of the data, and the total length of the data, so that the grid can show the paginator
  // if not provided, the grid will get it from provided/retrieved data length
  totalLength?: number;

  columns?: GridColumn<RowType>[];

  // path to the unique identifier of the row, e.g. 'id' or 'user.id' or 'user[0].id'
  // useful in incase of selectionMode !== 'none', to identify the selected rows, default is 'id'
  identifierKey?: string[];

  // if true, the last part of the key is used as the column name,
  // e.g. 'user.name' => 'name', default is false
  lastDotAsName?: boolean;

  sort?: GridSort;

  // if gridColumns is not provided, the grid will auto generate columns from the data, and this
  // is the maximum number of columns to generate, default is 6
  maxAutoColumns?: number;
  // if true, the grid will add an index column as the first column, default is true
  addIndexColumn?: boolean;

  // row selection — replaces the old multiSelectable/rowSelectable booleans
  /** default 'none' */
  selectionMode?: GridSelectionMode;
  /** visual control used for selection; default 'checkbox' */
  selectionControl?: GridSelectionControl;
  // a list of initially selected rows, could be the entire object or just the
  // identifierKey value, default is empty
  initialSelected?: RowType[];
  // callback function to return the selected rows; selectedRow is an array of the
  // selected rows, which is the entire row object
  onRowSelection?: (rows?: RowType[]) => any;
  // if true, the grid will automatically select the first row, default is false
  autoSelectFirstRow?: boolean;
  // NOTE: the header "select all" checkbox only ever affects the CURRENT PAGE — there is no
  // cross-page "select all matching filter" capability.

  columnsResizable?: boolean;

  // if true, the first column will be pinned to the left, default is true
  // if first column is index, then the second column will be also pinned to the left
  autoPinFirstColumn?: boolean;

  // if true, the last column will be pinned to the right, default is true
  // action column is always added if rowButtons are provided, and it will be pinned to the right
  autoPinActionColumn?: boolean;

  // if undefined, the grid will show the paginator if pageSize and totalLength allow for pagination
  // default is undefined, if true, the grid will always show the paginator,
  // if false, the grid will never show the paginator
  showPaginator?: boolean;

  // runtime column layout (order/visible/width/pinned per key) — seed it to restore a
  // previously-saved layout, and persist it yourself (e.g. to localStorage) via
  // onColumnStateChange. Column-state changes never trigger a fetchFn refetch.
  initialColumnState?: GridColumnState[];
  onColumnStateChange?: (state: GridColumnState[]) => void;

  rowClass?: DynamicValue<string, RowType>; // class to apply to every row
  rowButtons?: ActionButton<RowType>[]; // action buttons to display in each row, if any
  rowClick?: (row: RowType) => void;
  rowDClick?: (row: RowType) => void; // double click handler for the row

  // if true, rows can be manually reordered by dragging a leading drag-handle column, default
  // false. Table and list render modes only (not cards). Reordering is scoped to the CURRENT
  // page — dragging across pages isn't supported — and resets whenever page/sort/search/filters
  // change, since a previous manual order no longer corresponds to a meaningfully "same" set of
  // rows once the underlying row set changes for another reason.
  rowsDraggable?: boolean;
  // rowsInNewOrder is the current page's rows in their new order; draggedRow is the row that was moved
  onRowDrag?: (rowsInNewOrder: RowType[], draggedRow: RowType) => void;

  // if true, the grid will merge cells with the same resolved values accross columns and rows
  // default is false; manual GridCell rowspan/colspan entries take precedence over auto-merge
  // for any cell they cover
  mergeCells?: boolean;

  /** per-row class predicates applied grid-wide, e.g. highlight failed/critical rows */
  rowFormatter?: GridClassMap<RowType>;

  /** row master-detail expansion */
  rowDetail?: GridRowDetailConfig<RowType>;
  /** alternate render modes (table/list/cards) for the same data/config */
  renderMode?: GridRenderModeConfig<RowType>;
  /** inline cell editing */
  editing?: GridEditingConfig<RowType>;
  /** CSV/Excel/PDF export */
  export?: GridExportConfig<RowType>;

  // number of clicks on a row to open an all-details modal for that row (the `ROW_DETAILS_COMPONENT`
  // hosted in a `ViewService` dialog), showing every field of the row with no extra config
  // needed. Default is 7; set to 0 to disable.
  viewDetailsClicks?: number;
}
