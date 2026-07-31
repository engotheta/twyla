// data export

export type GridExportFormat = 'csv' | 'excel' | 'pdf';

export interface GridExportConfig<RowType = any> {
  /** default [] (export UI hidden) */
  formats?: GridExportFormat[];
  fileName?: string | (() => string);
  /** default false: export the current page only; true: fetch and export all matching rows */
  exportAllData?: boolean;
  /** default false: visible columns only */
  allFields?: boolean;
  /** always excluded regardless of `allFields` */
  hiddenKeys?: string[];
  /** preselected columns in an optional column-picker UI */
  initialKeys?: string[];

  mapRow?: (row: RowType) => Record<string, any>;
  onExport?: (format: GridExportFormat, rows: RowType[]) => void;

  /**
   * default false. When true, PDF and Excel export carry over the grid's own row/column
   * conditional formatting (`conditionalRowFormat`, `GridColumn_.conditionalFormat`) as real
   * cell background/text colors — resolved from Tailwind utility classes (palette lookup, plus
   * arbitrary `bg-[...]`/`text-[...]` values). CSV is unaffected (plain text can't carry style).
   * Classes that aren't resolvable to a color (layout/spacing utilities, custom CSS classes) are
   * silently ignored — this only ever adds color, never breaks the export.
   */
  matchGridStyle?: boolean;
}
