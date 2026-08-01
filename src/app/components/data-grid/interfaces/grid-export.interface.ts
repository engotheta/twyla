// data export

export type GridExportFormat = 'csv' | 'excel' | 'pdf';

export interface GridExportConfig<RowType = any> {
  /** default [] (export UI hidden) */
  formats?: GridExportFormat[];
  fileName?: string | (() => string);
  /** default true: fetch and export every matching row; set false to export the current page only */
  exportAllData?: boolean;
  /** default false: visible columns only. Only affects the fallback path when the export column
   *  picker (`grid-export-panel`) is bypassed entirely — normally its own selection wins. */
  allFields?: boolean;
  /** always excluded regardless of `allFields` */
  hiddenKeys?: string[];
  /** preselects (and orders) these keys in `grid-export-panel`'s column picker, instead of the
   *  picker's own default (the grid's current visible columns, in their current order) */
  initialKeys?: string[];

  mapRow?: (row: RowType) => Record<string, any>;
  onExport?: (format: GridExportFormat, rows: RowType[]) => void;

  /**
   * default false. When true, PDF and Excel export carry over the grid's own row/column
   * conditional formatting (`rowFormatter`, `GridColumn_.conditionalFormat`) as real
   * cell background/text colors — resolved from Tailwind utility classes (palette lookup, plus
   * arbitrary `bg-[...]`/`text-[...]` values). CSV is unaffected (plain text can't carry style).
   * Classes that aren't resolvable to a color (layout/spacing utilities, custom CSS classes) are
   * silently ignored — this only ever adds color, never breaks the export.
   */
  matchGridStyle?: boolean;
}
