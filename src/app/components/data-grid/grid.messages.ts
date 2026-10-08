import { defineMessages } from '@services/i18n/message-bundle';
import { GRID_SW } from './grid.messages.sw';
import type { GridSearchOperatorText } from './helpers/grid-search-bar.constants';
import type { GridFilterOperator } from './interfaces/grid-filter.interface';
import type { GridSelectionMode } from './interfaces/grid-parameter.interface';
import type { GridRenderMode } from './interfaces/grid-render-mode.interface';
import type { SearchType } from './interfaces/grid-search.interface';

/** how each operator reads in the unified search bar: symbols where one is universally read
 *  (`=`, `>`…), plain words for the rest */
const OPERATORS: Record<GridFilterOperator, GridSearchOperatorText> = {
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

/** the classic search fields' operator dropdown */
const SEARCH_TYPES: Record<SearchType, string> = {
  equals: 'Equals',
  notEquals: 'Not equals',
  like: 'Contains',
  in: 'In',
  notIn: 'Not in',
  greaterThan: 'Greater than',
  greaterThanOrEqual: 'Greater than or equal',
  lessThan: 'Less than',
  lessThanOrEqual: 'Less than or equal',
  between: 'Between',
  isNull: 'Is empty',
  isNotNull: 'Is not empty',
};

const MODES: Record<GridRenderMode, string> = {
  table: 'Table',
  list: 'List',
  cards: 'Cards',
};

/** how rows are selected, as the Row selection shortcut says where it stands */
const SELECTION_MODES: Record<GridSelectionMode, string> = {
  none: 'Off',
  single: 'One row',
  multiple: 'Several rows',
};

export const GRID_EN = {
  loading: 'Loading rows',
  /** the header of the row buttons' column */
  actions: 'Actions',
  /** the title of the dialog a row's details open in */
  details: 'Details',
  /** the empty grid: "No Employees found" */
  noResults: (label: string | undefined) => `No ${label ?? 'results'} found`,
  reload: 'Reload',

  rows: {
    reorder: 'Reorder rows',
    selectAll: 'Select all rows on this page',
    select: 'Select row',
    number: 'Row number',
    expand: 'Expand row',
    drag: 'Drag to reorder row',
    toggleDetail: 'Toggle row detail',
  },

  cell: {
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
  },

  /** how a boolean cell reads, on screen and in an export */
  format: {
    yes: 'Yes',
    no: 'No',
  },

  toolbar: {
    viewOptions: 'Grid view options',
    filters: 'Filters',
    displayMode: 'Display mode',
    modes: MODES,
    export: 'Export',
    columnSettings: 'Column settings',
  },

  columns: {
    panel: 'Column visibility, order, and pinning',
    dragToReorder: (column: string) => `Drag to reorder ${column}`,
    moveUp: (column: string) => `Move ${column} up`,
    moveDown: (column: string) => `Move ${column} down`,
    pinnedLeft: 'Pinned left — click to pin right',
    pinnedRight: 'Pinned right — click to unpin',
    notPinned: 'Not pinned — click to pin left',
    reset: 'Reset columns',
    addFromData: 'Add columns from data',
    scanning: 'Scanning…',
  },

  export: {
    /** the column picker's title: "Choose columns to export (PDF)" */
    title: (format: string) => `Choose columns to export (${format})`,
    selectAll: 'Select all',
    selectNone: 'Select none',
    panel: 'Columns to export, order, and inclusion',
    selected: (count: number, total: number) => `${count} of ${total} columns selected.`,
    cancel: 'Cancel',
    confirm: 'Export',
    /** the worksheet's name in an Excel export */
    sheet: 'Sheet1',
  },

  filters: {
    apply: 'Apply',
    clear: 'Clear',
    /** a filter its validators refuse, when they say no more */
    invalid: 'Invalid',
  },

  /** the unified search bar (SPEC.md §12) */
  search: {
    placeholder: {
      search: 'Search…',
      searchOrFilter: 'Search or filter…',
      filter: 'Filter…',
    },
    /** the bar's landmark: "Search Employees" */
    region: (label: string | undefined) => (label ? `Search ${label}` : 'Search'),
    clear: 'Clear',
    clearSearch: 'Clear search',
    search: 'Search',
    /** the list under a part: "Department suggestions" */
    suggestions: (label: string) => `${label} suggestions`,
    loading: 'Loading…',

    /** the parts of a token, named for what each holds */
    part: {
      field: (title: string) => `${title}, field`,
      operator: (title: string) => `${title}, operator`,
      value: (title: string) => `${title}, value`,
      text: 'Search text',
    },
    /** what clicking a part does; `name` is the whole token said in full */
    change: {
      field: (name: string) => `Change the field of ${name}`,
      operator: (name: string) => `Change the operator of ${name}`,
      value: (name: string) => `Change the value of ${name}`,
      text: (text: string) => `Change the text ${text}`,
    },
    remove: (name: string) => `Remove ${name}`,

    // what a screen reader hears
    added: (name: string) => `Added ${name}`,
    changedTo: (name: string) => `Changed to ${name}`,
    removed: (name: string) => `Removed ${name}`,
    cleared: 'Search cleared',

    /** the list row that turns the typed text into a free-text pill — GitLab's wording */
    textOption: 'Search for this text',
    /** the two headings of the field list */
    columnsGroup: 'Columns',
    filtersGroup: 'Filters',
    /** a free-text pill, said in full */
    textPill: (value: string) => `Text: ${value}`,
    yes: 'Yes',
    no: 'No',
    operators: OPERATORS,
  },

  /** the classic search fields (`unifiedSearch: false`) */
  classic: {
    removeField: 'Remove search field',
    fineTune: 'Fine-tune search operator',
    viewAll: 'View all search fields',
    addField: 'Add search field',
    clearSearch: 'Clear search',
    dialogTitle: 'Search',
    column: 'Column',
    value: 'Value…',
    search: 'Search…',
    operator: 'Operator',
    types: SEARCH_TYPES,
  },

  /** the grid's keyboard shortcuts (`grid.shortcuts.ts`, SPEC.md §14): what each key switches */
  shortcuts: {
    scope: 'Data grid',
    toolbar: 'Toolbar',
    search: 'Search',
    unifiedSearch: 'One search bar',
    filters: 'Filters',
    paginator: 'Paginator',
    columnSettings: 'Column settings',
    indexColumn: 'Row numbers',
    selection: 'Row selection',
    selectionModes: SELECTION_MODES,
    view: 'View',
    mergeCells: 'Merge equal cells',
    resizable: 'Resizable columns',
    export: 'Export',
    addColumns: 'Adding columns from data',
    reload: 'Reload',
    rowDetails: 'Details of the row last clicked',
    reset: 'Back to how it was set up',
  },
};

export type GridMessages = typeof GRID_EN;
/** the unified search bar's text — what its pure helpers take */
export type GridSearchText = GridMessages['search'];

export const GRID_MESSAGES = defineMessages('data-grid', GRID_EN, { sw: GRID_SW });
