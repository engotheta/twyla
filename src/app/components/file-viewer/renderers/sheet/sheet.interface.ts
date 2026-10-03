/** One cell as the sheet table shows it. */
export interface SheetCell {
  text: string;
  /** inline CSS from the cell's own formatting (bold, colours, alignment…) */
  style?: string;
  /** numbers and dates align right unless the cell says otherwise */
  numeric?: boolean;
}

/** A merged range, 0-based. */
export interface SheetMerge {
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
}

/** A CSV file or one worksheet of a workbook, ready to render. */
export interface SheetData {
  name: string;
  /** sparse rows: `null` / missing entries are empty cells */
  rows: (SheetCell | null)[][];
  colCount: number;
  /** px, per column — undefined lets the browser size it */
  colWidths: (number | undefined)[];
  merges: SheetMerge[];
  /** stopped reading at `maxSheetCells` */
  truncated: boolean;
}
