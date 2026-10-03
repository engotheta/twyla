import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TabNavComponent } from '@components/tab-nav/tab-nav.component';
import { TabNavItem } from '@components/tab-nav/tab-nav.interface';
import { FILE_VIEWER_CONFIG } from '../../file-viewer-config.token';
import { ResolvedFile } from '../../file-viewer.interface';
import { escapeHtml, printHtml } from '../../loader/file-actions.helpers';
import { decodeText, readBlob } from '../../loader/text-decode.helpers';
import { ViewerController } from '../../viewer-controller';
import { detectDelimiter, parseCsv } from './csv.helpers';
import { SheetData } from './sheet.interface';
import { columnLabel, readWorkbook } from './xlsx.helpers';

/** rows a print-out includes at most */
const PRINT_ROWS = 5000;
const TOGGLE =
  'inline-flex h-7 items-center gap-1 rounded-full border border-black/15 px-2.5 text-xs aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary';

interface RenderCell {
  col: number;
  text: string;
  style: string;
  numeric: boolean;
  rowspan: number | null;
  colspan: number | null;
}

interface RenderRow {
  index: number;
  label: number;
  cells: RenderCell[];
}

/**
 * CSV / TSV and .xlsx as a spreadsheet table: column letters and row numbers (or the CSV's own
 * header row), sticky headers, merged cells, column widths and basic cell formatting, a sheet tab
 * per visible worksheet. Rows render a batch at a time as you scroll, so a 100 000-row file opens
 * instantly.
 */
@Component({
  selector: 'file-viewer-sheet',
  imports: [TabNavComponent, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './sheet-renderer.component.html',
  styleUrl: './sheet-renderer.component.scss',
  host: { class: 'flex size-full min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SheetRendererComponent {
  readonly file = input.required<ResolvedFile>();
  readonly label = input('');
  readonly failed = output<string>();

  private readonly controller = inject(ViewerController);
  private readonly config = inject(FILE_VIEWER_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly more = viewChild<ElementRef<HTMLElement>>('more');

  protected readonly uid = nextId++;
  protected readonly toggle = TOGGLE;
  protected readonly busy = signal(true);
  protected readonly sheets = signal<SheetData[]>([]);
  protected readonly active = signal(0);
  protected readonly visibleRows = signal(this.config.sheetPageSize);
  /** CSV: treat the first row as column names */
  protected readonly headerRow = signal(true);

  protected readonly isCsv = computed(() => this.file().kind === 'csv');
  protected readonly sheet = computed<SheetData | undefined>(() => this.sheets()[this.active()]);
  protected readonly useHeader = computed(() => this.isCsv() && this.headerRow());
  private readonly firstRow = computed(() => (this.useHeader() ? 1 : 0));
  protected readonly columns = computed(() =>
    Array.from({ length: this.sheet()?.colCount ?? 0 }, (_, i) => i),
  );
  protected readonly totalRows = computed(() =>
    Math.max(0, (this.sheet()?.rows.length ?? 0) - this.firstRow()),
  );
  protected readonly hasMore = computed(() => this.visibleRows() < this.totalRows());

  protected readonly headers = computed(() => {
    const sheet = this.sheet();
    if (!sheet) return [];
    const names = this.useHeader() ? (sheet.rows[0] ?? []) : [];
    return this.columns().map((c) => names[c]?.text || columnLabel(c));
  });

  protected readonly tabs = computed<TabNavItem[]>(() =>
    this.sheets().map((s, i) => ({
      key: String(i),
      label: s.name,
      disabled: false,
      tabId: `sheet-tab-${this.uid}-${i}`,
      panelId: `sheet-panel-${this.uid}`,
    })),
  );

  protected readonly scale = computed(() => {
    const zoom = this.controller.zoom();
    return typeof zoom === 'number' ? zoom : 1;
  });

  /** the visible rows, merges resolved: covered cells dropped, spans clipped to what's rendered */
  protected readonly rows = computed<RenderRow[]>(() => {
    const sheet = this.sheet();
    if (!sheet) return [];
    const start = this.firstRow();
    const end = Math.min(sheet.rows.length, start + this.visibleRows());
    const spans = new Map<string, { rowspan: number; colspan: number }>();
    const covered = new Set<string>();
    for (const m of sheet.merges) {
      if (m.row < start || m.row >= end) continue;
      const rowspan = Math.min(m.rowspan, end - m.row);
      spans.set(`${m.row}:${m.col}`, { rowspan, colspan: m.colspan });
      for (let r = m.row; r < m.row + rowspan; r++) {
        for (let c = m.col; c < m.col + m.colspan; c++)
          if (r !== m.row || c !== m.col) covered.add(`${r}:${c}`);
      }
    }

    const out: RenderRow[] = [];
    for (let r = start; r < end; r++) {
      const source = sheet.rows[r] ?? [];
      const cells: RenderCell[] = [];
      for (let c = 0; c < sheet.colCount; c++) {
        if (covered.has(`${r}:${c}`)) continue;
        const cell = source[c];
        const span = spans.get(`${r}:${c}`);
        cells.push({
          col: c,
          text: cell?.text ?? '',
          style: cell?.style ?? '',
          numeric: !!cell?.numeric,
          rowspan: span && span.rowspan > 1 ? span.rowspan : null,
          colspan: span && span.colspan > 1 ? span.colspan : null,
        });
      }
      out.push({ index: r, label: r - start + 1 + (this.useHeader() ? 0 : start), cells });
    }
    return out;
  });

  constructor() {
    const unregister = this.controller.register({
      capabilities: { zoom: true, print: true },
      print: () => this.print(),
    });
    this.destroyRef.onDestroy(unregister);
    effect(() => this.controller.scale.set(this.scale()));

    effect((onCleanup) => {
      const file = this.file();
      let stale = false;
      onCleanup(() => (stale = true));
      this.busy.set(true);
      this.load(file)
        .then((sheets) => {
          if (stale) return;
          this.sheets.set(sheets);
          this.active.set(0);
          this.visibleRows.set(this.config.sheetPageSize);
          this.busy.set(false);
          if (!sheets.length) this.failed.emit('This workbook has no visible sheets.');
        })
        .catch(() => {
          if (stale) return;
          this.busy.set(false);
          this.failed.emit(
            this.isCsv()
              ? 'This file could not be read as CSV.'
              : 'This workbook could not be opened — it may be damaged, protected or in the older .xls format.',
          );
        });
    });

    // load the next batch when "Show more rows" scrolls into view
    afterRenderEffect((onCleanup) => {
      const more = this.more()?.nativeElement;
      if (!more) return;
      const observer = new IntersectionObserver(
        ([entry]) => entry.isIntersecting && this.showMore(),
      );
      observer.observe(more);
      onCleanup(() => observer.disconnect());
    });
  }

  protected selectSheet(key: string): void {
    this.active.set(Number(key));
    this.visibleRows.set(this.config.sheetPageSize);
    this.controller.announce(`Sheet ${this.sheet()?.name ?? ''}`);
  }

  protected showMore(): void {
    if (this.hasMore()) this.visibleRows.update((n) => n + this.config.sheetPageSize);
  }

  private async load(file: ResolvedFile): Promise<SheetData[]> {
    const blob = file.blob;
    if (!blob) throw new Error('no bytes');
    if (file.kind === 'csv') {
      const text = decodeText(await readBlob(blob));
      const delimiter = file.extension === 'tsv' ? '\t' : detectDelimiter(text);
      const firstLine = parseCsv(text, delimiter, 1).rows[0] ?? [];
      const maxRows = Math.max(
        1,
        Math.floor(this.config.maxSheetCells / Math.max(1, firstLine.length)),
      );
      const { rows, truncated } = parseCsv(text, delimiter, maxRows);
      const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
      return [
        {
          name: file.name,
          rows: rows.map((row) =>
            row.map((text) => (text ? { text, numeric: isNumeric(text) } : null)),
          ),
          colCount,
          colWidths: [],
          merges: [],
          truncated,
        },
      ];
    }
    return readWorkbook(await readBlob(blob), this.config.maxSheetCells);
  }

  private print(): Promise<boolean> {
    const sheet = this.sheet();
    if (!sheet) return Promise.resolve(false);
    const start = this.firstRow();
    const head = `<tr>${this.headers()
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join('')}</tr>`;
    const body = sheet.rows
      .slice(start, start + PRINT_ROWS)
      .map(
        (row) =>
          `<tr>${this.columns()
            .map(
              (c) =>
                `<td style="${escapeHtml(row[c]?.style ?? '')}">${escapeHtml(row[c]?.text ?? '')}</td>`,
            )
            .join('')}</tr>`,
      )
      .join('');
    return printHtml(
      this.document,
      `${this.file().name} — ${sheet.name}`,
      `<table><thead>${head}</thead><tbody>${body}</tbody></table>`,
      'table{border-collapse:collapse;font-size:10px}th,td{border:1px solid #bbb;padding:2px 4px;text-align:start;vertical-align:top}th{background:#eee}',
    );
  }
}

let nextId = 0;

function isNumeric(text: string): boolean {
  return /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?%?$/.test(text.trim()) && /\d/.test(text);
}
