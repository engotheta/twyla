// computed header-matrix types — engine OUTPUT, never authored directly by a consumer

import { GridColumn_ } from './grid-column.interface';

/**
 * One cell in the rendered header matrix, derived by walking `GridParameter.columns`
 * (the `GridColumn_.columns` nesting tree) at render time. A consumer never constructs these
 * directly — they only author the nested `columns` tree; the engine computes this.
 *
 * Leaf columns get `rowspan = (maxDepth - ownDepth + 1)` so they stretch down to the deepest
 * header row when sibling columns nest deeper. Group/parent columns get
 * `colspan = count of leaf descendants`.
 */
export interface GridHeaderCell<RowType = any> {
  label: string;
  colspan: number;
  rowspan: number;
  /** set only when `isLeaf` — the original column this header cell renders */
  column?: GridColumn_<RowType>;
  isLeaf: boolean;
}

/** one row of the rendered header matrix; `GridParameter.columns` produces `GridHeaderRow[]` */
export interface GridHeaderRow<RowType = any> {
  cells: GridHeaderCell<RowType>[];
}
