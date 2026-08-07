import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnInit,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { combineLatest, isObservable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ActionButtonsComponent } from '../action-buttons/action-buttons.component';
import { resolveDynamicValue$ } from '../action-buttons/dynamic-value.util';
import { DataGridComponent } from '../data-grid';
import { DetailsComponent } from '../details/details.component';
import { GenericFormComponent } from '../generic-form';
import { mergeClasses } from '../details/util/class-name/class-name.helpers';
import { ContentsViewInstance, ContentsParameter, ContentView } from './contents.interface';

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

  /** default true: contents fit into the available bounded height and each content's own body
   *  scrolls internally; false: contents grow to their natural height and the nearest scrollable
   *  ancestor (usually the page, unless this mount is nested inside another fit=true mount's own
   *  body-scroll region — see `nestedContentsClass`) scrolls instead. Independent per nesting
   *  level, not cascaded — see the field-by-field comment on `nestedParameter` below. */
  protected readonly fitIntoView = computed(() => this.params().fitContentsIntoView ?? true);

  /** reactive `:host` sizing, replacing the old static `:host { height: 100%; width: 100% }` SCSS
   *  rule — same `host: { '[class]': ... }` pattern `grid-cell.component.ts` already uses for a
   *  reactive host class. `min-h-0` only under `fitIntoView()`: lets THIS element shrink below its
   *  content's natural height when it's itself a flex/grid item of a bounded ancestor (mounted
   *  recursively inside another level's body-scroll-region, or at the top level inside a bounded
   *  flex parent). With fitIntoView() false, omitting it preserves "grow to natural height". */
  protected readonly hostClass = computed(() =>
    ['block h-full w-full', this.fitIntoView() ? 'min-h-0' : ''].filter(Boolean).join(' '),
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

  /** ALWAYS-applied structural layout (sidebar-left vertical vs row-on-top horizontal) for the
   *  tablist+panels wrapper. `h-full min-h-0`, fitIntoView() only: lets the tablist (natural size)
   *  and `.contents-view-panels` (fills the rest) correctly split a BOUNDED total height; with no
   *  bound requested, this wrapper (like everything below it) just grows to its natural height. */
  protected readonly tabsStructureClass = computed(() => {
    const vertical = this.tabsOrientation() === 'vertical';
    return [
      vertical
        ? 'contents-view-tabs-structure-vertical'
        : 'contents-view-tabs-structure-horizontal',
      'flex',
      vertical ? 'flex-row items-stretch' : 'flex-col',
      this.fitIntoView() ? 'h-full min-h-0' : '',
    ]
      .filter(Boolean)
      .join(' ');
  });

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
      activeRc && this.showsHeader(activeRc) ? 'rounded-t-lg mb-[1px]' : 'rounded-lg mb-2';

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

  /** every tab toggle button's class list. `contents-view-tab`/`contents-view-tab--active` remain
   *  plain class-name tokens (not Tailwind utilities) — the residual SCSS's
   *  `.contents-view-tab.contents-view-tab--active`/`:focus-visible` rules still target them by
   *  name. No explicit font/color "inherit" utilities: Tailwind's Preflight already resets
   *  `button` elements to inherit font and color from their ancestors. */
  protected tabButtonClass(rc: ResolvedContent): string {
    const active = rc.content.slug === this.effectiveActiveSlug();
    return (
      'contents-view-tab inline-flex items-center gap-1 px-3 py-2 border-none bg-transparent ' +
      'cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed' +
      (active ? ' contents-view-tab--active text-blue-400 ' : '')
    );
  }

  /** min-width:0 (both orientations, not just the vertical flex-row case): without it, a wide
   *  descendant (e.g. a data-grid with a resized column) grows THIS box to fit rather than being
   *  clipped/scrolled locally — the classic "flex/grid item won't shrink below content" default.
   *  `flex-auto` (`flex: 1 1 auto`, NOT `flex-1`/`flex: 1 1 0%`) preserves the original rule's
   *  flex-basis. `min-h-0`, fitIntoView() only, is the same fix on the vertical axis — applied
   *  regardless of orientation (harmless where it isn't strictly needed), matching this
   *  component's own existing min-width:0 precedent/rationale. */
  protected readonly panelsClass = computed(() =>
    ['contents-view-panels', 'min-w-0 flex-auto', this.fitIntoView() ? 'min-h-0' : '']
      .filter(Boolean)
      .join(' '),
  );

  /** every content's own wrapper (list item or tab panel). `min-w-0` (existing horizontal fix)
   *  always applies; `flex flex-col h-full min-h-0`, fitIntoView() only, turns it into the
   *  "pinned header + scrollable body" column — the `#header` output is `flex-none` (see the
   *  template), and `bodyClass` is `flex-1 min-h-0 overflow-y-auto`, filling and
   *  independently scrolling whatever's left under the header. With no header, the body wrapper is
   *  the only flex child and (correctly) fills the whole box on its own. */
  private readonly itemBaseClass = computed(() =>
    ['contents-view-item', 'min-w-0', this.fitIntoView() ? 'flex flex-col h-full min-h-0' : '']
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

  /** tab-panel variant of `listItemClass`: an inactive (but mounted, per
   *  `preserveInactiveContent`) panel gets plain `'hidden'` instead of the merged flex/grid
   *  classes — deliberately at the STRING level, rather than adding a `hidden` class alongside
   *  `flex`/`grid` ones and relying on the native `[hidden]` attribute to win: `[hidden]`'s
   *  `display:none` comes from the user-agent stylesheet, and author-origin CSS (any Tailwind
   *  utility class) always wins over user-agent-origin CSS regardless of source order — so once
   *  this wrapper carries a real `flex`/`grid` class, `[hidden]` alone can no longer reliably hide
   *  it. The `[hidden]` attribute (template, unchanged) stays too, redundantly, for native
   *  hidden-content semantics (find-in-page, print, assistive tech). */
  protected panelItemClass(rc: ResolvedContent): string {
    return rc.content.slug === this.effectiveActiveSlug() ? this.listItemClass(rc) : 'hidden';
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
      this.fitIntoView() ? 'flex flex-1 flex-col min-h-0 overflow-y-auto' : '',
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
      this.params().showContentsInTabs ? 'rounded-b-lg' : 'rounded-lg',
    ].join(' ');

    return mergeClasses(
      mergeClasses(structural, this.params().headersClass ?? ''),
      rc.content.headerClass ?? '',
    );
  }

  /** the actual default grid. `grid-cols-1 sm:grid-cols-2` is the mobile-first equivalent of the
   *  old `@media (max-width: 640px) { grid-template-columns: 1fr }` (Tailwind's `sm:` breakpoint
   *  is exactly 640px). `auto-rows-fr` (`grid-auto-rows: minmax(0, 1fr)`) plus `h-full min-h-0`,
   *  fitIntoView() only: every row shares the available height equally instead of sizing to
   *  content, so a multi-row grid never grows past what's available — overflow is absorbed by each
   *  item's own body-scroll region (both `.contents-view-item` and its body wrapper are
   *  `min-h-0`), not by the grid. */
  private readonly defaultContentsContainerClass = computed(() => {
    let lgClass = '';
    if (this.params().contents.length > 1) lgClass = 'lg:grid-cols-2';

    return [
      'contents-view-default-grid grid grid-cols-1 gap-4 ' + lgClass,
      this.fitIntoView() ? 'h-full min-h-0 auto-rows-fr' : '',
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

  /** unique-enough per-mount id prefix for tab/panel ARIA id pairs. */
  private readonly instanceId = `contents-view-${Math.random().toString(36).slice(2)}`;

  protected tabId(rc: ResolvedContent, index: number): string {
    return `${this.instanceId}-tab-${rc.content.slug ?? index}`;
  }
  protected panelId(rc: ResolvedContent, index: number): string {
    return `${this.instanceId}-panel-${rc.content.slug ?? index}`;
  }

  /** every slug that has been the active tab at least once — panels for these stay mounted
   *  (subject to `preserveInactiveContent`) instead of being torn down, re-implementing what
   *  Material's `preserveContent`/`matTabContent` used to give for free. */
  private readonly everActivatedSlugs = signal<ReadonlySet<string | undefined>>(new Set());

  protected isPanelMounted(rc: ResolvedContent): boolean {
    const slug = rc.content.slug;
    if (slug === this.effectiveActiveSlug()) return true;
    if (!(this.params().preserveInactiveContent ?? true)) return false;
    return this.everActivatedSlugs().has(slug);
  }

  /** whether THIS content's own header should show its label/icon — suppressed by default while
   *  shown as a tab (the tab toggle button already shows label/icon/badge), unless overridden. */
  protected showHeaderLabelIcon(content: ContentView): boolean {
    return !this.params().showContentsInTabs || !!content.showFullHeaderInTabs;
  }

  /** widened header gate: label-or-icon (when not suppressed) || badge || actionButtons — vs.
   *  the label-only gate this used to have. */
  protected showsHeader(rc: ResolvedContent): boolean {
    const hasLabelOrIcon =
      this.showHeaderLabelIcon(rc.content) && !!(rc.content.label || rc.content.icon);
    const hasBadge = rc.badge !== undefined && rc.badge !== null && rc.badge !== '';
    return hasLabelOrIcon || hasBadge || !!rc.content.actionButtons;
  }

  protected onTabClick(rc: ResolvedContent): void {
    this.activateContent(rc.content);
  }

  private readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /** WAI-ARIA APG "Tabs Pattern" roving-tabindex keyboard handling: arrow keys move focus AND
   *  activate (automatic activation, matching the old click-to-switch-immediately UX), wrapping
   *  at the ends; Home/End jump to the first/last enabled tab. Enter/Space activation and Tab-key
   *  sequencing (skipping inactive tabs) come for free from native `<button>`/roving `tabindex`. */
  protected onTablistKeydown(event: KeyboardEvent): void {
    const enabled = this.visibleContents().filter((rc) => !rc.disabled);
    if (!enabled.length) return;
    const vertical = this.tabsOrientation() === 'vertical';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = vertical ? 'ArrowUp' : 'ArrowLeft';

    let target: ResolvedContent | undefined;
    if (event.key === nextKey || event.key === prevKey) {
      const idx = enabled.findIndex((rc) => rc.content.slug === this.effectiveActiveSlug());
      const delta = event.key === nextKey ? 1 : -1;
      target = enabled[(idx + delta + enabled.length) % enabled.length];
    } else if (event.key === 'Home') {
      target = enabled[0];
    } else if (event.key === 'End') {
      target = enabled[enabled.length - 1];
    } else {
      return;
    }
    event.preventDefault();
    this.activateContent(target.content);
    const focusIndex = this.visibleContents().findIndex(
      (rc) => rc.content.slug === target!.content.slug,
    );
    this.tabButtons()[focusIndex]?.nativeElement.focus();
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

    effect(() => {
      const slug = this.effectiveActiveSlug();
      if (this.everActivatedSlugs().has(slug)) return;
      this.everActivatedSlugs.update((set) => new Set(set).add(slug));
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
      // NOT merged/cascaded like contentsClass etc. above — a boolean mode toggle with its own
      // sensible independent default (true) at every level, not an accumulating style value; see
      // `fitIntoView`/`nestedContentsClass` for how each level's own value is consumed.
      fitContentsIntoView: content.fitContentsIntoView,
      preserveInactiveContent: content.preserveInactiveContent,
    };
  }

  /** wraps the recursively-nested `<contents-view>` mount (see the `#contentBody` template).
   *  `flex-1 min-h-0` only when the CHILD's own `fitContentsIntoView` (an independent default of
   *  true, NOT cascaded/merged — see the comment on `nestedParameter` above) is true: lets it
   *  share `bodyClass`'s flex column with any preceding switch-output sibling (e.g. a
   *  `'table'` node that also has nested `.contents`) and shrink, so ITS OWN internal min-h-0
   *  chain (down to its own items' body-scroll regions) owns the actual scrolling — instead of a
   *  literal `h-full`, which would either overflow (with a sibling present) or add an inert-but-
   *  harmless extra scroll boundary (as the sole child, e.g. a `'group'` node with no switch-
   *  rendered body of its own). When the child's own fitContentsIntoView is false: no class — it
   *  grows to its natural height, and the OUTER body-scroll-region (this mount's own, already
   *  `overflow-y-auto` when THIS level's fitIntoView() is true) scrolls it, which is exactly the
   *  "nearest scrollable ancestor" the false-mode doc comment promises — just not literally the
   *  page, in this nested case. */
  protected nestedContentsClass(content: ContentView): string {
    return (content.fitContentsIntoView ?? true) ? 'flex-1 min-h-0' : '';
  }

  protected readonly trackContent = (_: number, rc: ResolvedContent): string | number =>
    rc.content.slug ?? _;
}
