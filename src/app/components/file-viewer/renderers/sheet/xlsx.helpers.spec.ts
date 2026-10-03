import {
  columnLabel,
  formatExcelDate,
  formatNumber,
  parseRange,
  readWorkbook,
} from './xlsx.helpers';

describe('xlsx helpers', () => {
  it('formats numbers the way their format says', () => {
    expect(formatNumber(1234.5, '#,##0.00')).toBe('1,234.50');
    expect(formatNumber(0.257, '0.0%')).toBe('25.7%');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(42, '"TZS "#,##0')).toBe('TZS 42');
    expect(formatNumber(45474, 'yyyy-mm-dd')).toBe('2024-07-01'); // a date stored as a serial number
  });

  it('applies Excel date formats, minutes vs months included', () => {
    const date = new Date(Date.UTC(2026, 0, 5, 14, 7, 9));
    expect(formatExcelDate(date, 'yyyy-mm-dd')).toBe('2026-01-05');
    expect(formatExcelDate(date, 'd mmm yyyy')).toBe('5 Jan 2026');
    expect(formatExcelDate(date, 'hh:mm:ss')).toBe('14:07:09');
    expect(formatExcelDate(date, 'h:mm AM/PM')).toBe('2:07 PM');
    expect(formatExcelDate(date, '[$-409]dddd, mmmm d')).toBe('Monday, January 5');
  });

  it('parses ranges and labels columns', () => {
    expect(parseRange('B2:D4')).toEqual({ row: 1, col: 1, rowspan: 3, colspan: 3 });
    expect(parseRange('$A$1')).toEqual({ row: 0, col: 0, rowspan: 1, colspan: 1 });
    expect([0, 25, 26, 701, 702].map(columnLabel)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA']);
  });

  it('reads visible sheets: values, formats, merges, widths and styles', async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sales');
    ws.addRow(['Title']);
    ws.mergeCells('A1:C1');
    ws.addRow(['Region', 'Revenue', 'Closed']);
    ws.getRow(2).font = { bold: true };
    ws.addRow(['Arusha', 1234.5, new Date(Date.UTC(2026, 6, 1))]);
    ws.getCell('B3').numFmt = '#,##0.00';
    ws.getCell('C3').numFmt = 'yyyy-mm-dd';
    ws.addRow(['Total', { formula: 'B3*2', result: 2469 }]);
    ws.getColumn(1).width = 20;
    wb.addWorksheet('Hidden', { state: 'hidden' });
    const buffer = await wb.xlsx.writeBuffer();

    const sheets = await readWorkbook(buffer as ArrayBuffer, 1000);
    expect(sheets.map((s) => s.name)).toEqual(['Sales']);
    const [sales] = sheets;
    expect(sales.merges).toEqual([{ row: 0, col: 0, rowspan: 1, colspan: 3 }]);
    expect(sales.rows[2].map((c) => c?.text)).toEqual(['Arusha', '1,234.50', '2026-07-01']);
    expect(sales.rows[2][1]?.numeric).toBe(true);
    expect(sales.rows[3][1]?.text).toBe('2469');
    expect(sales.rows[1][0]?.style).toContain('font-weight:600');
    expect(sales.colWidths[0]).toBe(145);
    expect(sales.truncated).toBe(false);
  }, 30_000);

  it('stops reading at the cell budget', async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Big');
    for (let i = 0; i < 50; i++) ws.addRow([i, i * 2]);
    const [big] = await readWorkbook((await wb.xlsx.writeBuffer()) as ArrayBuffer, 20);
    expect(big.rows.length).toBe(10);
    expect(big.truncated).toBe(true);
  }, 30_000);
});
