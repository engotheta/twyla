// table features

import { Observable } from 'rxjs';
import { ActionButton } from '../action-buttons/action-button.interface';
import { FormField } from '../generic-form';

export interface GridSort {
  key: string;
  direction: 'asc' | 'desc';
}

export interface PageDetails {
  page: number;
  size: number;
  searchTerm?: string;
  filters?: Record<string, any>;
  sort?: GridSort;
  [key: string]: any;
}

export interface GridData {
  content: any[];
  totalLength?: number;
  page?: number;
  size?: number;
}

export interface GridState {
  gridData: GridData;
  searchTerm?: string;
  // current values of the filters, e.g. { status: 'active', category: 'electronics' }
  filters?: Record<string, any>;
  // current sort state of the grid, e.g. { key: 'name', direction: 'asc' }
  sort?: GridSort;
  [key: string]: any;
}

export interface GridParameter {
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
  // if undefined, search input is only visible by the same condition that shows the paginator,
  //  i.e. if pageSize and totalLength allow for pagination
  showSearch?: boolean;

  // if true, the grid will show the table controls  toggle button, default is true
  // toggle panel will list all the columns defined in the grid, and allow the user to
  // show/hide columns, pin/unpin columns,  sort columns by dragging,
  showTableControlsToggle?: boolean;

  // grid options to change the grid features, e.g. pageSize, columns, etc.
  // only the properties defined in the gridOptions and not in noneOptionKeys
  // will be overidden, other properties will remain the same
  // if options are provided, the grid will show available options to change from the grid options,
  // default is empty

  slug?: string; // setup initial selected option, default is the first option if some provided
  gridOptions?: GridParameter[];
  optionChange?: (gridOptions: GridParameter[]) => void;
  noneOptionKeys?: string[]; // properties of the grid not overidden by option changes

  // filters to show in the grid toolbar
  // it will render a form on the toolbar, and the form will be bound to the grid state filters
  // the form will be submitted on change, and the grid will be refreshed with the new filters
  // the form will be reset on clear, and the grid will be refreshed with no filters
  // a generic form will be initialized with the current grid state filters, if any
  // TODO: add posibility of the generic form to be streamlined inline to fit in the toolbar
  // also to render without the submit btn, and a callback on change,so provide value to a variable
  // in the caller, and also optional clear all button at the end of the form, to reset the form
  gridFilters?: FormField[];

  // action buttons to display in the grid toolbar, if any
  // data passed will be GridState
  buttons?: ActionButton[];

  noContentLabel?: string; // default  'No ' + label + ' found'
  noContentClick?: (data?: any) => any;

  // sources of data for the grid, can be an observable or an array of data
  // when gridData is resolved and  its value is  a valid GridData object,
  // the totalLength property of the gridData will be assigned to grid's totalLength property,
  gridData?: Observable<GridData | any[]> | GridData | any[];

  // function to fetch data for the grid, e.g. from an API, it will be called with page details
  // if server paginated one would require return the GridData instead of just the data array,
  // so that the grid can show the paginator correctly
  gridDataFn?: (page?: PageDetails) => Observable<GridData | any[]> | GridData | any[];

  // if serverPaginated is true, then the search input and the gridFilters,
  // will not filter the data locally in the grid,
  // but will be passed to the gridDataFn as part of the page details,
  // so that the server can filter the data and return the correct data for the grid
  serverPaginated?: boolean; //default is false

  // parameter to fetch data for the grid, e.g. { page: 1, size: 10}
  page?: number;
  size?: number; // pagesize
  sizeOptions?: number[]; // default is [10, 25, 50, 100, 200, 500, 1000];

  // gives grid info if data was fetched in paginationand its receiving only a portion
  // of the data, and the total length of the data, so that the grid can show the paginator
  // if not provided, the grid will get it from provided/ retrieved data length
  totalLength?: number;

  columns?: GridColumn[];

  // path to the unique identifier of the row, e.g. 'id' or 'user.id' or 'user[0].id'
  // useful in incase of multiSelectable, to identify the selected rows, default is 'id'
  // default is uid
  identifierKey?: string[];

  // if true, the last part of the key is used as the column name,
  // e.g. 'user.name' => 'name', default is false
  lastDotAsName?: boolean;

  sort?: GridSort;

  // if gridColumns is not provided,
  //  the grid will auto generate columns from the data, and this is the maximum
  // number of columns to generate, default is 6
  maxAutoColumns?: number;
  // if true, the grid will add an index column as the first column, default is true
  addIndexColumn?: boolean;

  multiSelectable?: boolean; // default true
  rowSelectable?: boolean; // default false

  // a list of initially selected rows,
  // could be the entire object or just the identifierKey value, default is empty
  initialSelected?: any[];

  // callback function to return the selected rows, default is undefined
  // if provided then rowSelectable is true, and the grid will show a checkbox for each row,
  //  and a checkbox in the header to select all rows
  // checkbox is appended to the first column,
  // selectedRow is an array of the selected rows, which is the entire row object
  onRowSelection?: (rows?: any[]) => any;

  // if true, the grid will automatically select the first row, default is false
  autoSelectFirstRow?: boolean;

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

  rowClass?: ((row: any) => string) | Observable<string> | string; // class to apply to every row
  rowButtons?: ActionButton[]; // action buttons to display in each row, if any
  rowClick?: (row: any) => void;
  rowDClick?: (row: any) => void; // double click handler for the row

  // if true, the grid will merge cells with the same resolved values accross columns and rows
  // default is false
  // thus this calculates the rowspan and colspan for each cell and sets them accordingly
  mergeCells?: boolean;

  // number of clicks to trigger the display details model via our details comp,
  // passing the row data to the model, default is 7
  viewDetailsClicks?: number;
}

// if string a GridColumn_ will be created with key as the string, and other properties
// extracted from the string like in DataField on Details component
export type GridColumn = string | GridColumn_;

export interface GridColumn_ {
  // the prop path of the column, used to access the value
  // from the row data e.g 'age' or 'address.city' or 'address[0].city'
  key: string;

  label?: string; // the label of the column, displayed in the header
  sortable?: boolean; // whether the column is sortable, default is false
  filterable?: boolean; // whether the column is filterable, default is false

  width?: string; // width of the column, e.g. '100px', '20%', etc.
  minWidth?: string; // minimum width of the column, e.g. '100px', '20%', etc.
  maxWidth?: string; // maximum width of the column, e.g. '100px', '20%', etc.

  //to apply just to the header cell, not the whole column, e.g. to add a class to the header cell
  headerProps?: {
    class?: string; // for the header cell, default is empty
    buttons?: ActionButton[]; // action buttons to display in the header cell, if any
  };

  // to apply to all cells in the column, including the header cell, e.g. to add a class to all cells
  type?: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'currency' | 'percent';
  align?: 'left' | 'center' | 'right'; // the alignment of the column, default is left
  template?: any; // template / component to use for this column's cells, if any
  templateContext?: any; // context / component inputs for the template, if any

  class?: string; // for all col cells, including the header, default is empty

  pinned?: 'left' | 'right' | undefined; // whether the column is pinned to the left or right, default is undefined (not pinned)
  resizable?: boolean; // whether the column is resizable, default is true
  visible?: boolean; // whether the column is visible, default is true

  truncate?: number; // number of characters to truncate the cell value, default is undefined (no truncation)

  // each cell has a content wrapper div, this is the class to apply to that div,
  // can be a string or a function that returns a string based on the row data
  // the div holds the value of the cell, the buttons, icon  if present
  contentClass?: string | ((row: any) => string); // class to apply to the cell content, can be a string or a function that returns a string based on the row data

  icon?: string | ((row: any) => string);
  iconclass?: string | ((row: any) => string);

  // for nested columns
  // if columns is provided, the column will be a parent column, and the columns will be its children
  // use full for nested columns, e.g. 'address.city' and 'address.state' will be children of 'address'
  // thus address would appear as a header cell that spans the two columns,
  // and the two columns (state, city) would be under it
  // the nesting could go on indefinitely, e.g. 'address.city.name' and 'address.city.zip' would be children of 'address.city'
  columns?: GridColumn[];
}

// table row features
// usage: to be embeded in the list/data perItem,
// for example:
/* {
  name: 'John',
  age: 30,
  _cellsProps: { age: { align: 'right' } },
  _rowProps: { class: 'highlight' } }
*/
export interface GridRow {
  _cellsProps?: CellsProps;
  _rowProps?: RowProps;
  [key: string]: any; // other properties of the row from the list data, e.g. name, age, etc.
}

// table cell features
// they overide the column features for a specific cell,
//  e.g. to align a specific cell to the right, or to add a tooltip to a specific cell
export interface GridCell {
  rowspan?: ((row: any) => number) | Observable<number> | number;
  colspan?: ((row: any) => number) | Observable<number> | number;

  // data is the whole list data, row is the current row data, value is the cell value
  // can be used a mapper, it overides the column value for this cell, e.g. to format a date or number
  value?: ((row: any, data: any) => any) | Observable<any> | any;
  class?: ((row: any) => string) | Observable<string> | string;

  tooltip?: ((row: any) => string) | Observable<string> | string;
  tooltipPosition?: 'above' | 'below' | 'left' | 'right' | 'before' | 'after';
  tooltipClass?: string;

  // used to auto format the cell value, e.g. to format a date or number,
  type?:
    'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'currency' | 'percent' | 'html';
  align?: 'left' | 'center' | 'right';
  template?: any; // template / component to use for this cell, if any
  templateContext?: any; // context / component inputs for the template, if any

  click?: (row: any) => void;
  hover?: (row: any) => boolean;
  dClick?: (row: any) => void; // double click event handler
}

export interface CellsProps {
  [key: string]: GridCell;
}

export interface RowProps {
  // used to show a checkbox for this row, default is false
  showCheckbox?: boolean | ((row: any) => boolean); //
  // whether the checkbox is disabled for this row, default is false
  checkboxDisabled?: boolean | ((row: any) => boolean);

  class?: ((row: any) => string) | Observable<string> | string;
  tooltip?: ((row: any) => string) | Observable<string> | string;

  click?: (row: any) => void;
  hover?: (row: any) => boolean;
  dClick?: (row: any) => void; // double click event handler
}

export const GRID_COLUMN_PROPS = [
  'label',
  'sortable type(boolean)',
  'filterable type(boolean)',
  'width type(number)',
  'minWidth type(number)',
  'maxWidth type(number)',
  'headerProps.class',
  'type',
  'align',
  'class',
  'pinned',
  'resizable type(boolean)',
  'visible type(boolean)',
  'truncate type(number)',
  'contentClass',
  'icon',
  'iconclass',
  'columns type(stringArray)',
];
