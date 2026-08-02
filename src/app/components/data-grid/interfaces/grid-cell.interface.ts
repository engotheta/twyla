// per-row and per-cell override features (rendered on top of the column's own config)

import { TemplateRef } from '@angular/core';
import { Observable } from 'rxjs';
import { ActionButton, DynamicValue } from '../../action-buttons/action-button.interface';
import type { GridValueType } from '../helpers/grid-format.helpers';

/**
 * Independent class-predicate map: every entry whose predicate returns true contributes its
 * key (a class name) to the row/cell — entries stack rather than override each other, so
 * independent visual signals (e.g. a color class + a font-weight class + an icon class) can
 * compose freely. Used for `GridParameter.rowFormatter` and
 * `GridColumn_.conditionalFormat`.
 */
export type GridClassMap<RowType = any> = Record<string, (row: RowType, index?: number) => boolean>;

/**
 * Per-cell override of the owning column's config, keyed by column key on `GridRow._cellsProps`.
 * Anything set here wins over the column-level equivalent for this one cell.
 */
export interface GridCell<RowType = any> {
  rowspan?: DynamicValue<number, RowType>;
  colspan?: DynamicValue<number, RowType>;

  // Exception to the DynamicValue<T,D> convention used everywhere else in this file:
  // `value` is resolved with the ROW *and* the full data list, since a cell's display value
  // sometimes depends on other rows (e.g. a running total). DynamicValue<T,D> only models a
  // single-arg resolver, so it doesn't fit here — this is deliberate, not an inconsistency.
  value?: ((row: RowType, data: RowType[]) => any) | Observable<any> | any;

  class?: DynamicValue<string, RowType>;

  tooltip?: DynamicValue<string, RowType>;
  tooltipPosition?: 'above' | 'below' | 'left' | 'right' | 'before' | 'after';
  tooltipClass?: string;

  type?: GridValueType;
  align?: 'left' | 'center' | 'right';
  /** per-cell override of the column's `template` */
  template?: TemplateRef<unknown>;
  /** per-cell override of the column's `templateContext` — see `GridColumn_.templateContext` */
  templateContext?: ((row: RowType) => Record<string, unknown>) | Record<string, unknown>;

  /** per-cell override of the column's `editable` (inline cell editing) */
  editable?: DynamicValue<boolean, RowType>;

  /** per-cell override of the column's `buttons` */
  buttons?: ActionButton<RowType>[];

  click?: (row: RowType) => void;
  hover?: (row: RowType) => boolean;
  dClick?: (row: RowType) => void;
}

export interface CellsProps<RowType = any> {
  [columnKey: string]: GridCell<RowType>;
}

/**
 * Usage: embedded in each item of the list/data passed to the grid, e.g.
 * `{ name: 'John', age: 30, _cellsProps: { age: { align: 'right' } }, _rowProps: { class: 'highlight' } }`
 */
export interface GridRow<RowType = any> {
  _cellsProps?: CellsProps<RowType>;
  _rowProps?: RowProps<RowType>;
  [key: string]: any;
}

export interface RowProps<RowType = any> {
  /** shows a checkbox for this row; only meaningful when `GridParameter.selectionMode !== 'none'` */
  showCheckbox?: DynamicValue<boolean, RowType>;
  checkboxDisabled?: DynamicValue<boolean, RowType>;

  /**
   * Horizontal (colspan) analog of `GridColumn_.mergeConsecutive`, scoped to THIS row: scans
   * this row's real columns left to right for a streak of consecutive columns with the same
   * resolved value — the first cell in the streak spans them (colspan) until the value changes.
   * Not a grid-wide default (unlike vertical merge's `GridParameter.mergeCells`) — set per row
   * that actually needs it. Manual `_cellsProps` overrides still win over this.
   */
  mergeConsecutive?: boolean;

  class?: DynamicValue<string, RowType>;
  tooltip?: DynamicValue<string, RowType>;

  click?: (row: RowType) => void;
  hover?: (row: RowType) => boolean;
  dClick?: (row: RowType) => void;
}
