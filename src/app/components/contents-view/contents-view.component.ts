import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { combineLatest, isObservable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ActionButtonsComponent } from '../action-buttons/action-buttons.component';
import { resolveDynamicValue$ } from '../action-buttons/dynamic-value.util';
import { DataGridComponent } from '../data-grid';
import { DetailsComponent } from '../details/details.component';
import { GenericFormComponent } from '../generic-form';
import { mergeClasses } from '../details/util/class-name/class-name.helpers';
import {
  ContentsSizes,
  ContentsViewInstance,
  ContentsParameter,
  ContentView,
} from './contents.interface';
import { PanelResizeDirective } from './panel-resize.directive';
import {
  claimPersistedSelectionKey,
  readPersistedSelection,
  releasePersistedSelectionKey,
  writePersistedSelection,
} from './persisted-selection.util';
import { SlidingTabIndicatorDirective } from './sliding-tab-indicator.directive';
import { LG_UP_QUERY, mediaQuerySignal } from './viewport.util';
import { clusterEdges, GridAxis } from './grid-metrics.util';

/** one resolved content, ready to render — `visible`/`disabled`/`badge`/`html`
 *  (DynamicValue/Observable-driven) already settled into plain current values */
interface ResolvedContent {
  content: ContentView;
  visible: boolean;
  disabled: boolean;
  badge: string | number | undefined;
  html: string | undefined;
}

/** Recursively flattens a ContentView tree (including every nested `.contents`) into a
 *  flat list — a pure structural walk over the input data, independent of what's
 *  actually mounted (see `ContentsViewInstance.contents`). */
function flattenContents(contents: ContentView[]): ContentView[] {
  const out: ContentView[] = [];
  for (const c of contents) {
    out.push(c);
    if (c.contents?.length) out.push(...flattenContents(c.contents));
  }
  return out;
}

// ── resizable-layout constants + math ──
/** smallest a column / row pane may be dragged to, px */
const MIN_COL_PX = 80;
const MIN_ROW_PX = 60;
/** localStorage namespace for `persisted-selection.util` (see `SlidingTabIndicatorDirective`'s `'tabs'`) */
const SIZES_NAMESPACE = 'contents-sizes';

/** move `deltaPx` between two adjacent panes (`a`, `b` px) keeping their sum and clamping each
 *  to `>= minPx`. Returns the new pair — the caller converts back to fractions. Pure/exported
 *  for unit testing (jsdom has no layout, so the live drag path can't be integration-tested). */
export function redistributePx(a: number, b: number, deltaPx: number, minPx: number): [number, number] {
  const total = a + b;
  const na = Math.min(total - minPx, Math.max(minPx, a + deltaPx));
  return [na, total - na];
}

/** rescale weights so they average 1 (i.e. sum to `arr.length`) — keeps persisted / emitted
 *  fractions small and viewport-width-independent, matching the equal-split seed `[1, 1, …]`. */
function normalizeFractions(arr: number[]): number[] {
  const sum = arr.reduce((s, v) => s + v, 0);
  return sum > 0 ? arr.map((v) => (v / sum) * arr.length) : arr;
}

/** an axis' fraction weights → an explicit `grid-template-*` value, or `null` when there are
 *  fewer than two tracks to enforce so the consumer's own grid is left untouched. `minmax(0, …)`
 *  not bare `fr`: a bare `fr` keeps an `auto` minimum that lets a wide `<data-grid>` child refuse
 *  to shrink so the drag "sticks". */
function trackTemplate(fractions: number[]): string | null {
  return fractions.length >= 2 ? fractions.map((fr) => `minmax(0, ${fr}fr)`).join(' ') : null;
}

/** first-pane share of the pair on either side of gutter `g`, as an integer 0–100 */
function pairPercent(fractions: number[], g: number): number | undefined {
  const a = fractions[g];
  const b = fractions[g + 1];
  return a == null || b == null ? undefined : Math.round((100 * a) / (a + b));
}

/**
 * Renders a `ContentsParameter`: one or more content types (table/details/form/
 * html/component), shown as tabs or a list, recursively nestable via
 * `ContentView.contents` (this component lists itself in its own `imports`, same
 * self-recursion convention as `FieldGroupComponent`). See `contents.interface.ts` for
 * the full contract.
 */
@Component({
  selector: 'contents-view',
  imports: [
    NgComponentOutlet,
    NgTemplateOutlet,
    MatIconModule,
    MatTabsModule,
    SlidingTabIndicatorDirective,
    PanelResizeDirective,
    ActionButtonsComponent,
    DataGridComponent,
    DetailsComponent,
    GenericFormComponent,
    ContentsViewComponent,
  ],
  templateUrl: './contents-view.component.html',
  styleUrl: './contents-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
  },
})
export class ContentsViewComponent implements OnInit {
  readonly params = input.required<ContentsParameter>();
  readonly instanceChange = output<ContentsViewInstance>();

  private readonly activeSlugSig = signal<string | undefined>(undefined);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** live `true` while the viewport is ≥ Tailwind's `lg` (64rem) — drives `contentsFit: 'auto'`
   *  and the one-vs-two-column decision. Static `false` where `matchMedia` is unavailable
   *  (jsdom): tests that need a definite answer stub `window.matchMedia`. */
  private readonly lgUp = mediaQuerySignal(LG_UP_QUERY);

  /** the raw fit mode for THIS level (`'auto'` default). See `ContentsLayout.contentsFit`. */
  protected readonly contentsFit = computed<'auto' | 'cover' | 'flow'>(
    () => this.params().contentsFit ?? 'auto',
  );

  /** `contentsFit` with `'auto'` resolved against the current viewport. */
  protected readonly resolvedFit = computed<'cover' | 'flow'>(() => {
    const fit = this.contentsFit();
    return fit === 'auto' ? (this.lgUp() ? 'cover' : 'flow') : fit;
  });

  /** whether this level is in the bounded, internally-scrolling layout (`resolvedFit() === 'cover'`)
   *  — the "fit into the available view" mode. Every downstream layout class keys off this;
   *  `'flow'` emits none of them and content grows to its natural height. */
  protected readonly isCover = computed(() => this.resolvedFit() === 'cover');

  /** reactive `:host` sizing, replacing the old static `:host { height: 100%; width: 100% }` SCSS
   *  rule — same `host: { '[class]': ... }` pattern `grid-cell.component.ts` already uses for a
   *  reactive host class. `min-h-0` only under `fitIntoView()`: lets THIS element shrink below its
   *  content's natural height when it's itself a flex/grid item of a bounded ancestor (mounted
   *  recursively inside another level's body-scroll-region, or at the top level inside a bounded
   *  flex parent). With fitIntoView() false, omitting it preserves "grow to natural height". */
  protected readonly hostClass = computed(() =>
    ['block h-full w-full', this.isCover() ? 'min-h-0' : ''].filter(Boolean).join(' '),
  );

  /** per-content reactive resolution of visible/disabled/badge/html — mirrors
   *  grid-cell.component.ts's toObservable→switchMap→combineLatest→toSignal pattern,
   *  applied across the whole `contents` array via combineLatest(contents.map(...)) */
  protected readonly resolvedContents = toSignal(
    toObservable(computed(() => this.params().contents)).pipe(
      switchMap((contents) =>
        contents.length
          ? combineLatest(
              contents.map((c) =>
                combineLatest({
                  content: of(c),
                  visible: resolveDynamicValue$(c.visible, c).pipe(map((v) => v ?? true)),
                  disabled: resolveDynamicValue$(c.disabled, c).pipe(map((v) => v ?? false)),
                  badge: isObservable(c.badge) ? c.badge : of(c.badge),
                  html: of(c.type === 'html' ? c.html : undefined).pipe(
                    switchMap((h) => (isObservable(h) ? h : of(h))),
                  ),
                }),
              ),
            )
          : of([]),
      ),
    ),
    { initialValue: [] as ResolvedContent[] },
  );

  protected readonly visibleContents = computed(() => {
    const hasPermission = this.params().hasPermission;
    return this.resolvedContents().filter((rc) => {
      if (!rc.visible) return false;
      if (!hasPermission || !rc.content.permissions?.length) return true;
      return hasPermission(rc.content.permissions, rc.content);
    });
  });

  /** the EFFECTIVE active slug — falls back to the `initialActive`-marked content, then
   *  the first one, until the user (or `selectContent`) explicitly picks one. Backs both
   *  the template's active-tab/panel checks and the instance's `activeSlug()`/
   *  `activeContent()`, so they always agree with what's actually shown. */
  protected readonly effectiveActiveSlug = computed(() => {
    const list = this.visibleContents();
    return (
      this.activeSlugSig() ??
      list.find((rc) => rc.content.initialActive)?.content.slug ??
      list[0]?.content.slug
    );
  });

  /** structural orientation, defaulting horizontal — separate from `tabsContainerClass`, which
   *  is now purely the consumer-supplied presentation class for the toggle-button row itself. */
  protected readonly tabsOrientation = computed<'horizontal' | 'vertical'>(() =>
    this.params().tabsOrientation === 'vertical' ? 'vertical' : 'horizontal',
  );

  /** presents/arranges the tab toggle-button row only. Structural orientation styling (flex-
   *  direction + divider border) is computed directly from `tabsOrientation()` here, rather than
   *  a `> .contents-view-tablist { ... }` SCSS parent-combinator rule — unnecessary since
   *  orientation is already a signal available on the component. `rounded-lg` (a fully-rounded,
   *  standalone pill) when the active tab's own header is shown below it, since that header
   *  already forms its own visually-separate rounded block (`headerClass`'s `rounded-b-lg`);
   *  `rounded-t-lg` (top only) when there's no header in between, so the tablist instead seams
   *  directly into the body content below. Merged (consumer wins conflicts) with
   *  `tabsContainerClass`, which is cascaded down through nested levels by `nestedParameter`. */
  protected readonly tablistClass = computed(() => {
    const vertical = this.tabsOrientation() === 'vertical';

    const activeRc = this.visibleContents().find(
      (rc) => rc.content.slug === this.effectiveActiveSlug(),
    );

    const rounding =
      activeRc && this.showsHeader(activeRc) ? 'rounded-lg mb-2' : 'rounded-t-lg mb-[1px]';

    const structural = [
      'contents-view-tablist bg-white ',
      rounding,
      'flex',
      vertical
        ? 'flex-col flex-none border-r border-black/12'
        : 'flex-row border-b border-black/12',
    ].join(' ');

    return mergeClasses(structural, this.params().tabsContainerClass ?? '');
  });

  /** every content's own wrapper (list item or tab panel). `min-w-0` (existing horizontal fix)
   *  always applies; `flex flex-col h-full min-h-0`, fitIntoView() only, turns it into the
   *  "pinned header + scrollable body" column — the `#header` output is `flex-none` (see the
   *  template), and `bodyClass` is `flex-1 min-h-0 overflow-y-auto`, filling and
   *  independently scrolling whatever's left under the header. With no header, the body wrapper is
   *  the only flex child and (correctly) fills the whole box on its own. */
  private readonly itemBaseClass = computed(() =>
    ['contents-view-item', 'min-w-0', this.isCover() ? 'flex flex-col h-full min-h-0' : '']
      .filter(Boolean)
      .join(' '),
  );

  /** every content's full wrapper class list — `itemBaseClass` merged with the cascaded
   *  `contentsClass`, then this content's own `class` (still wins conflicts last). Shared by both
   *  list items and tab panels (see `panelItemClass`). */
  protected listItemClass(rc: ResolvedContent): string {
    return mergeClasses(
      mergeClasses(this.itemBaseClass(), this.params().contentsClass ?? ''),
      rc.content.class ?? '',
    );
  }

  /** every content's own body-scroll region (see the `#contentBody` template) — wraps the
   *  `@switch` render output and the possible recursive `<contents-view>` as ONE element (there
   *  was no such wrapper before this change). `flex flex-col` internally (not just `block`) so a
   *  switch-output element (e.g. `<data-grid>`) and a following nested `<contents-view>` size
   *  correctly relative to each other — see `nestedContentsClass`. `overflow-y-auto` is where the
   *  actual scrolling happens; the template also binds `[attr.tabindex]` here so this region is
   *  keyboard-reachable per WCAG/AXE's `scrollable-region-focusable` whenever it might scroll.
   *  Structural classes merged with the cascaded `bodiesClass`, then this content's own
   *  `bodyClass` (still wins conflicts last) — the body-level analog of `listItemClass`. */
  protected bodyClass(rc: ResolvedContent): string {
    const structural = [
      'contents-view-body min-w-0',
      this.isCover() ? 'flex flex-1 flex-col min-h-0 overflow-y-auto' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return mergeClasses(
      mergeClasses(structural, this.params().bodiesClass ?? ''),
      rc.content.bodyClass ?? '',
    );
  }

  /** every content's own header (see the `#header` template) — structural label/icon/badge/
   *  actionButtons row classes, `rounded-b-lg` while shown as a tab (seams with `tablistClass`'s
   *  own `rounded-lg` above it) vs `rounded-lg` otherwise, merged with the cascaded `headersClass`,
   *  then this content's own `headerClass` (still wins conflicts last) — the header-level analog
   *  of `listItemClass`/`bodyClass`. */
  protected headerClass(rc: ResolvedContent): string {
    const structural = [
      'flex items-center gap-1 font-medium flex-none bg-white p-2 mb-2',
      this.params().showContentsInTabs ? 'rounded-lg' : 'rounded-lg',
    ].join(' ');

    return mergeClasses(
      mergeClasses(structural, this.params().headersClass ?? ''),
      rc.content.headerClass ?? '',
    );
  }

  /** the actual default grid. `grid-cols-1 lg:grid-cols-2` is the mobile-first equivalent of the
   *  old `@media (max-width: 1024px) { grid-template-columns: 1fr }`. `auto-rows-fr`
   *  (`grid-auto-rows: minmax(0, 1fr)`) plus `h-full min-h-0`, cover mode only: every row shares
   *  the available height equally instead of sizing to content, so a multi-row grid never grows
   *  past what's available — overflow is absorbed by each item's own body-scroll region (both
   *  `.contents-view-item` and its body wrapper are `min-h-0`), not by the grid.
   *  Keyed to `visibleContents().length` (not `params().contents.length`) so a two-content
   *  layout with one hidden is a single column — no dangling empty track. `resizable` reads the
   *  grid this renders back off the DOM (`measureGrid`); it never assumes this shape. */
  private readonly defaultContentsContainerClass = computed(() => {
    const lgClass = this.visibleContents().length > 1 ? 'lg:grid-cols-2' : '';

    return [
      'contents-view-default-grid grid grid-cols-1 gap-4 ' + lgClass,
      this.isCover() ? 'h-full min-h-0 auto-rows-fr' : '',
    ]
      .filter(Boolean)
      .join(' ');
  });

  /** falls back to the default grid layout only when nothing in the cascade chain ever set a
   *  value — `||`, not `??`: `nestedParameter` always produces a defined string (mergeClasses
   *  never returns undefined), so an empty `''` must still fall through to the default. */
  protected readonly contentsContainerClass = computed(() =>
    mergeClasses(this.defaultContentsContainerClass(), this.params().contentsContainerClass ?? ''),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Resizable panel gutters (ContentsLayout.resizable) — list/grid layout only.
  //
  // The feature NEVER switches the layout: it keeps whatever grid `contentsContainerClass`
  // renders and just drops a draggable gutter between every adjacent pair on each axis that
  // actually has more than one track — height gutters for a vertical stack, a width gutter for
  // two columns, both for a wrapped grid. The real shape is MEASURED from the items' rendered
  // rects (`measureGrid`, live via a ResizeObserver), not assumed. Dragging (or arrow-keying) a
  // gutter moves pixels between its two adjacent tracks and re-derives that axis' fraction
  // signal, which is then imposed as an explicit `grid-template-*` (over the class's own tracks;
  // the gutters are an absolute overlay, so the consumer's `gap` survives). Sizes auto-persist
  // to localStorage (persistedSizes) and via the initialSizes / onSizesChange consumer hooks.
  // ─────────────────────────────────────────────────────────────────────────────

  private readonly gridContainerRef = viewChild<ElementRef<HTMLElement>>('gridContainer');
  /** the rendered list-layout content items (`#cvItem`); their real positions are what
   *  `measureGrid()` clusters into the actual row/column grid */
  private readonly itemEls = viewChildren<ElementRef<HTMLElement>>('cvItem');

  /** the feature is live: list/grid layout, resolved `cover` fit, opted in, >1 visible content */
  protected readonly resizeActive = computed(
    () =>
      !this.params().showContentsInTabs &&
      this.resolvedFit() === 'cover' &&
      this.params().resizable === true &&
      this.visibleContents().length > 1,
  );

  // ── measured grid geometry ──
  // `null` until measured, and permanently so in jsdom / SSR (no layout) — every consumer below
  // then falls back to the responsive shape the built-in grid uses.

  private readonly gridMetrics = signal<{ cols: GridAxis; rows: GridAxis } | null>(null);
  private gridResizeObserver?: ResizeObserver;
  private measureScheduled = false;

  /** while a gutter is being dragged: which one, and how far its boundary has moved from where it
   *  sat at drag start (px, signed). Re-measurement is frozen for the duration so the handle
   *  tracks the pointer exactly off this offset instead of lagging a frame behind a re-measure;
   *  cleared once drag-end has re-measured the final layout. */
  private readonly activeDrag = signal<{ axis: 'x' | 'y'; g: number; shiftPx: number } | null>(null);

  private scheduleMeasure(): void {
    if (this.measureScheduled) return;
    this.measureScheduled = true;
    requestAnimationFrame(() => {
      this.measureScheduled = false;
      if (!this.activeDrag()) this.measureGrid();
    });
  }

  private measureGrid(): void {
    const el = this.gridContainerRef()?.nativeElement;
    const items = this.itemEls();
    const cRect = el?.getBoundingClientRect();
    // bail (→ the fallback shape) with too few items, or no layout at all (jsdom / SSR / hidden)
    if (!el || items.length < 2 || !cRect?.width || !cRect.height) {
      this.gridMetrics.set(null);
      return;
    }

    const originX = cRect.left + el.clientLeft;
    const originY = cRect.top + el.clientTop;
    const xSpans: { start: number; end: number }[] = [];
    const ySpans: { start: number; end: number }[] = [];
    for (const item of items) {
      const r = item.nativeElement.getBoundingClientRect();
      xSpans.push({ start: r.left - originX, end: r.right - originX });
      ySpans.push({ start: r.top - originY, end: r.bottom - originY });
    }
    this.gridMetrics.set({ cols: clusterEdges(xSpans), rows: clusterEdges(ySpans) });
  }

  /** live once the grid has actually been measured — gutters render only then, so the
   *  pre-measurement fallback count can never paint a gutter in the wrong place */
  protected readonly resizeReady = computed(() => this.resizeActive() && this.gridMetrics() !== null);

  /** actual column / row counts — measured, else the built-in grid's responsive default
   *  (`grid-cols-1 lg:grid-cols-2`, wrapped into rows) so jsdom tests and the first frame
   *  still have an answer */
  protected readonly colCount = computed(
    () =>
      this.gridMetrics()?.cols.tracks.length ??
      (this.lgUp() && this.visibleContents().length > 1 ? 2 : 1),
  );
  protected readonly rowCount = computed(
    () =>
      this.gridMetrics()?.rows.tracks.length ??
      Math.max(1, Math.ceil(this.visibleContents().length / this.colCount())),
  );

  /** interior boundary offsets (px from the container's padding box) each gutter is centred on —
   *  one per adjacent track pair. Empty until measured. */
  protected readonly colBoundaries = computed(() => this.gridMetrics()?.cols.boundaries ?? []);
  protected readonly rowBoundaries = computed(() => this.gridMetrics()?.rows.boundaries ?? []);

  /** where to paint gutter `g` — its measured boundary, plus the live drag offset while THIS
   *  gutter is the one being dragged (measurement is frozen then, so the boundary alone is stale) */
  protected colGutterPos = (g: number): number | undefined => this.gutterPos('x', g, this.colBoundaries());
  protected rowGutterPos = (g: number): number | undefined => this.gutterPos('y', g, this.rowBoundaries());
  private gutterPos(axis: 'x' | 'y', g: number, boundaries: number[]): number | undefined {
    const base = boundaries[g];
    const d = this.activeDrag();
    return base != null && d?.axis === axis && d.g === g ? base + d.shiftPx : base;
  }

  /** `[0 … count-2]` — one gutter per interior boundary on each axis */
  protected readonly colGutterIndices = computed(() =>
    Array.from({ length: Math.max(0, this.colCount() - 1) }, (_, g) => g),
  );
  protected readonly rowGutterIndices = computed(() =>
    Array.from({ length: Math.max(0, this.rowCount() - 1) }, (_, g) => g),
  );

  /** per-axis relative weights; length tracks `colCount()` / `rowCount()` via the reconcile
   *  effect in the constructor. Empty (→ the consumer's own grid stands) until seeded from a
   *  persisted / `initialSizes` blob, the measured track sizes, or a drag. */
  private readonly colFractions = signal<number[]>([]);
  private readonly rowFractions = signal<number[]>([]);

  /** localStorage-restored sizes for this mount, read once (key claimed lazily on first use) */
  private readonly persistedSizes = signal<ContentsSizes | undefined>(undefined);
  private persistKey?: string;

  /** explicit `grid-template-columns` / `-rows`, applied inline over the class's own tracks — but
   *  ONLY once we've measured the real grid and this axis has a matching 2+-track distribution to
   *  enforce. `null` beforehand, so the consumer's own grid stands untouched (no first-frame flash
   *  from the pre-measurement fallback count guessing wrong). */
  protected readonly gridTemplateColumns = computed(() =>
    this.gridMetrics() && this.colFractions().length === this.colCount()
      ? trackTemplate(this.colFractions())
      : null,
  );
  protected readonly gridTemplateRows = computed(() =>
    this.gridMetrics() && this.rowFractions().length === this.rowCount()
      ? trackTemplate(this.rowFractions())
      : null,
  );

  /** first-pane share of the pair either side of gutter `g`, 0–100, for `aria-valuenow` */
  protected colPercent = (g: number): number | undefined => pairPercent(this.colFractions(), g);
  protected rowPercent = (g: number): number | undefined => pairPercent(this.rowFractions(), g);

  // ── drag ──

  /** content-track pixel sizes for the dragged axis, captured from the measurement at drag start */
  private trackStartPx: number[] = [];
  private rafPending = false;
  private pendingApply: (() => void) | null = null;

  protected onGutterStart(axis: 'x' | 'y', g: number): void {
    const m = this.gridMetrics();
    this.trackStartPx = (axis === 'x' ? m?.cols.tracks : m?.rows.tracks)?.map((t) => t.size) ?? [];
    this.activeDrag.set({ axis, g, shiftPx: 0 });
  }

  protected onColResize(g: number, deltaPx: number): void {
    this.resizeGutter('x', this.colFractions, g, deltaPx, MIN_COL_PX);
  }
  protected onRowResize(g: number, deltaPx: number): void {
    this.resizeGutter('y', this.rowFractions, g, deltaPx, MIN_ROW_PX);
  }

  /** move `deltaPx` across gutter `g` between tracks `g` and `g+1`, leaving every other track
   *  where it is, then re-derive the axis' fractions. The boundary moves by exactly the change in
   *  track `g`'s size — publish that as the live handle offset. */
  private resizeGutter(
    axis: 'x' | 'y',
    target: { set: (value: number[]) => void },
    g: number,
    deltaPx: number,
    minPx: number,
  ): void {
    const next = [...this.trackStartPx];
    const a = next[g];
    const b = next[g + 1];
    if (!isFinite(a) || !isFinite(b)) return;
    [next[g], next[g + 1]] = redistributePx(a, b, deltaPx, minPx);
    this.activeDrag.set({ axis, g, shiftPx: next[g] - this.trackStartPx[g] });
    this.scheduleApply(() => target.set(normalizeFractions(next)));
  }

  /** coalesce live-drag updates to one signal commit (→ one CD pass) per animation frame —
   *  the app is zoneless, so the commit is what re-renders; same guard as
   *  `StepperProgressIndicatorDirective` / `SlidingTabIndicatorDirective`. */
  private scheduleApply(fn: () => void): void {
    this.pendingApply = fn;
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.pendingApply?.();
      this.pendingApply = null;
    });
  }

  protected onGutterEnd(): void {
    this.pendingApply?.();
    this.pendingApply = null;
    this.persistSizes();
    this.params().onSizesChange?.(this.currentSizes());
    // Two frames on the new `grid-template-*` is applied and laid out: re-measure the true
    // boundary, then drop the live offset. Because the boundary shifted by exactly `shiftPx`, the
    // handle is already sitting where the measurement puts it — no snap on release. Held until
    // then so it never flicks back to its drag-start spot.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.measureGrid();
        this.activeDrag.set(null);
      }),
    );
  }

  // ── size state helpers ──

  private currentSizes(): ContentsSizes {
    const cols = this.colFractions();
    const rows = this.rowFractions();
    return {
      columns: this.colCount() > 1 && cols.length === this.colCount() ? [...cols] : undefined,
      rows: this.rowCount() > 1 && rows.length === this.rowCount() ? [...rows] : undefined,
    };
  }

  /** seed one axis: persisted-blob (if length matches) → `initialSizes` (if length matches) →
   *  the measured track sizes → keep the current prefix and top up with the running average →
   *  all-equal. */
  private seedFractions(
    n: number,
    persisted: number[] | undefined,
    initial: number[] | undefined,
    measured: number[] | undefined,
    current: number[],
  ): number[] {
    if (n <= 1) return n === 1 ? [1] : [];
    const usable = (a: number[] | undefined): a is number[] =>
      a?.length === n && a.every((v) => isFinite(v) && v > 0);
    if (usable(persisted)) return [...persisted];
    if (usable(initial)) return [...initial];
    if (usable(measured)) return normalizeFractions([...measured]);
    if (current.length) {
      const avg = current.reduce((s, v) => s + v, 0) / current.length || 1;
      return Array.from({ length: n }, (_, i) => current[i] ?? avg);
    }
    return Array(n).fill(1);
  }

  private ensurePersistKey(): string | undefined {
    if (this.persistKey) return this.persistKey;
    const labels = this.visibleContents().map((rc) => rc.content.slug ?? rc.content.label ?? '');
    if (!labels.length) return undefined;
    this.persistKey = claimPersistedSelectionKey(SIZES_NAMESPACE, this.router.url, labels);
    this.destroyRef.onDestroy(() => releasePersistedSelectionKey(this.persistKey!));
    const raw = readPersistedSelection(this.persistKey);
    if (raw) {
      try {
        this.persistedSizes.set(JSON.parse(raw) as ContentsSizes);
      } catch {
        // corrupt entry — ignore, fall back to equal / initialSizes
      }
    }
    return this.persistKey;
  }

  private persistSizes(): void {
    if (this.params().persistSizes === false) return;
    const key = this.ensurePersistKey();
    if (key) writePersistedSelection(key, JSON.stringify(this.currentSizes()));
  }

  /** applies a caller-supplied distribution (instance `setSizes`), each axis only if its
   *  length matches the current track count */
  private applySizes(sizes: ContentsSizes): void {
    if (sizes.columns?.length === this.colCount() && this.colCount() > 1) {
      this.colFractions.set([...sizes.columns]);
    }
    if (sizes.rows?.length === this.rowCount() && this.rowCount() > 1) {
      this.rowFractions.set([...sizes.rows]);
    }
  }

  /** whether THIS content's own header should show its label/icon/badge — suppressed by default
   *  while shown as a tab (the tab toggle button already shows label/icon/badge), unless
   *  `header: 'full'`. */
  protected showHeaderLabelIcon(content: ContentView): boolean {
    if (content.header === 'full') return true;
    return !this.params().showContentsInTabs;
  }

  /** whether THIS content renders a header row at all.
   *  - `header: 'none'` → never.
   *  - `'auto'` while shown as a tab → only when there are `actionButtons`; the tab toggle
   *    button already carries label/icon/badge, so a panel header with just those is redundant.
   *  - otherwise (`'full'`, or `'auto'` in list mode) → whenever there's a label, icon, badge
   *    or actionButtons to show. */
  protected showsHeader(rc: ResolvedContent): boolean {
    const content = rc.content;
    if (content.header === 'none') return false;

    const hasActionButtons = !!content.actionButtons;
    if (content.header !== 'full' && this.params().showContentsInTabs) return hasActionButtons;

    const hasBadge = rc.badge !== undefined && rc.badge !== null && rc.badge !== '';
    return !!(content.label || content.icon) || hasBadge || hasActionButtons;
  }

  /** index of `effectiveActiveSlug()` within `visibleContents()`, for `<mat-tab-group>`'s own
   *  `[selectedIndex]` — mat-tab-group's keyboard handling (roving tabindex, Home/End, disabled-tab
   *  skipping) replaces the old hand-rolled `onTablistKeydown`. */
  protected readonly selectedTabIndex = computed(() => {
    const index = this.visibleContents().findIndex(
      (rc) => rc.content.slug === this.effectiveActiveSlug(),
    );
    return index >= 0 ? index : 0;
  });

  protected onSelectedTabIndexChange(index: number): void {
    const rc = this.visibleContents()[index];
    if (rc && !rc.disabled) this.activateContent(rc.content);
  }

  // outputs wiring for dynamically-hosted `componentParams.component` instances —
  // NgComponentOutlet has no outputs binding or (created) event, only a
  // `componentInstance` getter, so we walk the live outlets ourselves. Correlated to
  // the filtered 'component'-type visible contents by array order (viewChildren
  // preserves template/DOM order).
  private readonly componentOutlets = viewChildren(NgComponentOutlet);
  private readonly wiredOutputInstances = new WeakSet<object>();

  constructor() {
    effect(() => {
      const componentContents = this.visibleContents().filter(
        (rc): rc is ResolvedContent & { content: ContentView & { type: 'component' } } =>
          rc.content.type === 'component',
      );
      this.componentOutlets().forEach((outlet, i) => {
        const instance = outlet.componentInstance;
        const outputs = componentContents[i]?.content.componentParams?.outputs;
        if (!instance || !outputs || this.wiredOutputInstances.has(instance)) return;
        this.wiredOutputInstances.add(instance);
        for (const [key, handler] of Object.entries(outputs)) {
          const emitter = (instance as Record<string, unknown>)[key];
          if (emitter && typeof (emitter as { subscribe?: unknown }).subscribe === 'function') {
            (emitter as { subscribe: (fn: (event: unknown) => void) => void }).subscribe(handler);
          }
        }
      });
    });

    // Keep the fraction arrays the right length as the MEASURED grid shape changes — contents
    // added/removed, the viewport crossing a breakpoint, a `contentsContainerClass` media query.
    // Reseed ONLY the axis whose length actually changed (guarded by `untracked`) so a live drag
    // — which keeps the length constant — is never clobbered.
    effect(() => {
      const cols = this.colCount();
      const rows = this.rowCount();
      if (!this.resizeActive()) return;
      this.ensurePersistKey();
      untracked(() => {
        const persisted = this.persistedSizes();
        const initial = this.params().initialSizes;
        const m = this.gridMetrics();
        if (this.colFractions().length !== cols) {
          this.colFractions.set(
            this.seedFractions(
              cols,
              persisted?.columns,
              initial?.columns,
              m?.cols.tracks.map((t) => t.size),
              this.colFractions(),
            ),
          );
        }
        if (this.rowFractions().length !== rows) {
          this.rowFractions.set(
            this.seedFractions(
              rows,
              persisted?.rows,
              initial?.rows,
              m?.rows.tracks.map((t) => t.size),
              this.rowFractions(),
            ),
          );
        }
      });
    });

    // Measure the real grid after the first render, then keep it current — a ResizeObserver
    // catches every size change (a sibling column dragged wider, the window, a `contentsContainer
    // class` media query we don't model); this effect catches the shape changes it can't see.
    afterNextRender(() => {
      this.measureGrid();
      const el = this.gridContainerRef()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      this.gridResizeObserver = new ResizeObserver(() => {
        if (!this.activeDrag()) this.measureGrid();
      });
      this.gridResizeObserver.observe(el);
    });
    this.destroyRef.onDestroy(() => this.gridResizeObserver?.disconnect());

    effect(() => {
      if (!this.resizeActive()) {
        untracked(() => this.gridMetrics.set(null));
        return;
      }
      this.visibleContents(); // tracked so a boundary-moving change reschedules a measure:
      this.lgUp(); //           contents added/removed, the viewport crossing the breakpoint,
      this.colFractions(); //   or the split itself changing (drag commit / setSizes / restore)
      this.rowFractions();
      untracked(() => this.scheduleMeasure());
    });
  }

  ngOnInit(): void {
    const getContents = () => flattenContents(this.params().contents);
    const instance: ContentsViewInstance = {
      get contents() {
        return getContents();
      },
      activeContent: () =>
        this.visibleContents().find((rc) => rc.content.slug === this.effectiveActiveSlug())
          ?.content,
      activeSlug: () => this.effectiveActiveSlug(),
      selectContent: (slug) => this.selectBySlug(slug),
      sizes: () => this.currentSizes(),
      setSizes: (sizes) => {
        this.applySizes(sizes);
        this.persistSizes();
        this.params().onSizesChange?.(this.currentSizes());
      },
      resetSizes: () => {
        this.colFractions.set(Array(this.colCount()).fill(1));
        this.rowFractions.set(Array(this.rowCount()).fill(1));
        this.persistSizes();
        this.params().onSizesChange?.(this.currentSizes());
      },
    };
    this.instanceChange.emit(instance);
  }

  private selectBySlug(slug: string): void {
    const rc = this.visibleContents().find((rc) => rc.content.slug === slug && !rc.disabled);
    if (rc) this.activateContent(rc.content);
  }

  private activateContent(content: ContentView): void {
    this.activeSlugSig.set(content.slug);
    content.onActive?.(content, this.params().contents);
    this.params().onContentChange?.(content, this.params().contents);
  }

  /** Builds the nested mount's `ContentsParameter` — cascading `contentsClass`/
   *  `contentsContainerClass`/`tabsContainerClass`/`bodiesClass`/`headersClass` by merging THIS level's
   *  already-cascaded effective value (`this.params().<field>`, itself built the same way by
   *  this component's own parent) with the child's own override, rather than overwriting. By
   *  induction, every level's `params().<field>` is therefore always the fully-merged value from
   *  every ancestor. */
  protected nestedParameter(content: ContentView): ContentsParameter {
    return {
      contents: content.contents ?? [],
      contentsClass: mergeClasses(this.params().contentsClass ?? '', content.contentsClass ?? ''),
      contentsContainerClass: mergeClasses(
        this.params().contentsContainerClass ?? '',
        content.contentsContainerClass ?? '',
      ),
      tabsContainerClass: mergeClasses(
        this.params().tabsContainerClass ?? '',
        content.tabsContainerClass ?? '',
      ),
      bodiesClass: mergeClasses(this.params().bodiesClass ?? '', content.bodiesClass ?? ''),
      headersClass: mergeClasses(this.params().headersClass ?? '', content.headersClass ?? ''),
      tabsOrientation: content.tabsOrientation,
      showContentsInTabs: content.showContentsInTabs,
      // `contentsFit` is NOT cascaded — a nested drill-down legitimately differs (a 'flow'
      // section inside a 'cover' dashboard); each level defaults to 'auto' and consumes its own
      // value (see `resolvedFit` / `nestedContentsClass` / `resizeActive`).
      contentsFit: content.contentsFit,
      // `resizable` / `persistSizes` DO cascade — turn resizing on once on an ancestor and every
      // nested list/grid level is resizable too (each still only shows gutters when its own
      // measured layout has >1 row/column); a child sets `resizable: false` to opt its subtree
      // out. `initialSizes` / `onSizesChange` stay root-only (a nested level persists via
      // localStorage instead).
      resizable: content.resizable ?? this.params().resizable,
      persistSizes: content.persistSizes ?? this.params().persistSizes,
      preserveInactiveContent: content.preserveInactiveContent,
    };
  }

  /** wraps the recursively-nested `<contents-view>` mount (see the `#contentBody` template).
   *  `flex-1 min-h-0` only when the CHILD's own resolved fit is `'cover'` — its `contentsFit`
   *  (independent default `'auto'`, NOT cascaded/merged — see `nestedParameter` above), with
   *  `'auto'` resolved here against THIS mount's `lgUp()` (the child re-resolves it identically
   *  once mounted). `'cover'`: lets it share `bodyClass`'s flex column with any preceding
   *  switch-output sibling (e.g. a `'table'` node that also has nested `.contents`) and shrink,
   *  so ITS OWN internal min-h-0 chain owns the scrolling — instead of a literal `h-full`, which
   *  would either overflow (with a sibling present) or add an inert extra scroll boundary (as the
   *  sole child). `'flow'`: no class — it grows to its natural height and this mount's own
   *  `overflow-y-auto` body-scroll region scrolls it. */
  protected nestedContentsClass(content: ContentView): string {
    const fit = content.contentsFit ?? 'auto';
    const childCover = fit === 'auto' ? this.lgUp() : fit === 'cover';
    return childCover ? 'flex-1 min-h-0' : '';
  }

  protected readonly trackContent = (_: number, rc: ResolvedContent): string | number =>
    rc.content.slug ?? _;
}
