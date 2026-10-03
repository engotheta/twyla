# Data Grid — Runtime Specification

Types define **what** a config is; this document defines **how** the engine
behaves. Scoped to the areas covered by the header/body-span, export,
search, drag-feedback, and span-border work — it does not re-document every
`GridParameter`/`GridColumn_` prop (see each interface file's own JSDoc for
that), and it isn't a from-scratch spec of the whole grid. Extend it
incrementally, the same way `generic-form/SPEC.md` grew a section at a time.

Vocabulary: "the engine" = `GridEngineService` + `GridInstance`. "instance"
= one built `GridInstance<RowType>`.

---

## 1. Header & body cell spans

- The header matrix (`GridInstance.headerRows`) is computed by
  `buildHeaderRows` (`grid-column.helpers.ts`) from the nested
  `GridColumn_.columns` tree: leaf columns get `rowspan` stretching down to
  the deepest header row; group/parent columns get `colspan` equal to their
  visible leaf-descendant count. A header row's `cells` array is **sparse**
  — a cell reached via a previous row's `rowspan` is never repeated — the
  same convention an HTML `<tr>` uses natively.
- Body cell spans (`GridInstance.cellSpan(rowIndex, columnKey)`) come from
  `buildCellSpanPlan` (`grid-engine.service.ts`, exported), precedence high
  to low: (1) manual per-cell overrides (`GridRow._cellsProps[key].rowspan`/
  `colspan`) — wins over both auto mechanisms below, for any cell it covers;
  (2) horizontal auto-merge, opted into per ROW via `_rowProps.mergeConsecutive`
  — a streak of consecutive REAL columns (current display order) with equal
  resolved values, first cell spans them via `colspan`; (3) vertical
  auto-merge, opted into per COLUMN via `GridColumn_.mergeConsecutive`
  (falls back to the grid-wide `GridParameter.mergeCells` default when a
  column doesn't set its own) — a streak of consecutive ROWS with equal
  resolved values in that column, first cell spans them via `rowspan`. (2)
  only short-circuits a cell when it's an ACTUAL streak member — `colspan > 1`
  (streak start) or `hidden` (streak continuation); a column with no
  horizontal match at all (the common case for most cells on a row that
  merely opted into `_rowProps.mergeConsecutive`) still falls through to
  (3) — opting a ROW into horizontal merge must not silently block EVERY
  one of its cells from ever being considered for vertical merge, even the
  ones with nothing to merge horizontally (this was a real bug: the
  row-merge lookup always returns an entry per column, including trivial
  "streak of 1" ones, so checking only "does an entry exist" rather than
  "is it an actual span" always won, starving vertical merge entirely
  wherever row-merge was active). A cell already covered by an EARLIER
  cell's span on either axis is skipped before any of these checks run,
  same "first cell in a streak wins" rule both axes — a covered cell's
  OWN manual override, if it has one, is never independently consulted.
- The plan is keyed by column **key**, not position, and computed over
  columns in their CURRENT display order — so it survives column drag
  reorder. The header matrix does too: `headerRows` reorders the nested
  `columns` tree to match `columnState`'s order (`orderColumnsForHeader`,
  `grid-column.helpers.ts`) BEFORE computing spans, at every tree level (a
  group's own children reorder among themselves; the group itself is
  positioned by its minimum child order) — so a flat (non-nested) column
  set (the common case) always renders its headers in the exact order
  `visibleColumns()` renders its body cells in. The one case that still
  falls back to declaration order: a leaf dragged to interleave with a
  DIFFERENT group's leaves (crossing a group boundary) — a group's header
  cell must span a contiguous leaf range, so that specific reorder has no
  sane single rendering. Every other reorder, including moving a whole
  group, composes correctly.
- Spans exist only in **table** render mode — list/cards never render a
  `<table>`, so span geometry is meaningless there.
- A cell with BOTH `rowspan > 1` AND `colspan > 1` covers a 2D rectangle:
  `buildCellSpanPlan` (`grid-engine.service.ts`) marks EVERY column the
  colspan reaches as covered for the full rowspan duration, not just the
  cell's own starting column — marking only the starting column (the
  original bug) left the OTHER spanned columns unmarked from the second
  covered row onward, so they rendered their own independent (unhidden)
  cells there, shifting everything after them rightward and overflowing
  the table's edge. The cell's own first row always rendered correctly
  (colspan is applied within that row regardless); only rows below it
  were affected.

## 2. Column reordering & structural (synthetic) columns

- `GridColumnState.order` only ever governs REAL columns' relative order.
  Synthetic (non-data) leaf columns — `DRAG_COLUMN_KEY`/`INDEX_COLUMN_KEY`/
  `SELECT_COLUMN_KEY`/`EXPAND_COLUMN_KEY` (leading) and `ACTIONS_COLUMN_KEY`
  (trailing), collectively `SYNTHETIC_COLUMN_KEYS` — are structural: their
  position is always fixed (leading in that relative order, or trailing)
  regardless of what their own `order` value happens to be. `visibleColumns`
  composes `[...leadingSyntheticColumns(), ...orderedRealLeafColumns(), ...trailingSyntheticColumns()]`
  explicitly, rather than sorting one flat list that mixes both kinds —
  `headerRows`'s synthetic cells were already spliced in at fixed edges this
  way; `visibleColumns` didn't used to be, which was the bug this fixes:
  the grid panel never lists synthetic columns (they're not real,
  user-facing config — their presence is controlled by grid params like
  `rowsDraggable`/`selectionMode`/`addIndexColumn`, not a per-column
  toggle), so a shared flat order-sort let a synthetic column's `order`
  drift into the middle of the real columns whenever the two disagreed
  about index space (see `moveColumn` below) — header stayed put (fixed
  edges) while the body cell moved, a visible header/body mismatch
  specifically for whichever synthetic column got shuffled.
- `orderedRealLeafColumns` (flattened from `orderedColumnsTree`, §1) is the
  ONE source of truth for real-column order — both `headerRows` (as a
  tree) and `visibleColumns` (flattened) render from it, so they can't
  disagree. `orderedColumnsTree` also applies each leaf's live `columnState`
  override (width/pinned, via `applyColumnOverrides`/`applyColumnState`,
  `grid-column.helpers.ts`) on top of the reorder, restoring the same
  single-source-of-truth guarantee for a resized/pinned column: before this,
  `headerRows` read straight from the static, never-overridden `columns()`
  tree, so a column-resize drag updated `visibleColumns()`/body `<td>`s but
  never the `<th>` actually bound to a width style — the header simply never
  moved.
- `GridInstance.moveColumn(fromIndex, toIndex)` takes indices into the REAL
  columns only — exactly what `grid-column-panel` lists and drags (it
  filters `columnState()` down to non-synthetic keys before rendering,
  same filter as here). This used to take indices into the FULL
  `columnState()` array (real + synthetic mixed), which silently
  mismatched whenever any leading synthetic column was present (drag
  handle / index / select — all rendered before the first real column),
  since the panel always passed indices relative to its own real-only
  list: dragging the panel's first entry to its third position, with two
  leading synthetic columns active, actually spliced `columnState()[0]`
  (the drag-handle column) to position 2 instead of the intended real
  column. Fixed by reordering a real-keys-only array and reassigning
  `order` only to those keys — synthetic columns' `order` is never
  written by `moveColumn`, and is never read for positioning either.

## 3. Span-aware borders

- `GridInstance.hasSpannedCells` is a single grid-wide boolean: true when
  ANY header or body cell currently spans more than one row/column. When
  true, a `border` utility is added to every header and body cell
  uniformly (`data-grid.component.ts` `headerCellClass`/`bodyCellClass`) —
  not just the merged region's own edges. A per-region-only border was
  considered and rejected: next to non-bordered cells it reads as
  accidentally-missing borders rather than a deliberate visual grouping.
- Table mode only, same reasoning as §1.

## 4. Export fidelity

- `GridExportService` builds the header matrix and body span plan **fresh**
  for each export (`orderColumnsForHeader` + `buildHeaderRows(instance.columns(), visibleKeys)`
  / `buildCellSpanPlan(rows, columns, mergeCells)`), rather than reading
  `instance.headerRows()` / `instance.cellSpan()` off the live instance.
  Three reasons: (a) `instance.cellSpan()` is only ever populated for the
  CURRENT PAGE's rows, but `exportAllData: true` exports every matching
  row — recomputing against the actual exported row set keeps merges
  correct in both cases; (b) `instance.headerRows()` always includes
  synthetic columns (drag/index/select/expand/actions) spliced in, which
  export explicitly excludes, and never reflects `cfg.allFields` (all leaf
  columns, not just visible ones) — recomputing directly against export's
  own resolved column set avoids silently mismatching either config; (c) it
  still needs `columnState`'s order applied explicitly (same as §1) so a
  drag-reordered grid exports in the order it's actually displayed in.
- Excel: nested/grouped headers and merged body cells become real
  `Worksheet.mergeCells(...)` ranges. Because `exceljs` has no browser-table
  layout algorithm, the header writer keeps an "occupied until row N" map
  per column position to convert the header matrix's sparse per-row cells
  into absolute (row, col) coordinates — the same bookkeeping a browser does
  for free when the live grid renders `<th rowspan>`. Every written cell
  (header and body) gets an explicit thin border (`EXCEL_CELL_BORDER`) —
  `exceljs` never adds cell borders on its own, unlike a `<table>`'s default
  browser styling or jspdf-autotable's own default theme, so without this
  the sheet would render with no gridlines at all.
- PDF: nested headers and merged body cells become `jspdf-autotable`
  `CellDef[]` rows with `rowSpan`/`colSpan` — the library resolves absolute
  column positions from sparse per-row arrays itself, so (unlike Excel) no
  manual position bookkeeping is needed; a covered cell is simply omitted
  from that row's array, exactly like the header matrix already omits it.
  `theme: 'grid'` is set explicitly — the library's default theme
  (`'striped'`) only borders the header row, not every cell.
- CSV stays flat by construction — no format-native concept of merged
  cells or multi-row headers.
- Row-detail content (`GridRowDetailConfig`) is never exported in any
  format — it's arbitrary component/template content with no structured
  data mapping. This is a permanent, deliberate exclusion, not a gap.
- Synthetic columns (drag/index/select/expand/actions) are always excluded,
  same as before this work.

## 5. Search: `searchFields`

- `GridState.searchFields` / `PageDetails.searchFields` fully replaced the
  old single-string `searchTerm` — there is no grid mode that still uses a
  flat string. When zero columns are marked `GridColumn_.searchable`, the
  array holds exactly one entry with `key: undefined`, which searches
  across every leaf column (the same substring match `searchTerm` used to
  do) — `matchesSearchFields` special-cases this via `matchesSearchTerm`.
- Combination across `fields` entries is **OR** ("does this row match ANY
  active search instance") — the opposite default of `filters`'s **AND**
  (`matchesFilters`, `grid-filter.interface.ts`/`GridFilterConfig`). These
  are two separate, coexisting features; don't conflate them.
- `showSearch` (`data-grid.component.ts`) is never hidden purely because
  the result set narrowed below one page — it's the paginator-driven
  default OR'd with "any searchFields entry currently has a value". Root
  cause of the old bug: `showPaginator` (and therefore the old
  `showSearch` default) was derived from `totalLength()`, which in client
  mode is the ALREADY-search-filtered count — so narrowing a result set
  down to a page's worth flipped the search box's own visibility off
  mid-typing.
- `searchType` resolution order for a raw text value, when not explicitly
  overridden by the user: the selected column's own `GridColumn_.searchType`
  → `GridSearchConfig.defaultSearchType` → `'like'`.
- `matchesOperator`'s `equals`/`notEquals`/`greaterThan*`/`lessThan*` cases
  do strict/raw comparisons. A search instance's value is always a raw
  string (a plain text input), so it's coerced (`coerceSearchValue`,
  `grid-row.helpers.ts`) toward the target column's `type` before those
  operators run — except `'like'`, which always compares raw strings (
  coercing to a `Date`/`number` first would change its fuzzy-substring
  semantics, e.g. a partial `"2024-01"` match against a date value).
- Add/remove: a "+" only appears once the last visible instance has a
  value AND at least one `searchable` column remains unused by another
  instance (`ObjectField.canAddItem`, a `Dynamic<boolean>` observer — see
  generic-form/SPEC.md §4). The remove icon appears on every instance
  except the first, unconditionally — not gated by count, unlike the
  stock `isList` "remove" button (`object-field.component.ts`), which is
  why `grid-search-fields` renders its own per-item list chrome via
  `FormEngineService` + `<form-field>` directly instead of
  `<generic-form>`/`ObjectFieldComponent`'s built-in list template.
- Each instance's own "column" dropdown excludes columns already picked by
  OTHER instances (never itself) — the `'./key'` relative-observer-path
  extension (generic-form/SPEC.md §4) is what makes this expressible per
  clone without hand-rolling index bookkeeping.
- `searchFieldsMode: 'inline'` (default): every instance renders directly
  in the toolbar row, one `FormInstance` shared by nothing else.
  `'modal'`: the toolbar mount shows ONLY the first instance; clicking "+"
  adds the new item to the SAME `FormInstance` and opens
  `grid-search-dialog`, which reuses that exact instance (passed via
  `MAT_DIALOG_DATA`, not rebuilt) to render every instance including the
  first — so the toolbar and the dialog can never diverge into two forms
  describing the same search state.
- Server mode: `searchFields` is always forwarded via `PageDetails`,
  exactly like `filters` already was — `fetchFn` implements whichever
  fields it cares about; the grid does no server-side filtering itself.
- In `'modal'` mode, once a 2nd+ instance exists, the toolbar mount always
  shows a "view all" button (badged with the total count) instead of the
  first-instance-only view's own "+" — independent of whether adding
  another instance is currently allowed (`canAdd()`), since without this
  there was no way back into the dialog once its own "+"/"add" affordance
  became unavailable (e.g. the last item added was left empty) — a
  dead-end the count badge always escapes. `grid-search-dialog` itself is
  draggable by its title bar (`cdkDrag`/`cdkDragHandle`, CDK's
  `cdkDragRootElement: '.cdk-overlay-pane'` pattern for moving the actual
  positioned overlay, not just an inner wrapper) so it can be pulled aside
  if it's covering the toolbar's own search trigger. A "Clear" button
  (`grid-search-fields`) resets back to the single default empty
  instance, mirroring `grid-filter-panel`'s own Clear button.

## 6. Drag-and-drop visual feedback

- Row dragging (`GridParameter.rowsDraggable`) and column-panel dragging
  both use `@angular/cdk/drag-drop`'s `cdkDropList`/`cdkDrag`, which
  already animates sibling reflow ("making way for the dropped item") for
  free — that part needs no custom code. The gap this work closes is
  purely placeholder/preview STYLING, which CDK leaves unstyled by
  default.
- Row placeholder (table mode) is deliberately CDK's DEFAULT
  placeholder — an automatic clone of the dragged `<tr>` — not a custom
  `*cdkDragPlaceholder` template. A custom template can't place a literal
  `<tr>` there (Angular's template parser rejects a `<tr>` nested inside
  another `<tr>`, which is exactly how `*cdkDragPlaceholder` would have to
  be authored on a `<tr cdkDrag>`), and CDK's default clone is already
  `<tr>`-shaped and correctly sized since it's a real clone of the source
  row. It's styled into an empty dashed gap via `tr.cdk-drag-placeholder`
  in `data-grid.component.scss` (dim background, dashed outline, hidden
  cell content) rather than templated. List mode has no such constraint
  (its container is a `<div>`) and uses a real `*cdkDragPlaceholder`,
  sized from the dragged row's own captured height
  (`onRowDragStarted`/`draggedRowHeightPx`) since an empty `<div>` has no
  natural height to collapse to.
- The row drag preview is a true clone of the row's real columns — a
  fixed-width flex container of `<grid-cell>` (the SAME component real
  body cells render through) at each column's real width, with
  `pointer-events-none` so the throwaway clone never triggers inline-edit
  or cell click handlers while dragging.
- Column-panel drag preview/placeholder are both plain `<div>`s (its
  drop list is a `<div>`, not a table) — no structural constraint there,
  just a stylistic upgrade from CDK's stock clone for visual consistency
  with the row treatment.

## 7. Export: column picker

- Every export (any format, triggered from the toolbar's export menu)
  opens `grid-export-panel` first — there is no direct-download path
  anymore. Cancelling exports nothing.
- The picker's candidate set is wider than declared columns: every
  `instance.leafColumns()` entry PLUS every top-level key actually present
  on the current page's rows that isn't a declared column at all
  (`discoverExtraKeys`) — covers e.g. an auto-generated grid capped at
  `maxAutoColumns`, or fields a consumer never bothered declaring. Initial
  selection/order = `GridExportConfig.initialKeys` when set, else the
  grid's own current `visibleColumns()`, in their current order; everything
  else is appended after, unselected — dragging (mirrors
  `grid-column-panel`) can freely reorder and mix all groups before
  confirming.
- On confirm, `GridExportService.export()` receives the chosen, ordered
  `GridColumn_[]` directly (`overrideColumns`) — declared keys reuse their
  real `GridColumn_` (keeps type/formatting), undeclared keys get a
  minimal synthesized `{ key, label }`. This bypasses `resolveColumns()`'s
  own visible/`allFields`/`hiddenKeys` logic entirely; those `GridExportConfig`
  options only matter for the (no longer reachable) direct-export path,
  effectively superseded by the picker's own selection.
- `resolveHeaderRows` still computes a real nested/grouped header for every
  picker-selected key that IS in the declared `columns` tree — the common
  case (picker's default, unmodified selection) renders identically to the
  non-picker path, nested headers included. Only keys that AREN'T in the
  tree at all (raw fields with no group membership) fall back to flat,
  ungrouped leaf cells, appended after the tree-based header cells in
  their own relative order — NOT the whole header, just the ungroupable
  portion of it. (An earlier version of this fell back to a fully flat
  header the moment `overrideColumns` was involved at all, which silently
  lost nested/grouped headers even for the common case where nothing about
  the declared columns' own structure had changed — fixed.)
- `exportAllData` now **defaults to `true`** (fetch and export every
  matching row) — set it to `false` explicitly to export only the current
  page, the old default.

## 8. Filters: display mode

- `GridFilterConfig.filtersMode` (`'modal'` default, `'inline'`) controls
  WHERE `gridFilters` renders — a toggle button opening a
  `cdkConnectedOverlay` panel, or directly in the toolbar row with no
  toggle — independent of `filtersTrigger` (`'manual'`/`'live'`), which
  controls WHEN filters apply. `grid-filter-panel`'s `inline` input swaps
  its own box chrome (width cap, scroll, border/shadow) for a plain flex
  row and lays `gridFilters` out horizontally
  (`fieldsContainerClass`) — mirrors `GridSearchConfig.searchFieldsMode`'s
  inline/modal split, and reuses the same generic-form field-layout
  mechanism `grid-search-fields` would if it needed to.

## 9. Server vs. client pagination: auto-upgrade

- `GridParameter.serverPaginated` decides which of two RxJS pipelines
  feeds the grid: `serverContent$` (reacts to `pageDetails` — page, sort,
  search, filters — and refetches on every change) or `clientSource$`
  (reacts only to `refetchTrigger`; assumes `fetchFn`/`gridData`
  already returns the full row set and pages/sorts/filters it locally).
  Forgetting `serverPaginated: true` on a `fetchFn` that's actually
  written for server paging (takes `page`/`size`, returns a real
  `totalLength`) used to mean page changes silently never reached it.
- The engine now self-corrects: if a client-mode fetch resolves to a
  `GridData` (not a plain array) with a numeric `totalLength` while
  `serverPaginated` is still falsy, an internal `autoServerMode` signal
  flips true and `serverMode` (`grid-engine.service.ts`) becomes true
  from then on, same as if `serverPaginated` had been set from the
  start.
- **One-way and one-time**: `autoServerMode` never resets, and the check
  only runs while it's still unset — an explicit `serverPaginated: true`
  is never overridden, and the grid never auto-*downgrades* back to
  client mode.
- `rawData` is fed via `toObservable(serverMode).pipe(switchMap(...))`
  rather than a one-time ternary, specifically so this upgrade can take
  effect mid-session: flipping `autoServerMode` tears down
  `clientSource$`'s subscription and subscribes `serverContent$` fresh,
  which immediately fetches against the current page/sort/search/filters
  — so the very next (and all subsequent) page changes reach
  `fetchFn` correctly. The practical cost is that the initial fetch
  that revealed the mismatch runs twice (once client-mode, once more
  immediately after upgrading) — a one-time startup cost, not a
  per-page-change one.

## 10. Click-to-view-details (`viewDetailsClicks`)

- `DataGridComponent.onRowClick` counts clicks per row (keyed by
  `instance.rowId(row)`, accumulated for the life of the grid instance —
  not reset by a timeout) and, once the count reaches
  `GridParameter.viewDetailsClicks`, hosts whatever component is provided
  for the `ROW_DETAILS_COMPONENT` injection token (`row-details.token.ts`)
  in a `ViewService` dialog —
  `view.open(this.rowDetailsComponent, { title: 'Details', inputs: { params: { entity: row } } })`
  — then resets that row's count to 0; if nothing is provided for the
  token, the click-counting is skipped entirely. `DetailsComponent` is the
  intended component for this (app-wide via
  `{ provide: ROW_DETAILS_COMPONENT, useValue: DetailsComponent }`, see
  `app.config.ts`), but data-grid never imports it directly — `field-group`
  (a `details` descendant) renders `<data-grid>` for tabular array columns,
  so a direct import back to `details.component` would form a
  `data-grid -> details -> data-grid` circular standalone-component
  dependency. The dialog shell (`view/view-dialog.component.ts`) supplies
  the title bar and close button, so `DetailsComponent` has no dialog mode
  of its own — it just receives `{ entity: row }` on its `params` input,
  exactly as when embedded. With no `visibleFields`/`fieldGroups` passed,
  `resolveDetailGroups`/`getAllFields` derive fields directly from the row
  object itself: every own field is shown, with no per-grid setup required.
- Default is 7 when `viewDetailsClicks` is left unset — a deliberate,
  rarely-accidental gesture (rapid repeat clicks on the same row), not a
  primary interaction; set an explicit lower number for an easier-to
  reach "view details" affordance, or `0` to disable the behavior
  entirely. `rowClick` (if provided) always fires on every click
  regardless of this feature or its threshold.
- Table/list/cards render modes all wire the same `onRowClick`, but
  clicks that land on an interactive control inside the row (checkbox,
  radio, drag handle, expand toggle, row action buttons — the latter via
  `ActionButtonComponent.handleClick`'s own unconditional
  `stopPropagation()`) never reach it — only clicks on otherwise-inert
  parts of the row count.

## 11. Column width: precise resize vs. an "autoish" unsized default

- Table mode uses `table-layout: fixed` (`data-grid.component.html`'s
  `<table>`) with a `<colgroup>` — one `<col>` per `visibleColumns()` entry,
  in the same order the body `<td>`s render — driving each column's width
  authoritatively (see §2's note on `orderedColumnsTree`/resize precision).
  `<th>`/`<td>` themselves no longer bind `width` directly; the `<colgroup>`
  is the one place it's set, sidestepping how a grouped/nested header's own
  colspan'd `<th>` (§1) would otherwise divide a width across its children
  and silently override what those leaf columns actually want.
- A column with no explicit `width` (author-configured or resized) still
  needs SOME concrete value under `table-layout: fixed` — a single flat
  number for every unsized column (regardless of whether it holds an id, a
  yes/no flag, or a paragraph-length description) looks wrong. Instead,
  `DataGridComponent.estimateColumnWidth` (`data-grid.component.ts`) gives
  each unsized column a width estimated from what's known synchronously at
  config time: a known-shape `type` (`boolean`/`date`/`number`/...) gets a
  typical width for that shape, independent of its label's length; anything
  else (typically `'text'`) sizes to its header label's character count.
  Clamped to `[COLUMN_WIDTH_ESTIMATE_MIN, COLUMN_WIDTH_ESTIMATE_MAX]`. This
  is a heuristic, not real cell-content measurement (no extra render pass,
  no per-row scanning) — a reasonable starting point the user can always
  override by dragging, not a precise fit. Results are cached per column
  key (`columnWidthEstimates`), since the `<colgroup>` binding re-evaluates
  on every change detection pass and a column's config is stable for its
  lifetime. Purely a rendering default — consulted only via
  `column.width ?? estimateColumnWidth(column)`, so it never affects, and is
  never affected by, resize (a resized column's `columnState` width is
  always defined, short-circuiting the estimate).
- A group column's `visible: false` (`GridColumn_.columns` nesting, §1)
  hides its whole subtree, not just itself — `collectAncestorHiddenLeafKeys`
  (`grid-column.helpers.ts`) walks the static `columns()` tree once and
  marks every descendant leaf of a `visible: false` node as forced-hidden,
  consulted by `columnState` (`grid-engine.service.ts`) ahead of — and
  overriding — that leaf's own `visible`/runtime column-state override: a
  child can't be individually un-hidden while its parent section is hidden,
  since there'd be no group header left to show it under anyway. Only the
  STATIC config tree is walked (group columns never get their own
  `GridColumnState` entry — only leaves do), so this isn't something
  toggleable at runtime the way a leaf's own visibility is.
