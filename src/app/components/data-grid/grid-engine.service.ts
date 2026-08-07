import { computed, effect, Injectable, Injector, signal, Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, firstValueFrom, isObservable, Observable, of, Subscription } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import {
  applyColumnOverrides,
  applyColumnState,
  autoGenerateColumns,
  buildHeaderRows,
  collectAncestorHiddenLeafKeys,
  discoverColumnsFromData,
  flattenLeafColumns,
  normalizeColumns,
  orderColumnsForHeader,
} from './helpers/grid-column.helpers';

import { GridColumn_, GridColumnState } from './interfaces/grid-column.interface';
import { GridRow } from './interfaces/grid-cell.interface';
import { resolveSyncDynamic } from './helpers/grid-dynamic.helpers';
import { GridHeaderCell, GridHeaderRow } from './interfaces/grid-header.interface';
import { GridParameter, GridSelectionMode } from './interfaces/grid-parameter.interface';
import { GridRenderMode } from './interfaces/grid-render-mode.interface';
import {
  getCellValue,
  getRowId,
  matchesFilters,
  matchesSearchFields,
  sortRows,
} from './helpers/grid-row.helpers';
import { GridSearchConfig, SearchField } from './interfaces/grid-search.interface';
import { GridData, GridSort, GridState, PageDetails } from './interfaces/grid-state.interface';

export const DRAG_COLUMN_KEY = '__grid_drag__';
export const INDEX_COLUMN_KEY = '__grid_index__';
export const SELECT_COLUMN_KEY = '__grid_select__';
export const EXPAND_COLUMN_KEY = '__grid_expand__';
export const ACTIONS_COLUMN_KEY = '__grid_actions__';

/**
 * Synthetic (non-data) leaf columns are structural, never part of the user-reorderable column
 * set: their position is always fixed (leading in their own relative order, or trailing for
 * actions) regardless of `GridColumnState.order`, and the column panel never lists them (see
 * `visibleColumns`/`moveColumn`/SPEC.md §2). Shared here so every place that needs to exclude
 * them agrees on the exact same set.
 */
export const SYNTHETIC_COLUMN_KEYS = new Set([
  DRAG_COLUMN_KEY,
  INDEX_COLUMN_KEY,
  SELECT_COLUMN_KEY,
  EXPAND_COLUMN_KEY,
  ACTIONS_COLUMN_KEY,
]);

export interface CellSpan {
  rowspan: number;
  colspan: number;
  hidden: boolean;
}

const EMPTY_SPAN: CellSpan = { rowspan: 1, colspan: 1, hidden: false };

/** per-instance runtime handle returned by `GridEngineService.build()` — components render, the engine derives/mutates state */
export interface GridInstance<RowType = any> {
  /** live, `gridOptions`-merged config — reacts to both a new `parameter()` input and a
   *  `selectOption()` slug swap; see `GridEngineService.build`'s `activeParams` */
  params: Signal<GridParameter<RowType>>;

  loading: Signal<boolean>;
  error: Signal<unknown>;

  /** the (non-synthetic) column tree's computed header matrix — see grid-header.interface.ts */
  headerRows: Signal<GridHeaderRow<RowType>[]>;
  /** the normalized nested column tree (`GridColumn_.columns` intact) — pre-synthetic-splice, pre-flatten. Feeds `buildHeaderRows` for anything (e.g. export) that needs the same span matrix the grid itself renders from */
  columns: Signal<GridColumn_<RowType>[]>;
  /** every real leaf column, unfiltered/unordered (declaration order) */
  leafColumns: Signal<GridColumn_<RowType>[]>;
  /** runtime layout: order/visible/width/pinned per column key, including synthetic columns */
  columnState: Signal<GridColumnState[]>;
  /** leaf columns (incl. synthetic index/select/expand/actions) filtered+ordered per `columnState` */
  visibleColumns: Signal<GridColumn_<RowType>[]>;
  /** true once `setColumnWidth` has been called for at least one column (a live resize, or
   *  `initialColumnState`) and stays true until `resetColumnState()` clears it back to false —
   *  table mode uses this to decide whether column widths should still free-flow (`table-layout:
   *  auto`, like a plain HTML table) or have committed to being pixel-authoritative
   *  (`table-layout: fixed`, needed for a resize to be precise/unbounded — see
   *  `data-grid.component.ts`'s `onResizeStart`). */
  hasWidthOverrides: Signal<boolean>;

  page: Signal<number>;
  size: Signal<number>;
  sort: Signal<GridSort | undefined>;
  /** always at least one entry — see grid-search.interface.ts */
  searchFields: Signal<SearchField[]>;
  /** true once any column is marked `searchable` — the toolbar shows the compound search UI
   *  instead of a plain single input once this is true */
  hasSearchableColumns: Signal<boolean>;
  filters: Signal<Record<string, any>>;

  /** current page's rows, ready to render (already fetched/filtered/sorted/paginated) */
  rows: Signal<RowType[]>;
  totalLength: Signal<number>;
  /** render plan for one body cell — `rowIndex` within `rows()`, `columnKey` a real (non-synthetic) leaf column's key */
  cellSpan(rowIndex: number, columnKey: string): CellSpan;
  /** true when any header or body cell currently spans more than one row/column (table mode only) — drives span-aware cell borders */
  hasSpannedCells: Signal<boolean>;

  selected: Signal<RowType[]>;
  expandedRows: Signal<RowType[]>;
  renderMode: Signal<GridRenderMode>;
  gridOptions: Signal<GridParameter<RowType>[]>;
  selectedOptionSlug: Signal<string | undefined>;

  state: Signal<GridState<RowType>>;

  setPage(page: number): void;
  setSize(size: number): void;
  setSort(sort: GridSort | undefined): void;
  toggleSort(column: GridColumn_<RowType>): void;
  setSearchFields(fields: SearchField[]): void;
  setFilters(filters: Record<string, any>): void;
  clearFilters(): void;
  refetch(): void;
  selectOption(slug: string): void;
  /** every row matching the current search/filters/sort, ignoring pagination — used by `GridExportConfig.exportAllData` */
  getAllRows(): Promise<RowType[]>;
  /** GridParameter.canAddColumns: scans the full dataset for keys not already declared as
   *  columns and appends them (initially hidden) — see helpers/grid-column.helpers.ts's
   *  `discoverColumnsFromData`. Session-only, not persisted across a reload. */
  addColumnsFromData(): Promise<void>;

  rowId(row: RowType): unknown;
  isSelected(row: RowType): boolean;
  toggleSelect(row: RowType): void;
  isAllSelectedOnPage(): boolean;
  toggleSelectAllOnPage(): void;
  clearSelection(): void;

  isExpanded(row: RowType): boolean;
  toggleExpand(row: RowType): void;

  setColumnWidth(key: string, width: string): void;
  setColumnVisible(key: string, visible: boolean): void;
  setColumnPinned(key: string, pinned: 'left' | 'right' | undefined): void;
  moveColumn(fromIndex: number, toIndex: number): void;
  resetColumnState(): void;

  setRenderMode(mode: GridRenderMode): void;

  /** reorders `rows()` (table/list render modes only) and fires `params.onRowDrag`; a no-op unless `rowsDraggable` is set */
  dragRow(fromIndex: number, toIndex: number): void;

  destroy(): void;
}

function normalizeSource<RowType>(
  value: Observable<GridData<RowType> | RowType[]> | GridData<RowType> | RowType[] | undefined,
): Observable<GridData<RowType> | RowType[]> {
  if (value === undefined) return of([] as RowType[]);
  return isObservable(value) ? value : of(value);
}

function extractContent<RowType>(value: GridData<RowType> | RowType[]): RowType[] {
  return Array.isArray(value) ? value : (value.content ?? []);
}

function extractTotal<RowType>(value: GridData<RowType> | RowType[], fallback?: number): number {
  if (Array.isArray(value)) return fallback ?? value.length;
  return value.totalLength ?? fallback ?? value.content?.length ?? 0;
}

function normalizeToPromise<RowType>(
  value: Observable<GridData<RowType> | RowType[]> | GridData<RowType> | RowType[],
): Promise<GridData<RowType> | RowType[]> {
  return isObservable(value) ? firstValueFrom(value) : Promise.resolve(value);
}

/**
 * Vertical (rowspan) streaks per column: a column merges when EITHER the grid-wide
 * `gridMergeCells` default is on OR the column's own `GridColumn_.mergeConsecutive` is set —
 * an explicit per-column value always wins over the grid-wide default (same "local override
 * beats global default" convention as manual `_cellsProps` beating auto-merge below).
 */
function buildVerticalMergeSpans<RowType>(
  rows: RowType[],
  columns: GridColumn_<RowType>[],
  gridMergeCells: boolean,
): Record<number, Record<string, { rowspan: number; hidden: boolean }>> {
  const result: Record<number, Record<string, { rowspan: number; hidden: boolean }>> = {};
  rows.forEach((_, i) => (result[i] = {}));

  for (const col of columns) {
    if (!(col.mergeConsecutive ?? gridMergeCells)) continue;
    let i = 0;
    while (i < rows.length) {
      const value = getCellValue(rows[i], col);
      let span = 1;
      while (i + span < rows.length && getCellValue(rows[i + span], col) === value) span++;
      result[i][col.key] = { rowspan: span, hidden: false };
      for (let k = 1; k < span; k++) result[i + k][col.key] = { rowspan: 1, hidden: true };
      i += span;
    }
  }
  return result;
}

/**
 * Horizontal (colspan) streaks for ONE row: consecutive REAL columns (in current display
 * order) with equal resolved values — the horizontal analog of `buildVerticalMergeSpans`,
 * transposed (row-wise instead of column-wise). Only computed for rows that opt in via
 * `GridRow._rowProps.mergeConsecutive` (grid-cell.interface.ts) — there's no grid-wide default
 * for this axis, since "merge same-valued columns within a row" is far more row-shape-specific
 * than the vertical case.
 */
function buildRowMergeSpans<RowType>(
  row: RowType,
  columns: GridColumn_<RowType>[],
): Record<string, { colspan: number; hidden: boolean }> {
  const result: Record<string, { colspan: number; hidden: boolean }> = {};
  let ci = 0;
  while (ci < columns.length) {
    const value = getCellValue(row, columns[ci]);
    let span = 1;
    while (ci + span < columns.length && getCellValue(row, columns[ci + span]) === value) span++;
    result[columns[ci].key] = { colspan: span, hidden: false };
    for (let k = 1; k < span; k++) result[columns[ci + k].key] = { colspan: 1, hidden: true };
    ci += span;
  }
  return result;
}

/**
 * Body cell render plan, precedence high to low: (1) manual per-cell `_cellsProps[key].rowspan`/
 * `colspan` — wins over BOTH auto mechanisms below, for any cell it covers; (2) per-row
 * horizontal auto-merge (`_rowProps.mergeConsecutive`) — more specific (opted into per ROW) than
 * (3) per-column vertical auto-merge (`mergeCells` grid default / `GridColumn_.mergeConsecutive`
 * override). A cell already covered by an EARLIER cell's span (either axis) is skipped before any
 * of these checks run — same "first cell in a streak wins" limitation on both axes: a covered
 * cell's OWN manual override, if it has one, is never independently consulted (SPEC.md §1).
 * Exported so both the live grid (`renderPlan` below, current-page `rows()`) and
 * `GridExportService` (arbitrary row sets, e.g. the full dataset for `exportAllData`) compute
 * spans from one source of truth. `columns` must be the real (non-synthetic) columns in their
 * CURRENT display order — span geometry follows what's actually visible, not declaration order.
 */
export function buildCellSpanPlan<RowType>(
  rows: RowType[],
  columns: GridColumn_<RowType>[],
  mergeCells: boolean,
): Record<string, CellSpan>[] {
  const merge = buildVerticalMergeSpans(rows, columns, mergeCells);
  const plan: Record<string, CellSpan>[] = rows.map(() => ({}));
  const coverUntilRow = new Map(columns.map((c) => [c.key, -1]));

  rows.forEach((row, ri) => {
    let skipUntilCol = -1;
    const rowMerge = (row as GridRow<RowType>)?._rowProps?.mergeConsecutive
      ? buildRowMergeSpans(row, columns)
      : undefined;

    columns.forEach((col, ci) => {
      if (ri <= (coverUntilRow.get(col.key) ?? -1) || ci <= skipUntilCol) {
        plan[ri][col.key] = { rowspan: 1, colspan: 1, hidden: true };
        return;
      }
      const manual = (row as GridRow<RowType>)?._cellsProps?.[col.key];
      const manualRowspan =
        manual?.rowspan !== undefined ? resolveSyncDynamic(manual.rowspan, row) : undefined;
      const manualColspan =
        manual?.colspan !== undefined ? resolveSyncDynamic(manual.colspan, row) : undefined;

      if (manualRowspan !== undefined || manualColspan !== undefined) {
        const rowspan = manualRowspan ?? 1;
        const colspan = manualColspan ?? 1;
        plan[ri][col.key] = { rowspan, colspan, hidden: false };
        if (colspan > 1) skipUntilCol = ci + colspan - 1;
        // A cell with BOTH rowspan and colspan > 1 covers a 2D rectangle, not just its own
        // column — every column the colspan reaches must ALSO be marked covered for the full
        // rowspan duration, or subsequent rows render their own (unhidden) cells for those
        // columns, shifting everything after them to the right and overflowing the table.
        if (rowspan > 1) {
          for (let cj = ci; cj < ci + colspan && cj < columns.length; cj++) {
            coverUntilRow.set(columns[cj].key, ri + rowspan - 1);
          }
        }
        return;
      }

      if (rowMerge) {
        const rm = rowMerge[col.key];
        // `buildRowMergeSpans` returns an entry for EVERY column, even a "streak of 1" (no
        // actual merge — colspan 1, not hidden) — only a REAL span (colspan > 1) or a cell
        // truly covered by an earlier one in the same streak (hidden) should short-circuit
        // here. Without this check, a row opted into horizontal merge would silently block
        // vertical column merge from ever being considered for ANY of its cells, even the
        // ones with no horizontal match at all.
        if (rm && (rm.colspan > 1 || rm.hidden)) {
          plan[ri][col.key] = { rowspan: 1, colspan: rm.colspan, hidden: rm.hidden };
          if (rm.colspan > 1) skipUntilCol = ci + rm.colspan - 1;
          return;
        }
      }

      const auto = merge[ri]?.[col.key];
      plan[ri][col.key] = auto
        ? { rowspan: auto.rowspan, colspan: 1, hidden: auto.hidden }
        : { ...EMPTY_SPAN };
    });
  });
  return plan;
}

/** the initial `searchFields`: one instance, scoped to the first `searchable` column when any
 *  exist, else unscoped (searches every leaf column — the old single-string `searchTerm` behavior) */
function seedSearchFields<RowType>(
  configColumns: GridColumn_<RowType>[] | undefined,
  cfg: GridSearchConfig | undefined,
): SearchField[] {
  const first = configColumns && flattenLeafColumns(configColumns).find((c) => c.searchable);
  return [
    {
      key: first?.key,
      value: '',
      searchType: first?.searchType ?? cfg?.defaultSearchType ?? 'like',
    },
  ];
}

@Injectable({ providedIn: 'root' })
export class GridEngineService {
  /**
   * `injector` MUST be the calling component's own `Injector` (`inject(Injector)` in a field
   * initializer), not this service's — every `effect()`/`toObservable()`/`toSignal()` below ties
   * its cleanup to that injector's `DestroyRef`. Passing this service's own (root) injector would
   * leak every reactive subscription for the app's lifetime instead of on component destroy.
   */
  build<RowType = any>(
    paramsSignal: Signal<GridParameter<RowType>>,
    injector: Injector,
  ): GridInstance<RowType> {
    const subs: Subscription[] = [];
    // one-time snapshot — seeds user-owned runtime UI state below (page/sort/selection/etc.),
    // which must NOT re-derive from later `paramsSignal()` emissions (see grid-engine reactivity
    // design note: re-seeding these on every incidental new-but-equivalent `parameter()` object
    // would reset a user's current page/sort/filters/selection every time a parent re-renders)
    const initialParams = paramsSignal();

    // ── grid options: an option's own properties merge over the base params (excludedOptionKeys wins) ──
    const selectedOptionSlug = signal<string | undefined>(
      initialParams.slug ?? initialParams.gridOptions?.[0]?.slug,
    );
    const activeParams = computed<GridParameter<RowType>>(() => {
      const params = paramsSignal();
      const options = params.gridOptions;
      if (!options?.length) return params;
      const active = options.find((o) => o.slug === selectedOptionSlug()) ?? options[0];
      const excluded = new Set(params.excludedOptionKeys ?? []);
      const merged: Record<string, unknown> = { ...params };
      for (const [key, value] of Object.entries(active)) {
        if (value !== undefined && !excluded.has(key)) merged[key] = value;
      }
      return merged as GridParameter<RowType>;
    });

    // ── columns: static config, or auto-generated once the first row of data is known ──
    const configColumns = computed<GridColumn_<RowType>[] | undefined>(() => {
      const params = activeParams();
      return params.columns?.length ? normalizeColumns(params.columns, params.lastDotAsName) : undefined;
    });
    const autoColumnsSig = signal<GridColumn_<RowType>[]>([]);
    // SPEC §2b: columns discovered from the data via `addColumnsFromData()` (GridParameter.canAddColumns)
    // — appended on top of whichever base (configured or auto-generated) is active
    const discoveredColumnsSig = signal<GridColumn_<RowType>[]>([]);
    const baseColumns = computed(() => configColumns() ?? autoColumnsSig());
    const columns = computed(() => [...baseColumns(), ...discoveredColumnsSig()]);
    const leafColumns = computed(() => flattenLeafColumns(columns()));
    // auto-generated columns (autoGenerateColumns) never set `searchable` — only explicit
    // `params.columns` can, and those are already known synchronously here at build() time
    const hasSearchableColumns = computed(() => leafColumns().some((c) => c.searchable));

    // ── synthetic (non-data) leaf columns: index / selection / expand-toggle / row actions ──
    // Split into their own computed (not composed inline into `allLeafColumns`/`visibleColumns`)
    // because their POSITION is always structurally fixed — leading in this relative order, or
    // trailing for actions — never part of the user-reorderable real-column set. See
    // SYNTHETIC_COLUMN_KEYS's doc comment and SPEC.md §2.
    const leadingSyntheticColumns = computed<GridColumn_<RowType>[]>(() => {
      const p = activeParams();
      const leading: GridColumn_<RowType>[] = [];
      if (p.rowsDraggable) {
        leading.push({ key: DRAG_COLUMN_KEY, label: '', width: '32px', resizable: false });
      }
      if (p.addIndexColumn !== false) {
        leading.push({
          key: INDEX_COLUMN_KEY,
          label: '#',
          width: '56px',
          resizable: false,
          pinned: p.autoPinFirstColumn !== false ? 'left' : undefined,
        });
      }
      if ((p.selectionMode ?? 'none') !== 'none') {
        leading.push({
          key: SELECT_COLUMN_KEY,
          label: '',
          width: '48px',
          resizable: false,
          pinned: p.autoPinFirstColumn !== false ? 'left' : undefined,
        });
      }
      if (p.rowDetail) {
        leading.push({ key: EXPAND_COLUMN_KEY, label: '', width: '40px', resizable: false });
      }
      return leading;
    });
    const trailingSyntheticColumns = computed<GridColumn_<RowType>[]>(() => {
      const p = activeParams();
      const trailing: GridColumn_<RowType>[] = [];
      if (p.rowButtons?.length) {
        trailing.push({
          key: ACTIONS_COLUMN_KEY,
          label: 'Actions',
          resizable: false,
          pinned: p.autoPinActionColumn !== false ? 'right' : undefined,
        });
      }
      return trailing;
    });
    const allLeafColumns = computed<GridColumn_<RowType>[]>(() => [
      ...leadingSyntheticColumns(),
      ...leafColumns(),
      ...trailingSyntheticColumns(),
    ]);

    // ── column runtime state: sparse overrides layered over each column's own config defaults ──
    const seedOverrides: Record<string, Partial<GridColumnState>> = {};
    for (const entry of initialParams.initialColumnState ?? []) seedOverrides[entry.key] = entry;
    const columnOverrides = signal<Record<string, Partial<GridColumnState>>>(seedOverrides);
    const hasWidthOverrides = computed(() =>
      Object.values(columnOverrides()).some((o) => o.width !== undefined),
    );

    // leaf keys hidden by an ancestor group's `visible: false` — takes precedence over the leaf's
    // own `visible`/runtime override below, since a hidden section can't be cherry-pick-unhidden
    // one child at a time (there'd be no group header left to show it under anyway).
    const ancestorHiddenLeafKeys = computed(() => collectAncestorHiddenLeafKeys(columns()));

    const columnState = computed<GridColumnState[]>(() => {
      const leaves = allLeafColumns();
      const overrides = columnOverrides();
      const hiddenByAncestor = ancestorHiddenLeafKeys();
      return leaves
        .map((col, i) => ({
          key: col.key,
          order: overrides[col.key]?.order ?? i,
          visible: hiddenByAncestor.has(col.key)
            ? false
            : (overrides[col.key]?.visible ?? col.visible ?? true),
          width: overrides[col.key]?.width ?? col.width,
          pinned: overrides[col.key]?.pinned ?? col.pinned,
        }))
        .sort((a, b) => a.order - b.order);
    });

    // The nested `columns()` tree (real columns only — synthetic ones are never part of it, see
    // above) reordered to match `columnState`'s order at every level (`orderColumnsForHeader`,
    // grid-column.helpers.ts) AND with each leaf's live width/pinned override applied
    // (`applyColumnOverrides`) — the SINGLE source of truth both `headerRows` (as a tree, for
    // span computation) and `visibleColumns` (flattened to leaves) render from, so header and
    // body can never disagree about a real column's order, width, or pinned state. See SPEC.md §1.
    const orderedColumnsTree = computed(() => {
      const states = columnState();
      const orderByKey = new Map(states.map((s) => [s.key, s.order]));
      const ordered = orderColumnsForHeader(columns(), orderByKey);
      const stateByKey = new Map(states.map((s) => [s.key, s]));
      return applyColumnOverrides(ordered, stateByKey);
    });
    const orderedRealLeafColumns = computed(() => flattenLeafColumns(orderedColumnsTree()));

    const visibleColumns = computed<GridColumn_<RowType>[]>(() => {
      const stateByKey = new Map(columnState().map((s) => [s.key, s]));
      const isVisible = (key: string) => stateByKey.get(key)?.visible !== false;

      // leading/trailing synthetic columns live outside orderedColumnsTree, so they still need
      // their own override pass; orderedRealLeafColumns is already override-applied above.
      const leading = leadingSyntheticColumns()
        .filter((c) => isVisible(c.key))
        .map((c) => applyColumnState(c, stateByKey.get(c.key)));
      const real = orderedRealLeafColumns().filter((c) => isVisible(c.key));
      const trailing = trailingSyntheticColumns()
        .filter((c) => isVisible(c.key))
        .map((c) => applyColumnState(c, stateByKey.get(c.key)));
      return [...leading, ...real, ...trailing];
    });

    // Full render-ready header matrix: the real nested-column tree's computed spans, with
    // synthetic single-cell columns (index/select/expand/actions) merged in at the edges, each
    // spanning the full header depth. Header cell order for the real (non-synthetic) portion
    // follows `columnState`'s order (drag/move reorder), via `orderColumnsForHeader` — reordered
    // at every tree level, so a flat (non-nested) column set (the common case) always matches
    // `visibleColumns()`'s order exactly. NOTE: a leaf dragged to interleave with a DIFFERENT
    // group's leaves (crossing a group boundary) has no sane single header rendering — you can't
    // split a group's contiguous span — so that one case still falls back to declaration order
    // within the leaf's own group; every other reorder (including moving a whole group) renders
    // correctly. See grid-column.helpers.ts's `orderColumnsForHeader` and SPEC.md §1.
    const headerRows = computed<GridHeaderRow<RowType>[]>(() => {
      const states = columnState();
      const visibleKeys = new Set(states.filter((s) => s.visible).map((s) => s.key));
      const stateByKey = new Map(states.map((s) => [s.key, s]));
      const real = buildHeaderRows(orderedColumnsTree(), visibleKeys);
      const depth = real.length || 1;
      const byKey = new Map(allLeafColumns().map((c) => [c.key, c]));

      const makeSyntheticCell = (key: string): GridHeaderCell<RowType> | undefined => {
        const col = byKey.get(key);
        if (!col || !visibleKeys.has(key)) return undefined;
        const resolved = applyColumnState(col, stateByKey.get(key));
        return {
          label: resolved.label ?? '',
          colspan: 1,
          rowspan: depth,
          column: resolved,
          isLeaf: true,
        };
      };
      const leading = [DRAG_COLUMN_KEY, INDEX_COLUMN_KEY, SELECT_COLUMN_KEY, EXPAND_COLUMN_KEY]
        .map(makeSyntheticCell)
        .filter((c): c is GridHeaderCell<RowType> => !!c);
      const trailing = [ACTIONS_COLUMN_KEY]
        .map(makeSyntheticCell)
        .filter((c): c is GridHeaderCell<RowType> => !!c);

      const rows = real.length
        ? real.map((r) => ({ cells: [...r.cells] }))
        : [{ cells: [] as GridHeaderCell<RowType>[] }];
      rows[0].cells.unshift(...leading);
      rows[0].cells.push(...trailing);
      return rows;
    });

    // ── request state ──
    const page = signal(initialParams.page ?? 1);
    const size = signal(initialParams.size ?? 10);
    const sortSig = signal<GridSort | undefined>(initialParams.sort);
    // seeded once from configColumns (never from auto-generated columns — those are never
    // `searchable`), so this is correct at signal-creation time with no async re-seed needed
    const searchFieldsSig = signal<SearchField[]>(
      seedSearchFields(configColumns(), initialParams.searchConfig),
    );
    const filtersSig = signal<Record<string, any>>({});
    const refetchTrigger = signal(0);

    // ── data fetch pipeline ──
    const loading = signal(false);
    const error = signal<unknown>(undefined);

    // Auto-upgrade: a consumer can forget `serverPaginated: true` on a `fetchFn` that's
    // otherwise clearly written for server paging (takes `page`/`size`, returns a real
    // `totalLength`) — the exact mistake that motivated this. Once the FIRST client-mode fetch
    // resolves to a genuine `GridData` (not a plain array) with a numeric `totalLength`, that's
    // a strong enough signal to flip into server mode ourselves, same as if `serverPaginated`
    // had been true from the start. One-way (never auto-downgrades) and one-time (checked only
    // while still unset — see the `clientSource$` tap below).
    const autoServerMode = signal(false);
    const serverMode = computed(
      () => !!((activeParams().serverPaginated || autoServerMode()) && activeParams().fetchFn),
    );

    const pageDetails = computed<PageDetails>(() => ({
      page: page(),
      size: size(),
      sort: sortSig(),
      searchFields: searchFieldsSig(),
      filters: filtersSig(),
    }));

    // Neither `serverContent$` nor `clientSource$` re-fetches just because `gridData`/`fetchFn`
    // changed identity on its own (only `pageDetails`/`refetchTrigger` ticking does) — this closes
    // that gap. Deduped (custom `equal`) so unrelated `parameter()` changes (e.g. just `label`)
    // don't force a refetch.
    const dataSourceParams = computed(
      () => ({ gridData: activeParams().gridData, fetchFn: activeParams().fetchFn }),
      { equal: (a, b) => a.gridData === b.gridData && a.fetchFn === b.fetchFn },
    );

    const serverContent$ = combineLatest([
      toObservable(pageDetails, { injector }),
      toObservable(refetchTrigger, { injector }),
      toObservable(dataSourceParams, { injector }),
    ]).pipe(
      tap(() => {
        loading.set(true);
        error.set(undefined);
      }),
      switchMap(([pd]) =>
        normalizeSource(activeParams().fetchFn!(pd)).pipe(
          catchError((err) => {
            error.set(err);
            return of([] as RowType[]);
          }),
        ),
      ),
      tap(() => loading.set(false)),
    );

    const clientSource$ = combineLatest([
      toObservable(refetchTrigger, { injector }),
      toObservable(dataSourceParams, { injector }),
    ]).pipe(
      tap(() => {
        loading.set(true);
        error.set(undefined);
      }),
      switchMap(() => {
        const p = activeParams();
        const source = p.gridData ?? (p.fetchFn ? p.fetchFn(pageDetails()) : []);
        return normalizeSource(source).pipe(
          catchError((err) => {
            error.set(err);
            return of([] as RowType[]);
          }),
        );
      }),
      tap((value) => {
        loading.set(false);
        if (
          !activeParams().serverPaginated &&
          !autoServerMode() &&
          !Array.isArray(value) &&
          typeof value.totalLength === 'number'
        ) {
          autoServerMode.set(true);
        }
      }),
    );

    // Which observable feeds `rawData` is itself reactive (via `serverMode`, not read once) so
    // the auto-upgrade above can actually take effect: once `autoServerMode` flips, `switchMap`
    // tears down `clientSource$`'s subscription and subscribes `serverContent$` fresh, which
    // immediately fires a (server-style) fetch against the CURRENT page/sort/search/filters —
    // so page changes from that point on correctly reach `fetchFn`. This means the very fetch
    // that revealed the mismatch runs twice (once as the client attempt, once more immediately
    // after upgrading) — a one-time, initial-load-only cost, not a per-page-change one.
    const rawData = toSignal(
      toObservable(serverMode, { injector }).pipe(
        switchMap((isServer) => (isServer ? serverContent$ : clientSource$)),
      ),
      { injector, initialValue: [] as RowType[] | GridData<RowType> },
    );

    const fetchedContent = computed(() => extractContent(rawData()));

    // seed auto-generated columns once, from the first row of the first successful fetch
    let autoColumnsSeeded = !!configColumns();
    effect(
      () => {
        const content = fetchedContent();
        if (!autoColumnsSeeded && content.length) {
          autoColumnsSeeded = true;
          autoColumnsSig.set(
            autoGenerateColumns(
              content[0],
              activeParams().maxAutoColumns ?? 6,
              activeParams().lastDotAsName,
            ),
          );
        }
      },
      { injector },
    );

    const clientFilteredSorted = computed(() => {
      if (serverMode()) return fetchedContent();
      let list = fetchedContent();
      const fields = searchFieldsSig();
      if (fields.some((f) => f.value))
        list = list.filter((r) => matchesSearchFields(r, fields, leafColumns()));
      const filters = filtersSig();
      if (Object.keys(filters).length) {
        const cfg = activeParams().filterConfig;
        list = list.filter((r) =>
          matchesFilters(r, filters, cfg?.filterOperators, cfg?.filterCombination),
        );
      }
      return sortRows(list, sortSig());
    });

    const totalLength = computed(() => {
      if (serverMode()) return extractTotal(rawData(), activeParams().totalLength);
      return activeParams().totalLength ?? clientFilteredSorted().length;
    });

    const naturalRows = computed<RowType[]>(() => {
      if (serverMode()) return fetchedContent();
      const list = clientFilteredSorted();
      const s = size();
      if (!s) return list;
      const start = (page() - 1) * s;
      return list.slice(start, start + s);
    });

    // ── manual row order (drag-and-drop, GridParameter.rowsDraggable) ──
    // Scoped to the current page/sort/search/filter state — reset whenever any of those change
    // (see the setters below), since a previous manual order no longer corresponds to a
    // meaningfully "same" set of rows once the underlying row set changes for another reason.
    // Rows are matched by identity (rowId), so an incidental background refetch of the SAME
    // page/sort/filter state keeps the user's drag order intact.
    const manualRowOrder = signal<unknown[]>([]);
    const rows = computed<RowType[]>(() => {
      const natural = naturalRows();
      const order = manualRowOrder();
      if (!order.length) return natural;
      const identifierKey = activeParams().identifierKey;
      const byId = new Map(natural.map((r) => [getRowId(r, identifierKey), r]));
      const orderSet = new Set(order);
      const ordered = order.map((id) => byId.get(id)).filter((r): r is RowType => r !== undefined);
      const remaining = natural.filter((r) => !orderSet.has(getRowId(r, identifierKey)));
      return [...ordered, ...remaining];
    });

    // A genuinely new `gridData`/`fetchFn` means a fundamentally different row set — mirrors
    // `selectOption()`'s existing reset (page 1, drop any manual drag order), so a smaller
    // replacement dataset doesn't land on a now-out-of-range page. Skips its own first
    // (build-time) run — same "fire on change only" idiom as `onChangeOnly` below.
    let firstDataSourceRun = true;
    effect(
      () => {
        dataSourceParams();
        if (firstDataSourceRun) {
          firstDataSourceRun = false;
          return;
        }
        page.set(1);
        manualRowOrder.set([]);
        // columns discovered from the PREVIOUS dataset (canAddColumns) don't necessarily apply
        // to a fundamentally different row set — drop them rather than leak stale/blank columns
        discoveredColumnsSig.set([]);
      },
      { injector },
    );

    // ── row/cell spans (mergeCells auto vertical-merge + manual GridCell overrides) ──
    // Keyed by column KEY, not position — `visibleColumns()` order can change (drag/move reorder),
    // so a positional plan would apply spans to the wrong cell after a reorder. `cols` here uses
    // the CURRENT display order of real (non-synthetic) columns, since "does a colspan hide the
    // next column" must follow what the user actually sees, not the static declaration order.
    const realVisibleColumns = computed(() =>
      visibleColumns().filter((c) => !SYNTHETIC_COLUMN_KEYS.has(c.key)),
    );
    const renderPlan = computed<Record<string, CellSpan>[]>(() =>
      buildCellSpanPlan(rows(), realVisibleColumns(), !!activeParams().mergeCells),
    );

    const hasSpannedCells = computed(
      () =>
        headerRows().some((r) => r.cells.some((c) => c.colspan > 1 || c.rowspan > 1)) ||
        renderPlan().some((row) => Object.values(row).some((s) => s.rowspan > 1 || s.colspan > 1)),
    );

    // ── selection (current-page-only "select all") ──
    const selectedSig = signal<RowType[]>(initialParams.initialSelected ?? []);
    const rowId = (row: RowType): unknown => getRowId(row, activeParams().identifierKey);
    const isSelected = (row: RowType): boolean => {
      const id = rowId(row);
      return selectedSig().some((r) => rowId(r) === id);
    };

    let autoSelectedFirstRow = false;
    effect(
      () => {
        if (
          activeParams().autoSelectFirstRow &&
          !autoSelectedFirstRow &&
          rows().length &&
          !selectedSig().length
        ) {
          autoSelectedFirstRow = true;
          selectedSig.set([rows()[0]]);
        }
      },
      { injector },
    );

    // ── expansion ──
    const expandedSig = signal<RowType[]>(
      (initialParams.rowDetail?.initialExpanded as RowType[]) ?? [],
    );

    // ── render mode ──
    const renderModeSig = signal<GridRenderMode>(
      initialParams.renderMode?.initialMode ?? initialParams.renderMode?.modes?.[0] ?? 'table',
    );

    // ── public state snapshot ──
    const state = computed<GridState<RowType>>(() => ({
      gridData: { content: rows(), totalLength: totalLength(), page: page(), size: size() },
      searchFields: searchFieldsSig(),
      filters: filtersSig(),
      sort: sortSig(),
      selected: selectedSig(),
      expandedRows: expandedSig(),
      columnState: columnState(),
      renderMode: renderModeSig(),
    }));

    // ── fire-on-change-only callbacks (skip the first, synchronous run — mirrors generic-form SPEC §15) ──
    const onChangeOnly = <T>(source: Signal<T>, cb: ((value: T) => void) | undefined): void => {
      if (!cb) return;
      let first = true;
      effect(
        () => {
          const value = source();
          if (first) {
            first = false;
            return;
          }
          cb(value);
        },
        { injector },
      );
    };
    onChangeOnly(columnState, initialParams.onColumnStateChange);
    onChangeOnly(selectedSig, initialParams.onRowSelection);
    onChangeOnly(expandedSig, initialParams.rowDetail?.onExpandChange);
    onChangeOnly(renderModeSig, initialParams.renderMode?.onModeChange);
    onChangeOnly(
      computed(() => activeParams().gridOptions ?? []),
      initialParams.optionChange,
    );

    // factored out so `addColumnsFromData` (canAddColumns) can reuse it alongside `instance.getAllRows`
    const getAllRows = async (): Promise<RowType[]> => {
      if (!serverMode()) return clientFilteredSorted();
      // server mode: ask for everything in one page rather than looping per-page
      const all = await normalizeToPromise(
        activeParams().fetchFn!({ ...pageDetails(), page: 1, size: totalLength() || 100000 }),
      );
      return extractContent(all);
    };

    const instance: GridInstance<RowType> = {
      params: activeParams,
      loading,
      error,
      headerRows,
      columns,
      leafColumns,
      columnState,
      visibleColumns,
      hasWidthOverrides,
      page,
      size,
      sort: sortSig,
      searchFields: searchFieldsSig,
      hasSearchableColumns,
      filters: filtersSig,
      rows,
      totalLength,
      cellSpan: (rowIndex, columnKey) => renderPlan()[rowIndex]?.[columnKey] ?? EMPTY_SPAN,
      hasSpannedCells,
      selected: selectedSig,
      expandedRows: expandedSig,
      renderMode: renderModeSig,
      gridOptions: computed(() => activeParams().gridOptions ?? []),
      selectedOptionSlug,
      state,

      setPage: (p) => {
        page.set(p);
        manualRowOrder.set([]);
      },
      setSize: (s) => {
        size.set(s);
        page.set(1);
        manualRowOrder.set([]);
      },
      setSort: (s) => {
        sortSig.set(s);
        page.set(1);
        manualRowOrder.set([]);
      },
      toggleSort: (column) => {
        if (!column.sortable) return;
        const current = sortSig();
        if (current?.key !== column.key) sortSig.set({ key: column.key, direction: 'asc' });
        else if (current.direction === 'asc') sortSig.set({ key: column.key, direction: 'desc' });
        else sortSig.set(undefined);
        page.set(1);
        manualRowOrder.set([]);
      },
      setSearchFields: (fields) => {
        searchFieldsSig.set(fields);
        page.set(1);
        manualRowOrder.set([]);
      },
      setFilters: (filters) => {
        filtersSig.set(filters);
        page.set(1);
        manualRowOrder.set([]);
      },
      clearFilters: () => {
        filtersSig.set({});
        page.set(1);
        manualRowOrder.set([]);
      },
      refetch: () => refetchTrigger.update((n) => n + 1),
      selectOption: (slug) => {
        selectedOptionSlug.set(slug);
        page.set(1);
        manualRowOrder.set([]);
        refetchTrigger.update((n) => n + 1);
      },
      getAllRows,
      addColumnsFromData: async () => {
        const all = await getAllRows();
        const known = new Set(leafColumns().map((c) => c.key));
        const discovered = discoverColumnsFromData(all, known, activeParams().lastDotAsName);
        if (discovered.length) discoveredColumnsSig.update((cols) => [...cols, ...discovered]);
      },

      rowId,
      isSelected,
      toggleSelect: (row) => {
        const mode: GridSelectionMode = activeParams().selectionMode ?? 'none';
        if (mode === 'none') return;
        const id = rowId(row);
        selectedSig.update((list) => {
          const exists = list.some((r) => rowId(r) === id);
          if (mode === 'single') return exists ? [] : [row];
          return exists ? list.filter((r) => rowId(r) !== id) : [...list, row];
        });
      },
      isAllSelectedOnPage: () => rows().length > 0 && rows().every((r) => isSelected(r)),
      toggleSelectAllOnPage: () => {
        const pageRows = rows();
        const allSelected = pageRows.length > 0 && pageRows.every((r) => isSelected(r));
        selectedSig.update((list) => {
          if (allSelected) {
            const pageIds = new Set(pageRows.map((r) => rowId(r)));
            return list.filter((r) => !pageIds.has(rowId(r)));
          }
          const existingIds = new Set(list.map((r) => rowId(r)));
          return [...list, ...pageRows.filter((r) => !existingIds.has(rowId(r)))];
        });
      },
      clearSelection: () => selectedSig.set([]),

      isExpanded: (row) => {
        const id = rowId(row);
        return expandedSig().some((r) => rowId(r) === id);
      },
      toggleExpand: (row) => {
        const id = rowId(row);
        const multi = activeParams().rowDetail?.multiExpand ?? false;
        expandedSig.update((list) => {
          const exists = list.some((r) => rowId(r) === id);
          if (exists) return list.filter((r) => rowId(r) !== id);
          return multi ? [...list, row] : [row];
        });
      },

      setColumnWidth: (key, width) =>
        columnOverrides.update((o) => ({ ...o, [key]: { ...o[key], width } })),
      setColumnVisible: (key, visible) =>
        columnOverrides.update((o) => ({ ...o, [key]: { ...o[key], visible } })),
      setColumnPinned: (key, pinned) =>
        columnOverrides.update((o) => ({ ...o, [key]: { ...o[key], pinned } })),
      // `fromIndex`/`toIndex` are indices into the REAL (non-synthetic) columns only — exactly
      // what the column panel lists and drags (it never shows drag/index/select/expand/actions
      // columns, see SYNTHETIC_COLUMN_KEYS) — not into `columnState()`'s full array, which also
      // carries those structural columns. Reassigns order only among real columns; synthetic
      // columns' order is never touched (their position is always fixed — see `visibleColumns`).
      moveColumn: (fromIndex, toIndex) => {
        const arr = columnState()
          .filter((s) => !SYNTHETIC_COLUMN_KEYS.has(s.key))
          .map((s) => s.key);
        const [moved] = arr.splice(fromIndex, 1);
        if (moved === undefined) return;
        arr.splice(toIndex, 0, moved);
        columnOverrides.update((o) => {
          const next = { ...o };
          arr.forEach((key, i) => (next[key] = { ...next[key], order: i }));
          return next;
        });
      },
      resetColumnState: () => columnOverrides.set({}),

      setRenderMode: (mode) => renderModeSig.set(mode),

      dragRow: (fromIndex, toIndex) => {
        const params = activeParams();
        if (!params.rowsDraggable) return;
        const current = rows();
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= current.length ||
          toIndex >= current.length
        ) {
          return;
        }
        const arr = [...current];
        const [moved] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, moved);
        manualRowOrder.set(arr.map((r) => getRowId(r, params.identifierKey)));
        params.onRowDrag?.(arr, moved);
      },

      destroy: () => subs.forEach((s) => s.unsubscribe()),
    };

    return instance;
  }
}
