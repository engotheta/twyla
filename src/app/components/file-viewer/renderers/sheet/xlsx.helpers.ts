import type { Alignment, Cell, CellValue, Fill, Font, Worksheet } from 'exceljs';
import { SheetCell, SheetData, SheetMerge } from './sheet.interface';

/** Excel column width (characters) → px, the way Excel itself roughly maps it */
const CHAR_PX = 7;
const PADDING_PX = 5;

/**
 * Reads an .xlsx workbook into `SheetData`s — visible sheets only. Values are shown the way Excel
 * shows them where that's cheap to do: formula results, rich text, hyperlinks, dates, and the
 * common number formats (decimals, thousands, percent, a currency prefix). Merges, column widths
 * and basic formatting (bold/italic/underline, alignment, wrap, solid fill, font colour) carry over.
 * Theme / indexed colours and conditional formats don't.
 */
export async function readWorkbook(data: ArrayBuffer, maxCells: number): Promise<SheetData[]> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);

  let budget = maxCells;
  const sheets: SheetData[] = [];
  for (const ws of workbook.worksheets) {
    if (ws.state && ws.state !== 'visible') continue;
    const sheet = readWorksheet(ws, budget);
    budget = Math.max(0, budget - sheet.rows.length * Math.max(1, sheet.colCount));
    sheets.push(sheet);
  }
  return sheets;
}

function readWorksheet(ws: Worksheet, maxCells: number): SheetData {
  const colCount = Math.max(0, ws.columnCount);
  const rowCount = Math.max(0, ws.rowCount);
  const maxRows = colCount ? Math.max(1, Math.floor(maxCells / colCount)) : rowCount;
  const readRows = Math.min(rowCount, maxRows);

  const rows: (SheetCell | null)[][] = [];
  for (let r = 1; r <= readRows; r++) {
    const row = ws.findRow(r);
    const cells: (SheetCell | null)[] = [];
    row?.eachCell({ includeEmpty: false }, (cell, col) => {
      if (cell.isMerged && cell.master !== cell) return; // covered by its merge's top-left cell
      cells[col - 1] = toSheetCell(cell);
    });
    rows.push(cells);
  }

  const colWidths: (number | undefined)[] = [];
  for (let c = 1; c <= colCount; c++) {
    const width = ws.getColumn(c).width;
    colWidths.push(width ? Math.round(width * CHAR_PX + PADDING_PX) : undefined);
  }

  return {
    name: ws.name,
    rows,
    colCount,
    colWidths,
    merges: (ws.model.merges ?? []).map(parseRange).filter((m): m is SheetMerge => !!m),
    truncated: readRows < rowCount,
  };
}

function toSheetCell(cell: Cell): SheetCell | null {
  const { text, numeric } = formatValue(cell.value, cell.numFmt);
  const style = cellStyle(cell.font, cell.fill, cell.alignment);
  if (!text && !style) return null;
  return { text, numeric, style: style || undefined };
}

function formatValue(
  value: CellValue,
  numFmt: string | undefined,
): { text: string; numeric?: boolean } {
  if (value === null || value === undefined) return { text: '' };
  if (value instanceof Date) return { text: formatDate(value, numFmt), numeric: true };
  if (typeof value === 'number') return { text: formatNumber(value, numFmt), numeric: true };
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE' };
  if (typeof value === 'string') return { text: value };
  if (typeof value === 'object') {
    if ('richText' in value) return { text: value.richText.map((part) => part.text).join('') };
    if ('error' in value) return { text: String(value.error) };
    if ('formula' in value || 'sharedFormula' in value) {
      const result = (value as { result?: unknown }).result;
      return formatValue(
        (result && typeof result === 'object' && 'error' in result
          ? (result as { error: string }).error
          : result) as CellValue,
        numFmt,
      );
    }
    if ('hyperlink' in value) {
      const text = (value as { text?: unknown }).text;
      return typeof text === 'object' && text && 'richText' in text
        ? formatValue(text as CellValue, numFmt)
        : { text: String(text ?? value.hyperlink) };
    }
  }
  return { text: String(value) };
}

/** a number as its format would show it — General, fixed decimals, thousands, percent, currency prefix */
export function formatNumber(value: number, numFmt?: string): string {
  const fmt = (numFmt ?? '').split(';')[0];
  if (!fmt || /^general$/i.test(fmt)) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(10)));
  }
  const decimals = /0\.(0+)/.exec(fmt)?.[1].length ?? (/\.#+/.test(fmt) ? undefined : 0);
  if (fmt.includes('%')) return `${(value * 100).toFixed(decimals ?? 0)}%`;
  if (isDateFormat(fmt)) return formatDate(excelSerialToDate(value), fmt);

  const grouped = fmt.includes(',');
  const body = value.toLocaleString('en-US', {
    useGrouping: grouped,
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 10,
  });
  const prefix = /"([^"]+)"\s*#|^\[\$([^\]-]+)/.exec(fmt);
  const symbol = prefix?.[1] ?? prefix?.[2] ?? /^[$€£¥]/.exec(fmt)?.[0] ?? '';
  return symbol + body;
}

function isDateFormat(fmt: string): boolean {
  const bare = fmt.replace(/"[^"]*"|\[[^\]]*]|\\./g, '');
  return /[dmyhs]/i.test(bare) && !/[#0]/.test(bare);
}

/** Excel's serial day number (1900 date system) → a UTC date */
function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function formatDate(date: Date, numFmt?: string): string {
  if (numFmt && isDateFormat(numFmt)) return formatExcelDate(date, numFmt.split(';')[0]);
  const hasTime = date.getUTCHours() || date.getUTCMinutes() || date.getUTCSeconds();
  // exceljs reads Excel's zone-less dates as UTC — show them as written, not shifted to local time
  return hasTime
    ? date.toLocaleString(undefined, { timeZone: 'UTC' })
    : date.toLocaleDateString(undefined, { timeZone: 'UTC' });
}

const DATE_TOKENS =
  /"[^"]*"|\\.|\[[^\]]*]|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|am\/pm|A\/P|a\/p|./gi;

/** an Excel date format (`yyyy-mm-dd`, `d mmm yyyy`, `h:mm AM/PM`…) applied to a UTC date */
export function formatExcelDate(date: Date, fmt: string): string {
  const tokens = fmt.match(DATE_TOKENS) ?? [];
  const twelveHour = tokens.some((t) => /^(am\/pm|a\/p)$/i.test(t));
  const hours = date.getUTCHours();
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = (style: 'long' | 'short' | 'narrow') =>
    date.toLocaleString('en-US', { month: style, timeZone: 'UTC' });
  const weekday = (style: 'long' | 'short') =>
    date.toLocaleString('en-US', { weekday: style, timeZone: 'UTC' });

  return tokens
    .map((token, i) => {
      const lower = token.toLowerCase();
      // m / mm mean minutes right after an hour or right before seconds
      const isMinute =
        (lower === 'm' || lower === 'mm') &&
        (/^h/.test(previousCode(tokens, i)) || /^s/.test(nextCode(tokens, i)));
      if (isMinute)
        return lower === 'mm' ? pad(date.getUTCMinutes()) : String(date.getUTCMinutes());
      switch (lower) {
        case 'yyyy':
          return String(date.getUTCFullYear());
        case 'yy':
          return pad(date.getUTCFullYear() % 100);
        case 'mmmmm':
          return month('narrow');
        case 'mmmm':
          return month('long');
        case 'mmm':
          return month('short');
        case 'mm':
          return pad(date.getUTCMonth() + 1);
        case 'm':
          return String(date.getUTCMonth() + 1);
        case 'dddd':
          return weekday('long');
        case 'ddd':
          return weekday('short');
        case 'dd':
          return pad(date.getUTCDate());
        case 'd':
          return String(date.getUTCDate());
        case 'hh':
          return pad(twelveHour ? hours % 12 || 12 : hours);
        case 'h':
          return String(twelveHour ? hours % 12 || 12 : hours);
        case 'ss':
          return pad(date.getUTCSeconds());
        case 's':
          return String(date.getUTCSeconds());
        case 'am/pm':
          return hours < 12 ? 'AM' : 'PM';
        case 'a/p':
          return hours < 12 ? 'A' : 'P';
      }
      if (token.startsWith('"')) return token.slice(1, -1);
      if (token.startsWith('\\')) return token.slice(1);
      if (token.startsWith('[')) return ''; // [$-409] locale, [Red] colour…
      return token;
    })
    .join('');
}

/** the nearest date/time code before / after token `i`, skipping literals */
function previousCode(tokens: string[], i: number): string {
  for (let j = i - 1; j >= 0; j--)
    if (/^[a-z]/i.test(tokens[j]) && !tokens[j].startsWith('"')) return tokens[j].toLowerCase();
  return '';
}

function nextCode(tokens: string[], i: number): string {
  for (let j = i + 1; j < tokens.length; j++)
    if (/^[a-z]/i.test(tokens[j]) && !tokens[j].startsWith('"')) return tokens[j].toLowerCase();
  return '';
}

function cellStyle(
  font: Partial<Font> | undefined,
  fill: Fill | undefined,
  alignment: Partial<Alignment> | undefined,
): string {
  const css: string[] = [];
  if (font?.bold) css.push('font-weight:600');
  if (font?.italic) css.push('font-style:italic');
  const lines = [font?.underline ? 'underline' : '', font?.strike ? 'line-through' : ''].filter(
    Boolean,
  );
  if (lines.length) css.push(`text-decoration:${lines.join(' ')}`);
  const color = argb(font?.color?.argb);
  if (color) css.push(`color:${color}`);
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const bg = argb(fill.fgColor?.argb);
    if (bg) css.push(`background-color:${bg}`);
  }
  const h = alignment?.horizontal;
  if (h === 'left' || h === 'center' || h === 'right' || h === 'justify')
    css.push(`text-align:${h}`);
  if (h === 'centerContinuous') css.push('text-align:center');
  const v = alignment?.vertical;
  if (v === 'top' || v === 'bottom') css.push(`vertical-align:${v}`);
  if (v === 'middle') css.push('vertical-align:middle');
  if (alignment?.wrapText) css.push('white-space:pre-wrap');
  return css.join(';');
}

/** `FFRRGGBB` → `#RRGGBB`; fully transparent or malformed → undefined */
function argb(value: string | undefined): string | undefined {
  if (!value || !/^[0-9a-f]{8}$/i.test(value)) return undefined;
  if (value.slice(0, 2) === '00') return undefined;
  return `#${value.slice(2)}`;
}

/** `B2:D4` → 0-based start + spans */
export function parseRange(range: string): SheetMerge | undefined {
  const [start, end] = range.split(':');
  const a = parseAddress(start);
  const b = parseAddress(end ?? start);
  if (!a || !b) return undefined;
  return {
    row: Math.min(a.row, b.row),
    col: Math.min(a.col, b.col),
    rowspan: Math.abs(b.row - a.row) + 1,
    colspan: Math.abs(b.col - a.col) + 1,
  };
}

function parseAddress(address: string): { row: number; col: number } | undefined {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(address.trim());
  if (!match) return undefined;
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, col: col - 1 };
}

/** 0 → A, 25 → Z, 26 → AA */
export function columnLabel(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}
