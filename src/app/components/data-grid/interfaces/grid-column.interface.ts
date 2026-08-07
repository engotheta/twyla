// column configuration: what a consumer authors, and the runtime layout state the grid tracks

import { TemplateRef } from '@angular/core';
import { ActionButton, DynamicValue } from '../../action-buttons/action-button.interface';
import { FormField } from '../../generic-form';
import { GridClassMap } from './grid-cell.interface';
import type { GridValueType } from '../helpers/grid-format.helpers';
import { SearchType } from './grid-search.interface';
import type { GridState } from './grid-state.interface';

/**
 * If a string, a `GridColumn_` is created with `key` as the string and other properties
 * extracted via the shorthand DSL (see `GRID_COLUMN_PROPS`) — same convention as `DataField`
 * on the Details component (`details/field/field.interface.ts`).
 */
export type GridColumn<RowType = any> = string | GridColumn_<RowType>;

export interface GridColumn_<RowType = any> {
  /** prop path used to access the value from the row data, e.g. 'age' or 'address.city' */
  key: string;

  label?: string;
  sortable?: boolean;
  /** compound multi-field search (GridState.searchFields) offers this column in its dropdown */
  searchable?: boolean;
  /** default searchType this column's search instance uses — see GridSearchConfig.defaultSearchType
   *  for the grid-wide fallback and the resolution order (grid-row.helpers.ts) */
  searchType?: SearchType;

  /**
   * Per-column override of `GridParameter.mergeCells`'s vertical (rowspan) auto-merge: when this
   * column has a streak of consecutive rows with the same resolved value, the first cell in the
   * streak spans them (rowspan) until the value changes. `true`/`false` here always wins over the
   * grid-wide `mergeCells` default for this column specifically; leave undefined to just follow
   * the grid-wide default.
   */
  mergeConsecutive?: boolean;

  width?: string; // e.g. '100px', '20%'
  minWidth?: string;
  maxWidth?: string;

  /** applies just to the header cell, not the whole column */
  headerProps?: {
    class?: string;
    buttons?: ActionButton<GridColumn_<RowType>>[];
  };
  /** action buttons rendered in this column's header cell — distinct from
   *  `headerProps.buttons` (data: the column); data passed to these is the grid's live
   *  GridState. */
  headerButtons?: ActionButton<GridState<RowType>>[];

  type?: GridValueType;
  align?: 'left' | 'center' | 'right';
  /** a component or template that will be used to render the cell for this column */
  template?: TemplateRef<unknown>;
  /** a function or object to provide context for the template — a row is always passed to the
   *  function, and the return value is passed to the template as context (in addition to
   *  `$implicit`, always the row, for `let-x` shorthand bindings). Omitted (only `template` set):
   *  falls back to `{ row, column, value }`. */
  templateContext?: ((row: RowType) => Record<string, unknown>) | Record<string, unknown>;
  /** a mapper function that takes a row and returns the value to be displayed in the cell —
   *  also feeds search/sort-merge/export (see `getCellValue`, helpers/grid-row.helpers.ts) */
  valueFn?: (row: RowType) => unknown;

  /** applies to all cells in the column, including the header cell */
  class?: DynamicValue<string, RowType>;

  pinned?: 'left' | 'right';
  resizable?: boolean;
  visible?: boolean;
  truncate?: number;

  /** class for each cell's content-wrapper div (holds the value, buttons, icon) */
  contentClass?: DynamicValue<string, RowType>;
  icon?: DynamicValue<string, RowType>;
  iconClass?: DynamicValue<string, RowType>;
  /** class for the rendered `<img>` when `type: 'imageUrl'` (the cell value is the image's URL) */
  imageClass?: DynamicValue<string, RowType>;

  /** action buttons rendered in this column's body cell, alongside its value. Data passed to
   *  each button is the row. */
  buttons?: ActionButton<RowType>[];

  /** inline cell editing (see GridEditingConfig): whether cells in this column are editable */
  editable?: DynamicValue<boolean, RowType>;
  /** reuses generic-form's FormField as the editor control descriptor when a cell is edited */
  editField?: FormField;

  /** per-row class predicates applied to every cell in this column, e.g. highlight overdue amounts */
  conditionalFormat?: GridClassMap<RowType>;

  /**
   * Nested/grouped headers, object form ONLY — deliberately typed as `GridColumn_[]`, not
   * `GridColumn[]`, since a nested header tree isn't expressible via the string shorthand (see
   * `GRID_COLUMN_PROPS`). E.g. 'address.city' and 'address.state' as children of an 'address'
   * column renders 'address' as a header cell spanning both, with 'city'/'state' beneath it.
   * Nesting can go arbitrarily deep. The engine computes the resulting header row/col spans —
   * see `GridHeaderRow`/`GridHeaderCell` in `grid-header.interface.ts`.
   */
  columns?: GridColumn_<RowType>[];
}

/** runtime column layout — distinct from the static `GridColumn_` config the consumer authors */
export interface GridColumnState {
  /** the GridColumn_.key this entry describes */
  key: string;
  order: number;
  visible: boolean;
  width?: string;
  pinned?: 'left' | 'right';
}

/**
 * Props extractable from a `GridColumn` shorthand string, parsed via `propsFromString` from
 * `details/field/field-string.helpers.ts` (reused, not reimplemented). `columns` is deliberately
 * excluded — nested/grouped header trees are object-form only, since flattening an
 * arbitrary-depth tree into one string isn't practical. Object/function-valued props
 * (`headerProps`, `template`, `templateContext`, `editField`, `conditionalFormat`) are excluded
 * because they aren't string-expressible; `DynamicValue` props (`contentClass`/`icon`/
 * `iconClass`/`imageClass`/`editable`) are reachable via the DSL only for their plain-value variant.
 *
 * The label also supports the Details field-string `'<key> as <Label>'` alias (via the shared
 * `labelFromFieldString`, `details/field/field-labels.helpers.ts`) as a shorthand for the more
 * verbose `label(...)` prop — e.g. `'department as Department Name'`. An explicit `label(...)`
 * prop still wins if both are present.
 */
export const GRID_COLUMN_PROPS = [
  'label',
  'sortable type(boolean)',
  'searchable type(boolean)',
  'width',
  'minWidth',
  'maxWidth',
  'type',
  'align',
  'class',
  'pinned',
  'resizable type(boolean)',
  'visible type(boolean)',
  'editable type(boolean)',
  'truncate type(number)',
  'contentClass',
  'columns type(stringArray)', // nested/grouped headers, object form only
  'icon',
  'iconClass',
  'imageClass',
];
