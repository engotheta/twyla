import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  OnInit,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
  WritableSignal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { combineLatest, isObservable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ActionButtonsComponent } from '@components/action-buttons/action-buttons.component';
import { resolveDynamicValue$ } from '@utils/dynamic-value.helpers';
import { DataGridComponent } from '@components/data-grid';
import { DetailsComponent } from '@components/details/details.component';
import { GenericFormComponent } from '@components/generic-form';
import { mergeClasses } from '@utils/class-name.helpers';
import { syncOverlayContainer } from '@utils/fullscreen-overlay.helpers';
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
} from '@utils/persisted-selection.helpers';
import { TabNavComponent } from '@components/tab-nav/tab-nav.component';
import { TabNavItem, TabNavState } from '@components/tab-nav/tab-nav.interface';
import { LG_UP_QUERY, mediaQuerySignal } from '@utils/viewport.helpers';
import { clusterEdges, GridAxis, trackIndex } from './grid-metrics.helpers';

/** one resolved content, ready to render — `visible`/`disabled`/`badge`/`html`
 *  (DynamicValue/Observable-driven) already settled into plain current values */
interface ResolvedContent {
  content: ContentView;
  visible: boolean;
  disabled: boolean;
  badge: string | number | undefined;
  html: string | undefined;
}

/** what a content's header row shows ahead of its buttons — see `headingOf` */
interface ContentHeading {
  text?: string;
  icon?: string;
  badge?: string | number;
}

/** a content's badge, if it has one to show (`0` counts; empty / null doesn't) */
function badgeOf(rc: ResolvedContent): string | number | undefined {
  return rc.badge === undefined || rc.badge === null || rc.badge === '' ? undefined : rc.badge;
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** the toggles a nested level hands up are compared by value: its params are rebuilt on every
 *  check of its parent, and an equal-but-new list would re-dirty that parent — which renders it —
 *  every time, looping forever */
function sameTabs(a: readonly TabNavItem[], b: readonly TabNavItem[]): boolean {
  return a.length === b.length && a.every((tab, i) => shallowEqual(tab, b[i]));
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
/** localStorage namespaces for `persisted-selection.helpers`: a resizable level's pane sizes, and a
 *  tabs level's active tab */
const SIZES_NAMESPACE = 'contents-sizes';
const TABS_NAMESPACE = 'tabs';

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

/** the fractions after a drag left the tracks at `nextPx`: with nothing collapsed, just
 *  `normalizeFractions(nextPx)`. A collapsed track's px is only its strip, so it keeps its
 *  `before` fraction (restoring it brings its share back) and the open tracks split the open
 *  tracks' former total by their new px. Pure/exported for unit testing. */
export function refitFractions(
  before: readonly number[],
  nextPx: readonly number[],
  collapsed: readonly boolean[],
): number[] {
  if (!collapsed.some(Boolean) || before.length !== nextPx.length) {
    return normalizeFractions([...nextPx]);
  }
  const open = nextPx.map((_, i) => i).filter((i) => !collapsed[i]);
  const openFr = open.reduce((sum, i) => sum + before[i], 0);
  const openPx = open.reduce((sum, i) => sum + nextPx[i], 0);
  return before.map((fr, i) => (collapsed[i] || openPx <= 0 ? fr : (nextPx[i] / openPx) * openFr));
}

/** an axis' explicit `grid-template-*` value — a collapsed track sized to its strip (`auto`), the
 *  rest sharing what's left by `fractions` (all equal when there are no fractions to enforce) —
 *  or `null` when there's nothing to enforce, so the consumer's own grid is left untouched: fewer
 *  than two tracks, or nothing collapsed and no matching fractions. The open tracks' shares are
 *  rescaled to average 1: `fr` tracks whose factors sum below 1 take only that part of the free
 *  space, and the `auto` strips stretch over the rest — a 20/80 split (`[0.4, 1.6]`) with its 80%
 *  pane collapsed must become `1fr auto`, not `0.4fr auto`. `minmax(0, …)` not bare `fr`: a bare
 *  `fr` keeps an `auto` minimum that lets a wide `<data-grid>` child refuse to shrink so the drag
 *  "sticks". Pure/exported for unit testing. */
export function axisTemplate(
  count: number,
  fractions: readonly number[],
  collapsed: readonly boolean[],
): string | null {
  const sized = fractions.length === count;
  if (count < 2 || (!sized && !collapsed.some(Boolean))) return null;
  const open = Array.from({ length: count }, (_, i) => i).filter((i) => !collapsed[i]);
  const shares = normalizeFractions(open.map((i) => (sized ? fractions[i] : 1)));
  const tracks: string[] = Array(count).fill('auto');
  // 4 decimals: the same layout, a readable inline style
  open.forEach((track, j) => (tracks[track] = `minmax(0, ${+shares[j].toFixed(4)}fr)`));
  return tracks.join(' ');
}

/** `keys` held to "at least one pane expanded" (`keepOneExpanded`): when every visible pane's key
 *  is in it, the first visible pane's is dropped. Pure. */
function keepFirstOpen(keys: ReadonlySet<string>, visible: readonly string[]): ReadonlySet<string> {
  if (!visible.length || visible.some((key) => !keys.has(key))) return keys;
  const next = new Set(keys);
  next.delete(visible[0]);
  return next;
}

/** first-pane share of the pair on either side of gutter `g`, as an integer 0–100 */
function pairPercent(fractions: number[], g: number): number | undefined {
  const a = fractions[g];
  const b = fractions[g + 1];
  return a == null || b == null ? undefined : Math.round((100 * a) / (a + b));
}

/** `[0 … count-2]`, minus each gutter with a collapsed track on either side */
function gutterIndices(count: number, collapsed: readonly boolean[]): number[] {
  return Array.from({ length: Math.max(0, count - 1) }, (_, g) => g).filter(
    (g) => !collapsed[g] && !collapsed[g + 1],
  );
}

/** per-mount id prefix for the pane controls' `id` / `aria-controls` pairs */
let nextMountId = 0;

/** a content's stable key within its mount — its `slug`, else its position */
function contentKey(rc: ResolvedContent, index: number): string {
  return rc.content.slug ?? `#${index}`;
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
    MatTooltipModule,
    TabNavComponent,
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
    '[attr.tabindex]': 'hostTabindex()',
  },
})
export class ContentsViewComponent implements OnInit {
  readonly params = input.required<ContentsParameter>();
  readonly instanceChange = output<ContentsViewInstance>();
  /** internal — set by a parent contents-view on the level it nests: the slot this level hands
   *  its tab navigation up to, so the content owning these tabs renders the toggles itself (in
   *  its header, or beside its body). A level without one (the root) renders its own. */
  readonly tabsHost = input<WritableSignal<TabNavState | undefined>>();

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly focusTrapFactory = inject(FocusTrapFactory);
  private readonly overlayContainer = inject(OverlayContainer);

  /** the ROOT mount has no contents-view ancestor — a nested one is rendered inside its parent's
   *  template, so the parent is on its element-injector path */
  private readonly isRoot = !inject(ContentsViewComponent, { optional: true, skipSelf: true });

  /** live `true` while the viewport is ≥ Tailwind's `lg` (64rem) — drives `flowOnSmallerView`
   *  and the one-vs-two-column decision. Static `false` where `matchMedia` is unavailable
   *  (jsdom): tests that need a definite answer stub `window.matchMedia`. */
  private readonly lgUp = mediaQuerySignal(LG_UP_QUERY);

  /** the raw fit mode for THIS level (`'auto'` default). See `ContentsLayout.contentsFit`. */
  protected readonly contentsFit = computed<'auto' | 'cover' | 'flow'>(
    () => this.params().contentsFit ?? 'auto',
  );

  /** below lg, `'flow'` unless `flowOnSmallerView: false`; otherwise `contentsFit` (`'auto'` is
   *  `'cover'`) — see `ContentsLayout.contentsFit` / `flowOnSmallerView`. */
  protected readonly resolvedFit = computed<'cover' | 'flow'>(() => {
    if (!this.lgUp() && this.params().flowOnSmallerView !== false) return 'flow';
    return this.contentsFit() === 'flow' ? 'flow' : 'cover';
  });

  /** whether this level is in the bounded, internally-scrolling layout (`resolvedFit() === 'cover'`)
   *  — the "fit into the available view" mode. Every downstream layout class keys off this;
   *  `'flow'` emits none of them and content grows to its natural height. */
  protected readonly isCover = computed(() => this.resolvedFit() === 'cover');

  /** reactive `:host` sizing, replacing the old static `:host { height: 100%; width: 100% }` SCSS
   *  rule — same `host: { '[class]': ... }` pattern `grid-cell.component.ts` already uses for a
   *  reactive host class.
   *  - cover: `min-h-0` lets THIS element shrink below its content's natural height when it's
   *    itself a flex/grid item of a bounded ancestor (mounted recursively inside another level's
   *    body-scroll-region, or at the top level inside a bounded flex parent).
   *  - flow, root: `h-full overflow-y-auto` — once the parent bounds its height (an app shell,
   *    a card), the root itself scrolls the flowing contents; under an unbounded parent `h-full`
   *    resolves to `auto` and the page scrolls instead. Without it, flowing content just spilled
   *    out of a bounded shell with nothing able to scroll it.
   *  - flow, nested: no height at all — it grows to its natural height inside its parent level's
   *    body, which (or whose ancestor) does the scrolling. */
  protected readonly hostClass = computed(() => {
    if (this.isCover()) return 'block h-full w-full min-h-0';
    return this.isRoot ? 'block h-full w-full overflow-y-auto' : 'block w-full';
  });

  /** the flow root is a scroll region — keyboard-reachable per WCAG/AXE's
   *  `scrollable-region-focusable`, like each cover body (see `bodyClass`) */
  protected readonly hostTabindex = computed(() => (!this.isCover() && this.isRoot ? 0 : null));

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Tabs (ContentsLayout.showContentsInTabs) — a tabs level renders its contents as tab panels;
  // its toggles (`tab-nav`) live with the content owning the tabs: in that content's
  // header, or as a sidebar beside its body (vertical, from lg up). The level hands its nav
  // state up through `tabsHost`; only the root, owned by nothing, renders its own toggles.
  // ─────────────────────────────────────────────────────────────────────────────

  /** the tab the user (or `selectContent`, or the persisted choice) picked — by content key, so
   *  slug-less contents switch too */
  private readonly activeKeySig = signal<string | undefined>(undefined);

  /** the EFFECTIVE active tab: the picked one while it's still visible, else the
   *  `initialActive`-marked content, else the first. Backs the panels, the toggles and the
   *  instance's `activeSlug()` / `activeContent()`, so they always agree with what's shown. */
  protected readonly effectiveActiveKey = computed(() => {
    const keys = this.visibleKeys();
    const picked = this.activeKeySig();
    if (picked !== undefined && keys.includes(picked)) return picked;
    const initial = this.visibleContents().findIndex((rc) => rc.content.initialActive);
    return keys[Math.max(initial, 0)];
  });

  private readonly activeRc = computed(
    () => this.visibleContents()[this.visibleKeys().indexOf(this.effectiveActiveKey() ?? '')],
  );

  /** tab panels shown at least once — with `preserveInactiveContent` (default) they stay mounted,
   *  hidden, after they're left */
  private readonly visitedKeys = signal<ReadonlySet<string>>(new Set());
  /** localStorage slot for the active tab — claimed once the contents resolve */
  private tabsPersistKey?: string;

  /** this level's tab navigation — rendered by the level itself at the root, handed up via
   *  `tabsHost` everywhere else. Compared by value (see `sameTabs`): the parent reading it rebuilds
   *  this level's params on every check. */
  protected readonly navState: TabNavState = {
    tabs: computed(
      () =>
        this.params().showContentsInTabs
          ? this.visibleContents().map((rc, i) => {
              const key = contentKey(rc, i);
              return {
                key,
                label: this.paneLabel(rc),
                icon: rc.content.icon,
                badge: badgeOf(rc),
                disabled: rc.disabled,
                tabId: this.tabId(key),
                panelId: this.panelId(key),
              };
            })
          : [],
      { equal: sameTabs },
    ),
    activeKey: computed(() => this.effectiveActiveKey()),
    classes: computed(
      () => ({
        container: this.params().tabsContainerClass,
        tab: this.params().tabClass,
        activeTab: this.params().activeTabClass,
        indicator: this.params().tabIndicatorClass,
      }),
      { equal: shallowEqual },
    ),
    select: (key) => this.selectByKey(key),
  };

  protected readonly tabsOrientation = computed<'horizontal' | 'vertical'>(() =>
    this.params().tabsOrientation === 'vertical' ? 'vertical' : 'horizontal',
  );

  /** the root's own toggles go beside its panels: vertical tabs, from lg up */
  protected readonly ownNavSide = computed(
    () => this.tabsOrientation() === 'vertical' && this.lgUp(),
  );

  /** the tabs level's frame: the root's own toggles and the panels — a row when those toggles are
   *  a sidebar, else a column (a nested level, whose toggles live with its owner, is panels only) */
  protected readonly tabsLayoutClass = computed(() =>
    [
      !this.tabsHost() && this.ownNavSide() ? 'flex gap-2' : 'flex flex-col',
      this.isCover() ? 'h-full min-h-0' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  /** the card around the root's own toggles — like a header above the panels, or a sidebar */
  protected readonly ownNavCardClass = computed(() => {
    if (!this.ownNavSide()) return 'flex flex-none bg-white p-2 mb-2 rounded-lg';
    return this.isCover()
      ? 'flex flex-none min-h-0 bg-white p-2 rounded-lg'
      : 'flex flex-none self-start sticky top-0 bg-white p-2 rounded-lg';
  });

  protected readonly panelsClass = computed(() =>
    ['flex flex-col min-w-0 flex-1', this.isCover() ? 'min-h-0' : ''].filter(Boolean).join(' '),
  );

  /** the active panel fills what's left (an inactive one is `hidden` outright) */
  protected readonly panelClass = computed(() =>
    this.isCover() ? 'flex flex-col flex-1 min-h-0' : '',
  );

  protected tabId(key: string): string {
    return `${this.mountId}-tab-${key}`;
  }

  protected panelId(key: string): string {
    return `${this.mountId}-panel-${key}`;
  }

  /** a panel's content renders once its tab is first shown, and — unless
   *  `preserveInactiveContent: false` — stays mounted (hidden) after it's left */
  protected rendersPanel(key: string): boolean {
    return (
      key === this.effectiveActiveKey() ||
      (this.params().preserveInactiveContent !== false && this.visitedKeys().has(key))
    );
  }

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
   *  list items and tab panels. In full screen it becomes the "pinned header + scrollable body"
   *  column filling the screen; a collapsed row strip drops `h-full` and aligns to the top of its
   *  track, so a row whose other panes are still open doesn't stretch it back to full height. */
  protected listItemClass(rc: ResolvedContent, key: string): string {
    const own = mergeClasses(
      mergeClasses(this.itemBaseClass(), this.params().contentsClass ?? ''),
      rc.content.class ?? '',
    );
    if (this.isFullscreen(key)) return mergeClasses(own, 'flex flex-col bg-white p-3 rounded-none');
    if (this.isCollapsed(key) && this.collapseAxis() === 'row') {
      return mergeClasses(own, 'h-auto self-start');
    }
    return own;
  }

  /** every content's own body-scroll region (see the `#contentBody` template) — wraps the
   *  `@switch` render output and the possible recursive `<contents-view>` as ONE element (there
   *  was no such wrapper before this change). `flex flex-col` internally (not just `block`) so a
   *  switch-output element (e.g. `<data-grid>`) and a following nested `<contents-view>` size
   *  correctly relative to each other — see `nestedContentsClass`. `overflow-y-auto` is where the
   *  actual scrolling happens; the template also binds `[attr.tabindex]` here so this region is
   *  keyboard-reachable per WCAG/AXE's `scrollable-region-focusable` whenever it might scroll.
   *  Structural classes merged with the cascaded `bodiesClass`, then this content's own
   *  `bodyClass` (still wins conflicts last) — the body-level analog of `listItemClass`. A
   *  full-screen pane's body scrolls the same way in either fit. */
  protected bodyClass(rc: ResolvedContent, key: string): string {
    const structural = [
      'contents-view-body min-w-0',
      this.bodyScrolls(key) ? 'flex flex-1 flex-col min-h-0 overflow-y-auto' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return mergeClasses(
      mergeClasses(structural, this.params().bodiesClass ?? ''),
      rc.content.bodyClass ?? '',
    );
  }

  /** whether a content's body is a bounded scroll region (cover, or full screen) */
  protected bodyScrolls(key: string): boolean {
    return this.isCover() || this.isFullscreen(key);
  }

  /** every content's own header card (see the `#header` template) — a column: the top row
   *  (heading, action buttons, pane controls), then, for a content whose own contents are
   *  horizontal tabs, a faded rule and their toggles. Merged with the cascaded `headersClass`,
   *  then this content's own `headerClass` (still wins conflicts last) — the header-level analog
   *  of `listItemClass`/`bodyClass` — so a consumer can rearrange it (`flex-row`, …). */
  protected headerClass(rc: ResolvedContent): string {
    return mergeClasses(
      mergeClasses('flex flex-col flex-none bg-white p-2 mb-2 rounded-lg', this.params().headersClass ?? ''),
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

  /** the grid gets measured: a list/grid level with >1 visible content that either resizes or
   *  collapses (collapse needs the measured shape — its axis, and which tracks to shrink — in
   *  either fit) */
  private readonly measureActive = computed(
    () =>
      !this.params().showContentsInTabs &&
      this.visibleContents().length > 1 &&
      (this.resizeActive() || this.collapsible()),
  );

  // ── measured grid geometry ──
  // `null` until measured, and permanently so in jsdom / SSR (no layout) — every consumer below
  // then falls back to the responsive shape the built-in grid uses.

  /** the measured tracks per axis, plus each visible content's `(col, row)` track, in order */
  private readonly gridMetrics = signal<{
    cols: GridAxis;
    rows: GridAxis;
    items: { col: number; row: number }[];
  } | null>(null);
  private gridResizeObserver?: ResizeObserver;
  private measureScheduled = false;

  /** while a gutter is being dragged: which one, and how far its boundary has moved from where it
   *  sat at drag start (px, signed). Re-measurement is frozen for the duration so the handle
   *  tracks the pointer exactly off this offset instead of lagging a frame behind a re-measure;
   *  cleared once drag-end has re-measured the final layout. */
  private readonly activeDrag = signal<{ axis: 'x' | 'y'; g: number; shiftPx: number } | null>(null);

  /** measurement is frozen during a drag (see `activeDrag`) and while a pane is full screen — the
   *  full-screen element leaves the grid's flow, so a re-measure would see a different shape */
  private measureFrozen(): boolean {
    return !!this.activeDrag() || this.fullscreenKey() !== undefined;
  }

  private scheduleMeasure(): void {
    if (this.measureScheduled) return;
    this.measureScheduled = true;
    requestAnimationFrame(() => {
      this.measureScheduled = false;
      if (!this.measureFrozen()) this.measureGrid();
    });
  }

  private measureGrid(): void {
    const el = this.gridContainerRef()?.nativeElement;
    const items = this.itemEls();
    const cRect = el?.getBoundingClientRect();
    // bail (→ the fallback shape) when not needed, with too few items, or no layout at all
    // (jsdom / SSR / hidden)
    if (!this.measureActive() || !el || items.length < 2 || !cRect?.width || !cRect.height) {
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
    const cols = clusterEdges(xSpans);
    const rows = clusterEdges(ySpans);
    this.gridMetrics.set({
      cols,
      rows,
      items: xSpans.map((x, i) => ({
        col: trackIndex(cols, x.start),
        row: trackIndex(rows, ySpans[i].start),
      })),
    });
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

  /** `[0 … count-2]` — one gutter per interior boundary on each axis, minus any gutter beside a
   *  collapsed track (a strip has no size to trade) */
  protected readonly colGutterIndices = computed(() =>
    gutterIndices(this.colCount(), this.collapsedTracks().cols),
  );
  protected readonly rowGutterIndices = computed(() =>
    gutterIndices(this.rowCount(), this.collapsedTracks().rows),
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
   *  ONLY once we've measured the real grid and this axis has something to enforce: a matching
   *  2+-track `resizable` distribution, and/or a collapsed track (sized to its strip, the rest
   *  sharing the space — see `axisTemplate`). `null` otherwise, so the consumer's own grid stands
   *  untouched (no first-frame flash from the pre-measurement fallback count guessing wrong).
   *  Rows only in cover: flowing rows already size to their content. */
  protected readonly gridTemplateColumns = computed(() =>
    this.gridMetrics()
      ? axisTemplate(
          this.colCount(),
          this.resizeActive() ? this.colFractions() : [],
          this.collapsedTracks().cols,
        )
      : null,
  );
  protected readonly gridTemplateRows = computed(() =>
    this.gridMetrics() && this.isCover()
      ? axisTemplate(
          this.rowCount(),
          this.resizeActive() ? this.rowFractions() : [],
          this.collapsedTracks().rows,
        )
      : null,
  );

  /** first-pane share of the pair either side of gutter `g`, 0–100, for `aria-valuenow` */
  protected colPercent = (g: number): number | undefined => pairPercent(this.colFractions(), g);
  protected rowPercent = (g: number): number | undefined => pairPercent(this.rowFractions(), g);

  // ── drag ──

  /** content-track pixel sizes for the dragged axis, captured from the measurement at drag start */
  private trackStartPx: number[] = [];
  /** the dragged axis' fractions at drag start — collapsed tracks keep theirs (`refitFractions`) */
  private fractionsAtStart: number[] = [];
  private rafPending = false;
  private pendingApply: (() => void) | null = null;

  protected onGutterStart(axis: 'x' | 'y', g: number): void {
    const m = this.gridMetrics();
    this.trackStartPx = (axis === 'x' ? m?.cols.tracks : m?.rows.tracks)?.map((t) => t.size) ?? [];
    this.fractionsAtStart = axis === 'x' ? this.colFractions() : this.rowFractions();
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
    const collapsed = axis === 'x' ? this.collapsedTracks().cols : this.collapsedTracks().rows;
    this.scheduleApply(() => target.set(refitFractions(this.fractionsAtStart, next, collapsed)));
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Pane controls — collapse / restore (ContentsLayout.collapsible, list/grid levels) and browser
  // full screen (ContentsLayout.fullscreenable, list and tabs levels), at the end of each
  // content's header row.
  //
  // Collapsing swaps a pane's header for a strip button (icon + label) and hides — but keeps
  // mounted — its body. Which way it collapses follows the MEASURED grid: panes stacked in rows
  // become thin row strips, panes side by side in one row become narrow column strips. A track
  // whose panes are all collapsed is sized to the strip (`axisTemplate`), so the others take its
  // space; at least one pane stays expanded unless `keepOneExpanded: false`. Full screen uses the
  // Fullscreen API on the pane itself; the state follows the document's `fullscreenchange`, so
  // the browser's own Esc works too.
  // ─────────────────────────────────────────────────────────────────────────────

  protected readonly collapsible = computed(() => this.params().collapsible === true);
  /** collapse is offered in list/grid layout only — a tab panel is already one-at-a-time */
  protected readonly canCollapse = computed(
    () => this.collapsible() && !this.params().showContentsInTabs,
  );
  /** default on — at least one of this level's panes stays expanded */
  private readonly keepOneExpanded = computed(() => this.params().keepOneExpanded !== false);
  /** the collapse button shows — but not on a lone pane that has to stay expanded anyway */
  protected readonly collapseOffered = computed(
    () => this.canCollapse() && (!this.keepOneExpanded() || this.visibleContents().length > 1),
  );
  /** element full screen is available — not on iPhone Safari, nor in an iframe without
   *  `allow="fullscreen"`, nor in jsdom */
  private readonly fullscreenSupported = !!this.document.fullscreenEnabled;
  /** the full-screen button shows: opted in (list and tabs levels alike), and supported */
  protected readonly fullscreenOffered = computed(
    () => this.params().fullscreenable === true && this.fullscreenSupported,
  );
  /** every content at this level has a pane control — so a header row to hold it */
  protected readonly hasControls = computed(
    () => this.collapseOffered() || this.fullscreenOffered(),
  );

  /** the visible panes' keys, in order */
  private readonly visibleKeys = computed(() =>
    this.visibleContents().map((rc, i) => contentKey(rc, i)),
  );

  /** the collapsed panes' keys — written by `setCollapsed`, and re-checked whenever the visible
   *  panes change: with `keepOneExpanded`, a level whose visible panes all end up collapsed (the
   *  open one hidden since) reopens its first */
  private readonly collapsedKeys = linkedSignal<
    { visible: string[]; keepOne: boolean },
    ReadonlySet<string>
  >({
    source: () => ({ visible: this.visibleKeys(), keepOne: this.keepOneExpanded() }),
    computation: ({ visible, keepOne }, previous) => {
      const keys = previous?.value ?? new Set<string>();
      return keepOne ? keepFirstOpen(keys, visible) : keys;
    },
  });
  /** the visible panes still expanded */
  private readonly openKeys = computed(() =>
    this.visibleKeys().filter((key) => !this.collapsedKeys().has(key)),
  );
  private readonly fullscreenKey = signal<string | undefined>(undefined);
  /** the pane asked to go full screen — matched against `document.fullscreenElement` */
  private fullscreenTarget?: { key: string; el: HTMLElement };
  private fullscreenTrap?: FocusTrap;
  private readonly mountId = `cv${++nextMountId}`;

  protected readonly contentKey = contentKey;

  /** `'column'` when this level's contents sit side by side in one row, else `'row'` */
  protected readonly collapseAxis = computed<'row' | 'column'>(() =>
    this.rowCount() === 1 && this.colCount() > 1 ? 'column' : 'row',
  );

  /** per axis, which tracks hold nothing but collapsed panes (along `collapseAxis`) — those
   *  shrink to their strip. Empty until measured. */
  private readonly collapsedTracks = computed<{ cols: boolean[]; rows: boolean[] }>(() => {
    const m = this.gridMetrics();
    const list = this.visibleContents();
    const keys = this.collapsedKeys();
    if (!m || !this.canCollapse() || m.items.length !== list.length) return { cols: [], rows: [] };

    const byRow = this.collapseAxis() === 'row';
    const count = byRow ? m.rows.tracks.length : m.cols.tracks.length;
    const shut = Array<boolean>(count).fill(false);
    const open = Array<boolean>(count).fill(false);
    list.forEach((rc, i) => {
      const track = byRow ? m.items[i].row : m.items[i].col;
      if (keys.has(contentKey(rc, i))) shut[track] = true;
      else open[track] = true;
    });
    const tracks = shut.map((isShut, t) => isShut && !open[t]);
    return byRow ? { cols: [], rows: tracks } : { cols: tracks, rows: [] };
  });

  /** an axis whose tracks are ALL collapsed (only with `keepOneExpanded: false`) packs its strips
   *  to the start — nothing is left to take their space, and under the default content
   *  distribution `auto` tracks would stretch across it */
  protected readonly packedAxis = computed(() => {
    const { cols, rows } = this.collapsedTracks();
    return {
      cols: cols.length > 0 && cols.every(Boolean),
      rows: rows.length > 0 && rows.every(Boolean),
    };
  });

  protected isCollapsed(key: string): boolean {
    return this.canCollapse() && this.collapsedKeys().has(key);
  }

  /** with `keepOneExpanded`, the last expanded pane can't collapse — its button stays, disabled
   *  but focusable, its tooltip saying why */
  protected collapseLocked(key: string): boolean {
    const open = this.openKeys();
    return this.keepOneExpanded() && open.length === 1 && open[0] === key;
  }

  protected isFullscreen(key: string): boolean {
    return this.fullscreenKey() === key;
  }

  protected paneLabel(rc: ResolvedContent): string {
    return rc.content.label ?? rc.content.title ?? rc.content.slug ?? 'panel';
  }

  protected bodyId(key: string): string {
    return `${this.mountId}-body-${key}`;
  }

  protected controlId(control: 'collapse' | 'strip', key: string): string {
    return `${this.mountId}-${control}-${key}`;
  }

  /** collapse / restore — focus follows to the control that replaces the one clicked (the strip,
   *  or the collapse button back in the header), so keyboard users never lose their place. The
   *  last expanded pane stays expanded (`collapseLocked`). */
  protected setCollapsed(key: string, collapsed: boolean): void {
    if (collapsed && this.collapseLocked(key)) return;
    this.collapsedKeys.update((keys) => {
      const next = new Set(keys);
      if (collapsed) next.add(key);
      else next.delete(key);
      return next;
    });
    const focusId = this.controlId(collapsed ? 'strip' : 'collapse', key);
    afterNextRender(() => this.document.getElementById(focusId)?.focus(), {
      injector: this.injector,
    });
  }

  protected toggleFullscreen(key: string, el: HTMLElement): void {
    if (this.document.fullscreenElement === el) {
      void this.document.exitFullscreen();
      return;
    }
    this.fullscreenTarget = { key, el };
    // rejected without a user gesture, or when the element can't go full screen — stay put
    el.requestFullscreen().catch(() => (this.fullscreenTarget = undefined));
  }

  private exitFullscreen(): void {
    const target = this.fullscreenTarget;
    if (target && this.document.fullscreenElement === target.el) {
      void this.document.exitFullscreen();
    }
  }

  /** mirrors the browser's full-screen state — entered via our button, left via it or Esc. The
   *  pane stays "full screen" while a pane nested inside it is full screen on top of it (the
   *  browser's full-screen stack returns to it when that one exits). While full screen, Tab is
   *  trapped inside the pane — Chrome already makes the rest of the page inert; the trap covers
   *  browsers that don't — and the overlay container moves in with it (`syncOverlayContainer`). */
  private readonly onFullscreenChange = (): void => {
    syncOverlayContainer(this.document, this.overlayContainer.getContainerElement());

    const target = this.fullscreenTarget;
    const current = this.document.fullscreenElement;
    const active = !!target && !!current && target.el.contains(current);
    if (!active) this.fullscreenTarget = undefined;
    if (this.fullscreenKey() === (active ? target.key : undefined)) return;

    this.fullscreenTrap?.destroy();
    this.fullscreenTrap = active ? this.focusTrapFactory.create(target.el) : undefined;
    this.fullscreenKey.set(active ? target.key : undefined);
    // back in the grid's flow — measure what was frozen while full screen
    if (!active) this.scheduleMeasure();
  };

  /** the heading at the start of THIS content's header row (see `ContentViewBase.header`):
   *  - `'full'` → icon, `title` (else `label`) and badge.
   *  - `'auto'` → only with a `title`: icon, title and badge in list mode; the title alone while
   *    shown as a tab, whose toggle button above already carries icon, label and badge.
   *  - `'none'` → none. */
  protected headingOf(rc: ResolvedContent): ContentHeading | undefined {
    const { header, title, label, icon } = rc.content;
    const badge = badgeOf(rc);
    if (header === 'full') {
      const text = title || label;
      return text || icon || badge !== undefined ? { text, icon, badge } : undefined;
    }
    if (header === 'none' || !title) return undefined;
    return this.params().showContentsInTabs ? { text: title } : { text: title, icon, badge };
  }

  /** the header's top row — whenever there's a heading, any `actionButtons`, or pane controls */
  protected showsHeaderRow(rc: ResolvedContent): boolean {
    return !!this.headingOf(rc) || !!rc.content.actionButtons || this.hasControls();
  }

  /** whether THIS content renders a header at all — for its top row, or for the toggles of its
   *  own horizontal tabs; else nothing renders above the body */
  protected showsHeader(rc: ResolvedContent, key: string): boolean {
    return this.showsHeaderRow(rc) || !!this.headerNav(rc, key);
  }

  // ── tab toggles hosted for a content's own nested tabs level ──

  /** per content key: the slot its nested tabs level hands its navigation up to (`tabsHost`) */
  private readonly navHosts = new Map<string, WritableSignal<TabNavState | undefined>>();

  /** `key`'s slot — created on first read, so a template reading it subscribes before the nested
   *  level reports in */
  protected navHostFor(key: string): WritableSignal<TabNavState | undefined> {
    let host = this.navHosts.get(key);
    if (!host) this.navHosts.set(key, (host = signal<TabNavState | undefined>(undefined)));
    return host;
  }

  /** where the toggles of `rc`'s own nested tabs go — from its config alone, never from the
   *  nested level, so nothing re-renders once that reports in: its header for horizontal tabs
   *  (and for vertical ones below lg), a sidebar beside its body for vertical ones from lg up */
  private navSlot(rc: ResolvedContent): 'header' | 'side' | undefined {
    const c = rc.content;
    if (!c.contents?.length || !c.showContentsInTabs) return undefined;
    return c.tabsOrientation === 'vertical' && this.lgUp() ? 'side' : 'header';
  }

  /** a content whose own tabs are vertical keeps its content-area wrapper at every width, so
   *  crossing lg only moves the toggles — its body (and the nested level) stay mounted */
  protected hasSideSlot(rc: ResolvedContent): boolean {
    const c = rc.content;
    return !!c.contents?.length && !!c.showContentsInTabs && c.tabsOrientation === 'vertical';
  }

  protected headerNav(rc: ResolvedContent, key: string): TabNavState | undefined {
    return this.navSlot(rc) === 'header' ? this.hostedNav(key) : undefined;
  }

  protected sideNav(rc: ResolvedContent, key: string): TabNavState | undefined {
    return this.navSlot(rc) === 'side' ? this.hostedNav(key) : undefined;
  }

  /** the nested level's toggles, once it has reported in and has any */
  private hostedNav(key: string): TabNavState | undefined {
    const nav = this.navHostFor(key)();
    return nav?.tabs().length ? nav : undefined;
  }

  /** the content-area wrapper of a content with vertical tabs: from lg up, a row — its toggles,
   *  then its body; below lg, just the body's frame (the toggles have joined the header) */
  protected sideLayoutClass(rc: ResolvedContent): string {
    const cover = this.isCover();
    if (this.navSlot(rc) === 'side') {
      return cover ? 'flex gap-2 min-w-0 flex-1 min-h-0' : 'flex gap-2 min-w-0 items-start';
    }
    return cover ? 'flex flex-col flex-1 min-h-0' : '';
  }

  /** the sidebar holding those toggles: full height (scrolling inside) in cover, sticky in flow */
  protected readonly sideNavSlotClass = computed(() =>
    this.isCover() ? 'flex flex-none min-h-0' : 'flex flex-none sticky top-0',
  );

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
        // a collapsed track measures only its strip — never seed a share from that
        const shut = this.collapsedTracks();
        const measuredCols = shut.cols.some(Boolean) ? undefined : m?.cols.tracks;
        const measuredRows = shut.rows.some(Boolean) ? undefined : m?.rows.tracks;
        if (this.colFractions().length !== cols) {
          this.colFractions.set(
            this.seedFractions(
              cols,
              persisted?.columns,
              initial?.columns,
              measuredCols?.map((t) => t.size),
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
              measuredRows?.map((t) => t.size),
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
        if (!this.measureFrozen()) this.measureGrid();
      });
      this.gridResizeObserver.observe(el);
    });
    this.destroyRef.onDestroy(() => this.gridResizeObserver?.disconnect());

    effect(() => {
      if (!this.measureActive()) {
        untracked(() => this.gridMetrics.set(null));
        return;
      }
      this.visibleContents(); // tracked so a boundary-moving change reschedules a measure:
      this.lgUp(); //           contents added/removed, the viewport crossing the breakpoint,
      this.colFractions(); //   the split itself changing (drag commit / setSizes / restore),
      this.rowFractions(); //   a pane collapsing / restoring, or the fit flipping
      this.collapsedKeys();
      this.resolvedFit();
      untracked(() => this.scheduleMeasure());
    });

    this.document.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      this.fullscreenTrap?.destroy();
      // don't strand the overlay container in a pane that's leaving the DOM
      const container = this.overlayContainer.getContainerElement();
      if (this.fullscreenTarget?.el.contains(container)) this.document.body.appendChild(container);
      this.exitFullscreen();
    });

    // a tab panel shown once is "visited" — `rendersPanel` keeps its content mounted
    effect(() => {
      const key = this.effectiveActiveKey();
      if (key === undefined || !this.params().showContentsInTabs) return;
      untracked(() => {
        if (!this.visitedKeys().has(key)) this.visitedKeys.update((keys) => new Set(keys).add(key));
      });
    });

    // restore the persisted active tab once this tabs level's contents first resolve
    effect(() => {
      if (!this.params().showContentsInTabs || this.tabsPersistKey) return;
      const list = this.visibleContents();
      if (list.length) untracked(() => this.restoreActiveTab(list));
    });

    // the owner renders this level's toggles only while this level is alive
    this.destroyRef.onDestroy(() => {
      const host = this.tabsHost();
      if (host?.() === this.navState) host.set(undefined);
    });
  }

  ngOnInit(): void {
    const getContents = () => flattenContents(this.params().contents);
    const instance: ContentsViewInstance = {
      get contents() {
        return getContents();
      },
      activeContent: () => this.activeRc()?.content,
      activeSlug: () => this.activeRc()?.content.slug,
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
      collapsed: () => [...this.collapsedKeys()],
      setCollapsed: (slug, collapsed) => this.setCollapsed(slug, collapsed),
      fullscreenSlug: () => this.fullscreenKey(),
      exitFullscreen: () => this.exitFullscreen(),
    };
    this.instanceChange.emit(instance);

    // a nested level hands its toggles to the content owning these tabs (see `tabsHost`)
    this.tabsHost()?.set(this.navState);
  }

  private selectBySlug(slug: string): void {
    const index = this.visibleContents().findIndex((rc) => rc.content.slug === slug);
    if (index >= 0) this.selectByKey(this.visibleKeys()[index]);
  }

  /** a toggle (or `selectContent`) picked a tab — a disabled one never activates */
  private selectByKey(key: string): void {
    const rc = this.visibleContents()[this.visibleKeys().indexOf(key)];
    if (rc && !rc.disabled) this.activate(rc, key);
  }

  private activate(rc: ResolvedContent, key: string): void {
    this.activeKeySig.set(key);
    if (this.tabsPersistKey) writePersistedSelection(this.tabsPersistKey, key);
    rc.content.onActive?.(rc.content, this.params().contents);
    this.params().onContentChange?.(rc.content, this.params().contents);
  }

  /** claims this level's localStorage slot (route + its contents) and re-activates the tab saved
   *  there, if it's still here and enabled — firing `onActive` / `onContentChange` like a pick */
  private restoreActiveTab(list: ResolvedContent[]): void {
    const persistKey = claimPersistedSelectionKey(
      TABS_NAMESPACE,
      this.router.url,
      list.map((rc) => rc.content.slug ?? rc.content.label ?? ''),
    );
    this.tabsPersistKey = persistKey;
    this.destroyRef.onDestroy(() => releasePersistedSelectionKey(persistKey));

    const saved = readPersistedSelection(persistKey);
    if (saved !== null && saved !== this.effectiveActiveKey()) this.selectByKey(saved);
  }

  /** Builds the nested mount's `ContentsParameter` — cascading `contentsClass`/
   *  `contentsContainerClass`/`tabsContainerClass`/`tabClass`/`activeTabClass`/
   *  `tabIndicatorClass`/`bodiesClass`/`headersClass` by merging THIS level's
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
      tabClass: mergeClasses(this.params().tabClass ?? '', content.tabClass ?? ''),
      activeTabClass: mergeClasses(this.params().activeTabClass ?? '', content.activeTabClass ?? ''),
      tabIndicatorClass: mergeClasses(
        this.params().tabIndicatorClass ?? '',
        content.tabIndicatorClass ?? '',
      ),
      bodiesClass: mergeClasses(this.params().bodiesClass ?? '', content.bodiesClass ?? ''),
      headersClass: mergeClasses(this.params().headersClass ?? '', content.headersClass ?? ''),
      tabsOrientation: content.tabsOrientation,
      showContentsInTabs: content.showContentsInTabs,
      // `contentsFit` is NOT cascaded — a nested drill-down legitimately differs (a 'flow'
      // section inside a 'cover' dashboard); each level defaults to 'auto' and consumes its own
      // value (see `resolvedFit` / `nestedContentsClass` / `resizeActive`).
      contentsFit: content.contentsFit,
      // `flowOnSmallerView` / `resizable` / `persistSizes` / `collapsible` / `keepOneExpanded` /
      // `fullscreenable` DO cascade — set once on an ancestor and every nested level follows (a
      // resizable level still only shows gutters when its own measured layout has >1
      // row/column); a child sets its own value (e.g. `resizable: false`) to opt its subtree
      // out. `initialSizes` / `onSizesChange` stay root-only (a nested level persists via
      // localStorage instead).
      flowOnSmallerView: content.flowOnSmallerView ?? this.params().flowOnSmallerView,
      resizable: content.resizable ?? this.params().resizable,
      persistSizes: content.persistSizes ?? this.params().persistSizes,
      collapsible: content.collapsible ?? this.params().collapsible,
      keepOneExpanded: content.keepOneExpanded ?? this.params().keepOneExpanded,
      fullscreenable: content.fullscreenable ?? this.params().fullscreenable,
      preserveInactiveContent: content.preserveInactiveContent,
    };
  }

  /** wraps the recursively-nested `<contents-view>` mount (see the `#contentBody` template).
   *  `flex-1 min-h-0` only when the CHILD's own resolved fit is `'cover'` — resolved here the way
   *  the child will (`resolvedFit`) from its own `contentsFit` (NOT cascaded) and its effective,
   *  cascaded `flowOnSmallerView`, against THIS mount's `lgUp()`. `'cover'`: lets it share
   *  `bodyClass`'s flex column with any preceding switch-output sibling (e.g. a `'table'` node
   *  that also has nested `.contents`) and shrink, so ITS OWN internal min-h-0 chain owns the
   *  scrolling — instead of a literal `h-full`, which would either overflow (with a sibling
   *  present) or add an inert extra scroll boundary (as the sole child). `'flow'`: no class — it
   *  grows to its natural height and this mount's own `overflow-y-auto` body-scroll region
   *  scrolls it. */
  protected nestedContentsClass(content: ContentView): string {
    const flowOnSmaller = content.flowOnSmallerView ?? this.params().flowOnSmallerView ?? true;
    const childCover =
      (this.lgUp() || !flowOnSmaller) && (content.contentsFit ?? 'auto') !== 'flow';
    return childCover ? 'flex-1 min-h-0' : '';
  }

  protected readonly trackContent = (_: number, rc: ResolvedContent): string | number =>
    rc.content.slug ?? _;
}
