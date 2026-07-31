import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import {
  buildCellSpanPlan,
  CellSpan,
  GridInstance,
  SYNTHETIC_COLUMN_KEYS,
} from './grid-engine.service';
import { buildHeaderRows, orderColumnsForHeader } from './grid-column.helpers';
import { GridColumn_ } from './grid-column.interface';
import { GridExportConfig, GridExportFormat } from './grid-export.interface';
import { formatCellValue } from './grid-format.helpers';
import { GridHeaderRow } from './grid-header.interface';
import { GridParameter } from './grid-parameter.interface';
import { getCellValue } from './grid-row.helpers';
import { ResolvedGridStyle, resolveCellStyle, resolveRowStyle } from './grid-style.helpers';

/** thin gridlines on every exported Excel cell — exceljs never adds cell borders on its own
 *  (unlike jspdf-autotable's default theme), so without this the sheet renders borderless. A
 *  light gray (e.g. D0D0D0) is nearly indistinguishable from Excel's own default sheet
 *  gridlines at normal zoom — this needs to be visibly darker to read as a deliberate border. */
const EXCEL_CELL_BORDER = { style: 'thin', color: { argb: 'FF999999' } } as const;

/** CSV is hand-rolled (zero dependencies); Excel (`exceljs`) and PDF (`jspdf`/`jspdf-autotable`) are dynamically imported on demand, so they never touch the initial bundle. */
@Injectable({ providedIn: 'root' })
export class GridExportService {
  private readonly document = inject(DOCUMENT);

  async export<RowType = any>(format: GridExportFormat, instance: GridInstance<RowType>): Promise<void> {
    const cfg = instance.params.export;
    const rows = cfg?.exportAllData ? await instance.getAllRows() : instance.rows();
    const columns = this.resolveColumns(instance, cfg);
    const records = cfg?.mapRow ? rows.map(cfg.mapRow) : rows.map((row) => this.rowToRecord(row, columns));
    const fileName = this.resolveFileName(cfg, format);
    const styles =
      cfg?.matchGridStyle && format !== 'csv' ? this.resolveStyles(rows, columns, instance.params) : undefined;

    if (format === 'csv') {
      this.downloadCsv(records, fileName);
    } else {
      // Recomputed fresh against THIS export's own row/column set (not read off `instance.cellSpan()`,
      // which is only ever populated for the current page's VISIBLE columns) — correct for both the
      // current-page case and `exportAllData`/`allFields`, not just a special case of one of them.
      const headerRows = this.resolveHeaderRows(instance, columns);
      const bodyPlan = buildCellSpanPlan(rows, columns, !!instance.params.mergeCells);
      if (format === 'excel') await this.downloadExcel(records, columns, headerRows, bodyPlan, fileName, styles);
      else await this.downloadPdf(records, columns, headerRows, bodyPlan, fileName, styles);
    }

    cfg?.onExport?.(format, rows);
  }

  private resolveColumns(instance: GridInstance<any>, cfg?: GridExportConfig): GridColumn_[] {
    const source = cfg?.allFields ? instance.leafColumns() : instance.visibleColumns();
    const hidden = new Set(cfg?.hiddenKeys ?? []);
    return source.filter((col) => !SYNTHETIC_COLUMN_KEYS.has(col.key) && !hidden.has(col.key));
  }

  /** the nested-header span matrix for exactly the columns being exported — reuses the same
   *  pure functions the live grid renders from (`orderColumnsForHeader` + `buildHeaderRows`), so
   *  header order/spans are guaranteed consistent with what's on screen (drag-reordered columns
   *  included), correctly pruned to `columns` either way (`allFields` or visible-only). */
  private resolveHeaderRows(instance: GridInstance<any>, columns: GridColumn_[]): GridHeaderRow[] {
    const visibleKeys = new Set(columns.map((c) => c.key));
    const orderByKey = new Map(instance.columnState().map((s) => [s.key, s.order]));
    return buildHeaderRows(orderColumnsForHeader(instance.columns(), orderByKey), visibleKeys);
  }

  private rowToRecord<RowType>(row: RowType, columns: GridColumn_<RowType>[]): Record<string, any> {
    const record: Record<string, any> = {};
    for (const col of columns) record[col.label ?? col.key] = formatCellValue(getCellValue(row, col), col.type);
    return record;
  }

  /** per row, per column (same order as `columns`) — resolved from `conditionalRowFormat`/`GridColumn_.conditionalFormat`/`rowClass`/`column.class` */
  private resolveStyles<RowType>(
    rows: RowType[],
    columns: GridColumn_<RowType>[],
    params: GridParameter<RowType>,
  ): ResolvedGridStyle[][] {
    return rows.map((row) => {
      const rowStyle = resolveRowStyle(row, params.conditionalRowFormat, params.rowClass);
      return columns.map((col) => resolveCellStyle(row, col, rowStyle));
    });
  }

  private resolveFileName(cfg: GridExportConfig | undefined, format: GridExportFormat): string {
    const name = typeof cfg?.fileName === 'function' ? cfg.fileName() : cfg?.fileName;
    return name ?? `export-${format}-${Date.now()}`;
  }

  private downloadCsv(rows: Record<string, any>[], fileName: string): void {
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const escape = (value: any): string => {
      const s = value == null ? '' : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))];
    this.download(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
  }

  private async downloadExcel(
    rows: Record<string, any>[],
    columns: GridColumn_[],
    headerRows: GridHeaderRow[],
    bodyPlan: Record<string, CellSpan>[],
    fileName: string,
    styles: ResolvedGridStyle[][] | undefined,
  ): Promise<void> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.columns = columns.map((c) => ({ key: c.label ?? c.key, width: 18 }));

    const headerDepth = this.writeExcelHeaderRows(sheet, headerRows);

    rows.forEach((row, ri) => {
      const excelRowIndex = headerDepth + ri + 1;
      const rowStyles = styles?.[ri];
      columns.forEach((col, ci) => {
        const span = bodyPlan[ri]?.[col.key];
        if (span?.hidden) return; // covered by an earlier row/column's merge — nothing to write
        const colIndex = ci + 1;
        const cell = sheet.getCell(excelRowIndex, colIndex);
        cell.value = row[col.label ?? col.key];
        cell.border = {
          top: EXCEL_CELL_BORDER,
          left: EXCEL_CELL_BORDER,
          bottom: EXCEL_CELL_BORDER,
          right: EXCEL_CELL_BORDER,
        };
        if (span && (span.rowspan > 1 || span.colspan > 1)) {
          sheet.mergeCells(excelRowIndex, colIndex, excelRowIndex + span.rowspan - 1, colIndex + span.colspan - 1);
        }
        const style = rowStyles?.[ci];
        if (!style) return;
        if (style.background) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: this.toArgb(style.background) } };
        if (style.color || style.bold) cell.font = { ...cell.font, color: style.color ? { argb: this.toArgb(style.color) } : cell.font?.color, bold: style.bold ?? cell.font?.bold };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    this.download(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${fileName}.xlsx`,
    );
  }

  /**
   * Writes the (possibly multi-row, nested) header matrix and merges grouped/spanned header
   * cells. `GridHeaderRow.cells` is sparse per row (a cell reaching down via `rowspan` from an
   * earlier row isn't repeated), same convention as an HTML `<tr>` — so an "occupied" column
   * tracker is needed to compute each cell's absolute column position, mirroring what the
   * browser's table layout algorithm does for free when the live grid renders `<th>`s. Returns
   * the header depth (row count) so body rows know where to start.
   */
  private writeExcelHeaderRows(sheet: import('exceljs').Worksheet, headerRows: GridHeaderRow[]): number {
    const occupiedUntilRow: number[] = []; // index = col - 1; value = last 0-based row index still covered
    headerRows.forEach((headerRow, ri) => {
      let col = 1;
      for (const cell of headerRow.cells) {
        while ((occupiedUntilRow[col - 1] ?? -1) >= ri) col++;
        const excelCell = sheet.getCell(ri + 1, col);
        excelCell.value = cell.label;
        excelCell.font = { bold: true };
        excelCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        excelCell.border = {
          top: EXCEL_CELL_BORDER,
          left: EXCEL_CELL_BORDER,
          bottom: EXCEL_CELL_BORDER,
          right: EXCEL_CELL_BORDER,
        };
        if (cell.rowspan > 1 || cell.colspan > 1) {
          sheet.mergeCells(ri + 1, col, ri + cell.rowspan, col + cell.colspan - 1);
        }
        if (cell.rowspan > 1) {
          for (let c = col; c < col + cell.colspan; c++) occupiedUntilRow[c - 1] = ri + cell.rowspan - 1;
        }
        col += cell.colspan;
      }
    });
    return headerRows.length || 1;
  }

  private async downloadPdf(
    rows: Record<string, any>[],
    columns: GridColumn_[],
    headerRows: GridHeaderRow[],
    bodyPlan: Record<string, CellSpan>[],
    fileName: string,
    styles: ResolvedGridStyle[][] | undefined,
  ): Promise<void> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF();

    // Sparse per-row CellDef arrays: a cell covered by a previous row's rowSpan, or by an
    // earlier cell's colSpan, is simply omitted — jspdf-autotable resolves absolute column
    // positions from rowSpan/colSpan the same way an HTML table does, matching how
    // `GridHeaderRow.cells`/`bodyPlan`'s `hidden` cells are already structured.
    const head = headerRows.map((headerRow) =>
      headerRow.cells.map((cell) => ({
        content: cell.label,
        rowSpan: cell.rowspan > 1 ? cell.rowspan : undefined,
        colSpan: cell.colspan > 1 ? cell.colspan : undefined,
      })),
    );
    const body = rows.map((row, ri) =>
      columns
        .map((col, ci) => ({ col, ci, span: bodyPlan[ri]?.[col.key] }))
        .filter(({ span }) => !span?.hidden)
        .map(({ col, span }) => ({
          content: String(row[col.label ?? col.key] ?? ''),
          rowSpan: span && span.rowspan > 1 ? span.rowspan : undefined,
          colSpan: span && span.colspan > 1 ? span.colspan : undefined,
        })),
    );

    autoTable(doc, {
      head,
      body,
      // default theme ('striped') only borders the header — 'grid' draws a border around every
      // cell, matching the on-screen table's gridlines
      theme: 'grid',
      styles: { lineColor: [208, 208, 208], lineWidth: 0.1 },
      didParseCell: styles
        ? (data) => {
            if (data.section !== 'body') return;
            const style = styles[data.row.index]?.[data.column.index];
            if (!style) return;
            if (style.background) data.cell.styles.fillColor = this.hexToRgbTuple(style.background);
            if (style.color) data.cell.styles.textColor = this.hexToRgbTuple(style.color);
            if (style.bold) data.cell.styles.fontStyle = 'bold';
          }
        : undefined,
    });
    doc.save(`${fileName}.pdf`);
  }

  private toArgb(hex: string): string {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    return 'FF' + full.toUpperCase();
  }

  private hexToRgbTuple(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
