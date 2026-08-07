import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDragStart,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActionButtonsComponent } from '../action-buttons/action-buttons.component';
import { mergeClasses } from '../details/util/class-name/class-name.helpers';
import { ColumnResizeDirective } from './column-resize.directive';
import { GridCellComponent } from './grid-cell/grid-cell.component';
import { GridRow } from './interfaces/grid-cell.interface';
import { GridColumn_ } from './interfaces/grid-column.interface';
import { resolveSyncDynamic } from './helpers/grid-dynamic.helpers';
import {
  ACTIONS_COLUMN_KEY,
  DRAG_COLUMN_KEY,
  EXPAND_COLUMN_KEY,
  GridEngineService,
  GridInstance,
  INDEX_COLUMN_KEY,
  SELECT_COLUMN_KEY,
} from './grid-engine.service';
import { formatCellValue, GridValueType, resolveClassMap } from './helpers/grid-format.helpers';
import { GridHeaderCell } from './interfaces/grid-header.interface';
import { GridParameter } from './interfaces/grid-parameter.interface';
import { getCellValue } from './helpers/grid-row.helpers';
import { GridRowDetailComponent } from './grid-row-detail/grid-row-detail.component';
import { GridToolbarComponent } from './grid-toolbar/grid-toolbar.component';
import { ROW_DETAILS_COMPONENT, RowDetailsDialogData } from './row-details.token';

const DEFAULT_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500, 1000];
/** Fallback for pinned-column sticky-offset math (`parseWidthPx`) when a column has no explicit
 *  `width` — a plain constant is fine there since it only affects a neighboring column's sticky
 *  offset, not what's actually rendered (see `estimateColumnWidth` for the latter). */
const DEFAULT_COLUMN_WIDTH = 120;
const DEFAULT_VIEW_DETAILS_CLICKS = 7;

// ── "autoish" width estimate — fallback for a column with no explicit or captured width, but
//    ONLY once the table has already committed to `table-layout: fixed` (isFixedLayout) ──
//
// Before the first resize, an unsized column has NO width at all — free-flowing, plain
// `table-layout: auto` content-fit sizing, like a normal HTML table (see `isFixedLayout`).
// `onResizeStart` freezes every THEN-visible unsized column at its natural rendered width right
// before switching to `fixed`, so this estimate never applies to columns that were already on
// screen. It exists only for the narrower edge case of a column that becomes visible (e.g. via
// the column panel) AFTER the table is already in fixed mode, where there's no "natural" auto-
// layout moment left to measure — `fixed` layout requires SOME concrete width for every column,
// and dividing the remaining space equally among newly-shown columns regardless of their likely
// content (an "ID" column and a "Description" column both the same width) looks wrong. Estimated
// from what's known synchronously at config time — the column's `type` (a known-shape value like
// a boolean or date has a fairly predictable rendered width regardless of its label) falling back
// to its header label's length (for free-text columns, where the label is the best available
// proxy for how much room the content likely needs) — NOT real cell-content measurement, so treat
// it as a reasonable starting point, not a precise fit.
const COLUMN_WIDTH_ESTIMATE_MIN = 70;
const COLUMN_WIDTH_ESTIMATE_MAX = 240;
const COLUMN_WIDTH_ESTIMATE_CHAR_PX = 7;
/** icon + sort-arrow + cell padding + resize-handle allowance, roughly */
const COLUMN_WIDTH_ESTIMATE_LABEL_PADDING_PX = 48;
/** typical rendered width for a known-shape value type, independent of its header label's length */
const COLUMN_WIDTH_ESTIMATE_BY_TYPE: Partial<Record<GridValueType, number>> = {
  boolean: 70,
  time: 90,
  number: 90,
  percent: 80,
  currency: 110,
  date: 110,
  datetime: 150,
  imageUrl: 80,
};

/** Highly dynamic, config-driven data grid — see `grid-parameter.interface.ts` for the full contract. */
@Component({
  selector: 'data-grid',
  imports: [
    NgTemplateOutlet,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    CdkDropList,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatRadioModule,
    MatTooltipModule,
    ActionButtonsComponent,
    ColumnResizeDirective,
    GridCellComponent,
    GridRowDetailComponent,
    GridToolbarComponent,
  ],
  templateUrl: './data-grid.component.html',
  styleUrl: './data-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridComponent<RowType = any> implements OnInit, OnDestroy {
  readonly params = input.required<GridParameter<RowType>>();

  /** emits the built GridInstance once, at the end of
   *  ngOnInit — mirrors GenericFormComponent.instanceChange */
  readonly instanceChange = output<GridInstance<RowType>>();

  private readonly engine = inject(GridEngineService);
  private readonly injector = inject(Injector);
  private readonly dialog = inject(MatDialog);
  private readonly rowDetailsComponent = inject(ROW_DETAILS_COMPONENT, { optional: true });

  protected instance!: GridInstance<RowType>;

  protected readonly DRAG_KEY = DRAG_COLUMN_KEY;
  protected readonly INDEX_KEY = INDEX_COLUMN_KEY;
  protected readonly SELECT_KEY = SELECT_COLUMN_KEY;
  protected readonly EXPAND_KEY = EXPAND_COLUMN_KEY;
  protected readonly ACTIONS_KEY = ACTIONS_COLUMN_KEY;

  protected readonly sizeOptions = computed(
    () => this.instance.params().sizeOptions ?? DEFAULT_SIZE_OPTIONS,
  );

  private clickCounts = new Map<unknown, number>();

  ngOnInit(): void {
    this.instance = this.engine.build(this.params, this.injector);
    this.instanceChange.emit(this.instance);
  }

  ngOnDestroy(): void {
    this.instance?.destroy();
  }

  protected readonly showToolbar = computed(() => {
    const p = this.instance.params();
    if (p.showToolbar !== undefined) return p.showToolbar;
    return !!(
      p.gridFilters?.length ||
      p.gridOptions?.length ||
      p.buttons?.length ||
      p.showSearch ||
      p.showTableControlsToggle !== false ||
      p.export?.formats?.length ||
      (p.renderMode?.modes?.length ?? 0) > 1
    );
  });

  protected readonly showPaginator = computed(() => {
    const p = this.instance.params();
    if (p.showPaginator !== undefined) return p.showPaginator;
    return this.instance.size() > 0 && this.instance.totalLength() > this.instance.size();
  });

  // never hides while a search field has a value — see grid-toolbar's search-hiding bug fix
  protected readonly showSearch = computed(() => {
    const p = this.instance.params();
    if (p.showSearch !== undefined) return p.showSearch;
    return this.showPaginator() || this.instance.searchFields().some((f) => !!f.value);
  });

  protected readonly noContent = computed(
    () => !this.instance.loading() && this.instance.rows().length === 0,
  );
  protected readonly noContentLabel = computed(() => {
    const p = this.instance.params();
    return p.noContentLabel ?? `No ${p.label ?? 'results'} found`;
  });

  protected onNoContentClick(): void {
    this.instance.params().noContentClick?.(this.instance.state());
  }

  protected onPage(event: PageEvent): void {
    if (event.pageSize !== this.instance.size()) this.instance.setSize(event.pageSize);
    this.instance.setPage(event.pageIndex + 1);
  }

  // ── header ──

  protected headerCellClass(cell: GridHeaderCell<RowType>): string {
    const base = 'text-left font-medium border-b border-black/10 px-2 py-1 relative';
    const spanBorder = this.instance.hasSpannedCells() ? 'border border-black/10' : '';
    const columnClass = typeof cell.column?.class === 'string' ? cell.column.class : '';
    return mergeClasses(mergeClasses(base, spanBorder), columnClass);
  }

  /** appends a visible border to every body cell once any header/body span is active — keeps
   *  merged regions legible instead of looking like accidentally-missing cells */
  protected bodyCellClass(): string {
    const base = 'px-2 py-1 align-middle';
    return this.instance.hasSpannedCells() ? mergeClasses(base, 'border border-black/10') : base;
  }

  protected onHeaderClick(cell: GridHeaderCell<RowType>): void {
    if (cell.isLeaf && cell.column?.sortable) this.instance.toggleSort(cell.column);
  }

  protected sortIcon(cell: GridHeaderCell<RowType>): string | undefined {
    if (!cell.column) return undefined;
    const sort = this.instance.sort();
    if (sort?.key !== cell.column.key) return undefined;
    return sort.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  /** table-mode column widths free-flow (`table-layout: auto`, like a plain HTML table — no
   *  width on an unconfigured column) until the FIRST resize, at which point the whole table
   *  commits to `table-layout: fixed` (needed for a resize to be precise/unbounded rather than
   *  capped by the browser's auto-layout algorithm) — see `onResizeStart`'s capture step below.
   *  Derived from the engine, not a plain local flag, so `resetColumnState()` (column panel
   *  "reset") correctly drops the grid back to free-flow too. */
  protected readonly isFixedLayout = computed(() => this.instance.hasWidthOverrides());

  private readonly headerCellRefs = viewChildren<ElementRef<HTMLTableCellElement>>('headerCellEl');

  /** Freezes every currently-unsized, currently-visible column at its CURRENT natural
   *  (auto-layout-computed) rendered width — called once, right before the table commits to
   *  `table-layout: fixed` for the first time, so existing columns don't jump/collapse to an
   *  arbitrary default the moment fixed layout takes over. Columns that already have an explicit
   *  `width` (author-configured or already resized) are left untouched. */
  private captureNaturalColumnWidths(): void {
    const byKey = new Map(this.instance.visibleColumns().map((c) => [c.key, c]));
    for (const ref of this.headerCellRefs()) {
      const key = ref.nativeElement.dataset['columnKey'];
      const col = key ? byKey.get(key) : undefined;
      if (!col || col.width) continue;
      const width = Math.round(ref.nativeElement.getBoundingClientRect().width);
      this.instance.setColumnWidth(col.key, `${width}px`);
    }
  }

  private resizeStartWidth = 0;
  protected onResizeStart(headerCell: HTMLElement): void {
    if (!this.isFixedLayout()) this.captureNaturalColumnWidths();
    this.resizeStartWidth = headerCell.getBoundingClientRect().width;
  }
  protected onResize(column: GridColumn_<RowType>, delta: number): void {
    const min = column.minWidth ? parseFloat(column.minWidth) : 40;
    const max = column.maxWidth ? parseFloat(column.maxWidth) : Infinity;
    const next = Math.min(max, Math.max(min, this.resizeStartWidth + delta));
    this.instance.setColumnWidth(column.key, `${Math.round(next)}px`);
  }

  protected isSelectAllChecked(): boolean {
    return this.instance.isAllSelectedOnPage();
  }

  // ── pinned column sticky offsets (px-parseable widths only — a documented simplification) ──

  private parseWidthPx(width?: string): number {
    const match = width ? /^(\d+(?:\.\d+)?)px$/.exec(width.trim()) : null;
    return match ? parseFloat(match[1]) : DEFAULT_COLUMN_WIDTH;
  }

  // cached by column key — config (label/type) is stable for a column's lifetime, and this is
  // consulted from the <colgroup> template binding on every change detection pass.
  private readonly columnWidthEstimates = new Map<string, string>();

  /** "autoish" rendered width for a column with no explicit/captured width, once already in
   *  fixed layout — see the COLUMN_WIDTH_ESTIMATE_* constants' doc comment for the reasoning. */
  protected estimateColumnWidth(column: GridColumn_<RowType>): string {
    const cached = this.columnWidthEstimates.get(column.key);
    if (cached) return cached;

    const typical = column.type ? COLUMN_WIDTH_ESTIMATE_BY_TYPE[column.type] : undefined;
    const labelWidth =
      (column.label ?? column.key).length * COLUMN_WIDTH_ESTIMATE_CHAR_PX +
      COLUMN_WIDTH_ESTIMATE_LABEL_PADDING_PX;
    const estimate = Math.min(
      COLUMN_WIDTH_ESTIMATE_MAX,
      Math.max(COLUMN_WIDTH_ESTIMATE_MIN, typical ?? labelWidth),
    );
    const width = `${Math.round(estimate)}px`;
    this.columnWidthEstimates.set(column.key, width);
    return width;
  }

  private readonly leftOffsets = computed(() => {
    const offsets = new Map<string, number>();
    let cursor = 0;
    for (const col of this.instance.visibleColumns()) {
      if (col.pinned !== 'left') break;
      offsets.set(col.key, cursor);
      cursor += this.parseWidthPx(col.width);
    }
    return offsets;
  });

  private readonly rightOffsets = computed(() => {
    const offsets = new Map<string, number>();
    let cursor = 0;
    for (const col of [...this.instance.visibleColumns()].reverse()) {
      if (col.pinned !== 'right') break;
      offsets.set(col.key, cursor);
      cursor += this.parseWidthPx(col.width);
    }
    return offsets;
  });

  protected stickyLeft(column: GridColumn_<RowType>): string | null {
    return column.pinned === 'left' ? `${this.leftOffsets().get(column.key) ?? 0}px` : null;
  }
  protected stickyRight(column: GridColumn_<RowType>): string | null {
    return column.pinned === 'right' ? `${this.rightOffsets().get(column.key) ?? 0}px` : null;
  }

  // ── row-level dynamic props (resolved synchronously — see resolveSyncDynamic) ──

  protected rowClass(row: RowType): string {
    const base = resolveSyncDynamic(this.instance.params().rowClass, row) ?? '';
    const rowProps = (row as GridRow<RowType>)?._rowProps;
    const conditional = resolveClassMap(this.instance.params().rowFormatter, row);
    const propsClass = resolveSyncDynamic(rowProps?.class, row) ?? '';
    return mergeClasses(mergeClasses(base, conditional), propsClass);
  }

  protected showRowCheckbox(row: RowType): boolean {
    const rowProps = (row as GridRow<RowType>)?._rowProps;
    return resolveSyncDynamic(rowProps?.showCheckbox, row) ?? true;
  }
  protected rowCheckboxDisabled(row: RowType): boolean {
    const rowProps = (row as GridRow<RowType>)?._rowProps;
    return resolveSyncDynamic(rowProps?.checkboxDisabled, row) ?? false;
  }

  protected cellSpanFor(rowIndex: number, column: GridColumn_<RowType>) {
    return this.instance.cellSpan(rowIndex, column.key);
  }

  // ── row interaction ──

  protected onRowClick(row: RowType): void {
    this.instance.params().rowClick?.(row);
    const configured = this.instance.params().viewDetailsClicks;
    // explicit opt-out, or no details component registered (see ROW_DETAILS_COMPONENT)
    if (configured === 0 || !this.rowDetailsComponent) return;

    const threshold = configured ?? DEFAULT_VIEW_DETAILS_CLICKS;
    const id = this.instance.rowId(row);
    const count = (this.clickCounts.get(id) ?? 0) + 1;
    this.clickCounts.set(id, count);

    if (!(count >= threshold)) return;

    this.clickCounts.set(id, 0);

    this.dialog.open(this.rowDetailsComponent, {
      data: { entity: row } satisfies RowDetailsDialogData<RowType>,
      width: '640px',
    });
  }

  protected onRowDblClick(row: RowType): void {
    this.instance.params().rowDClick?.(row);
  }

  protected onRowSelectToggle(row: RowType, event: Event): void {
    event.stopPropagation();
    this.instance.toggleSelect(row);
  }

  protected onSelectAllToggle(event: Event): void {
    event.stopPropagation();
    this.instance.toggleSelectAllOnPage();
  }

  protected onExpandToggle(row: RowType, event: Event): void {
    event.stopPropagation();
    this.instance.toggleExpand(row);
  }

  // ── row dragging (GridParameter.rowsDraggable) ──
  protected onRowDrop(event: CdkDragDrop<RowType[]>): void {
    this.instance.dragRow(event.previousIndex, event.currentIndex);
  }

  /** real (non-synthetic) visible columns, in display order — what the full-row drag preview clones */
  protected readonly previewColumns = computed(() =>
    this.instance.visibleColumns().filter((c) => !this.isSyntheticColumn(c.key)),
  );

  protected dragPreviewColumnWidth(column: GridColumn_<RowType>): number {
    return this.parseWidthPx(column.width);
  }

  /** the dragged row's own on-screen height, captured at drag start so the `*cdkDragPlaceholder`
   *  gap (a `<tr>`/`<div>` with no natural content) doesn't collapse to near-zero height */
  protected readonly draggedRowHeightPx = signal(0);

  protected onRowDragStarted(event: CdkDragStart): void {
    this.draggedRowHeightPx.set(event.source.element.nativeElement.getBoundingClientRect().height);
  }

  protected isSyntheticColumn(key: string): boolean {
    return (
      key === this.DRAG_KEY ||
      key === this.INDEX_KEY ||
      key === this.SELECT_KEY ||
      key === this.EXPAND_KEY ||
      key === this.ACTIONS_KEY
    );
  }

  // ── list mode: expandable cards, styled after the details component's array-item list
  // (chevron + grid-template-rows collapse) — collapsed by default, matching the details
  // component's own array-item list default; the chevron lets a user expand individual rows
  // to see their full field values. ──

  private readonly expandedListRows = signal<ReadonlySet<unknown>>(new Set());

  protected isListRowExpanded(row: RowType): boolean {
    return this.expandedListRows().has(this.instance.rowId(row));
  }

  protected toggleListRowExpanded(row: RowType, event: Event): void {
    event.stopPropagation();
    const id = this.instance.rowId(row);
    this.expandedListRows.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** collapsed-card title: the first real (non-synthetic) visible column's formatted value —
   *  plain text, not a <grid-cell>, since this sits inside the toggle <button> itself (nested
   *  interactive content, e.g. grid-cell's inline-edit trigger, isn't valid inside a <button>) */
  protected listRowTitle(row: RowType): string {
    const column = this.previewColumns()[0];
    if (!column) return String(this.instance.rowId(row) ?? '');
    return formatCellValue(getCellValue(row, column), column.type);
  }
}
