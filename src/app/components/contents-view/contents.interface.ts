import { Observable } from 'rxjs';
import { TemplateRef, Type } from '@angular/core';
import { ActionButton, DynamicValue } from '@components/action-buttons/action-button.interface';
import { GridParameter } from '@components/data-grid';
import { DetailsParameter } from '@components/details/interfaces/details.interface';
import { FormParameter } from '@components/generic-form';

export type ContentType = 'group' | 'table' | 'details' | 'form' | 'html' | 'component';

/** Layout of a node's OWN children — shared by `ContentView` (a group node's children)
 *  and `ContentsParameter` (the root's children); each nesting level can lay its
 *  own children out independently. */
export interface ContentsLayout {
  /** Applied to every content's own container from this level down through all nested levels,
   *  merged with each nested level's own `contentsClass` — and, at each content itself, further
   *  merged with that content's own `class`. */
  contentsClass?: string;
  /** Arranges the display of a contents list; applied from this level down through all nested
   *  levels, merged with each level's own `contentsContainerClass`. Falls back to
   *  `'contents-view-default-grid'` only when nothing in the chain ever set a value. Has no
   *  effect for a level whose `showContentsInTabs` is true (nothing reads it there — a single
   *  active tab isn't a "list" to arrange). */
  contentsContainerClass?: string;
  /** The tab toggles' container — the strip (horizontal) or the sidebar (vertical) holding them,
   *  not the panels. Merged over the defaults (a bordered, rounded white strip), so any of those
   *  can be overridden; applied from this level down through all nested levels, merged with each
   *  level's own value. See `showContentsInTabs`. */
  tabsContainerClass?: string;
  /** Every tab toggle — merged over the defaults (rounded, `px-3.5`, `h-[34px]`, `font-medium`,
   *  a hover tint). Cascades like `tabsContainerClass`. Tip: give a text colour here, not a font
   *  size on the container — class merging treats every `text-*` as one group. */
  tabClass?: string;
  /** The active tab toggle, merged after `tabClass` (default `text-white`, to read on the
   *  indicator). Cascades like `tabsContainerClass`. */
  activeTabClass?: string;
  /** The indicator sliding behind the active toggle (default a `bg-primary` pill covering it,
   *  sliding over 300ms). Its size and offset are classes reading the active toggle's measured
   *  box (`--cv-tab-x/y/w/h`), so it can be reshaped too — e.g. `bg-emerald-600`, or an underline:
   *  `h-0.5 top-auto bottom-0 rounded-none` (with an `activeTabClass` such as `text-primary`).
   *  Cascades like `tabsContainerClass`. */
  tabIndicatorClass?: string;
  /** Applied to every child content's own BODY (the scrollable region holding its rendered
   *  table/details/form/html/component, below its header) from this level down through all
   *  nested levels, merged with each nested level's own `bodiesClass` — and, at each content
   *  itself, further merged with that content's own `bodyClass`. The body-level analog of
   *  `contentsClass`, which targets a content's whole container (header + body) rather than just
   *  the body. */
  bodiesClass?: string;
  /** Applied to every child content's own HEADER (the heading / actionButtons / pane-controls row
   *  above its body) from this level down through all nested levels, merged with each nested
   *  level's own `headersClass` — and, at each content itself, further merged with that content's
   *  own `headerClass`. The header-level analog of `bodiesClass`. */
  headersClass?: string;
  /** default `'horizontal'` — where this level's tab toggles go (see `showContentsInTabs`):
   *  - `'horizontal'`: in the header of the content owning the tabs, under its heading /
   *    buttons and a faded rule; they make that header show even when nothing else would.
   *  - `'vertical'`: a sidebar beside that content's body (its header shows only for its own
   *    reasons), the indicator sliding vertically. Below Tailwind's `lg` they turn horizontal and
   *    join the header instead, leaving the content the full width — the content isn't re-created
   *    as the breakpoint is crossed, only the toggles move.
   *  At the root, owned by no content, the toggles sit in a card above the panels — or beside
   *  them, vertical from lg up. */
  tabsOrientation?: 'horizontal' | 'vertical';
  /** default false. Shows this level's contents as tab panels, one at a time, switched by a row
   *  (or column) of toggles placed per `tabsOrientation` and styled by `tabsContainerClass` /
   *  `tabClass` / `activeTabClass` / `tabIndicatorClass`. They behave like Material's tabs:
   *  - keyboard: arrow keys move focus (wrapping; ↑/↓ when vertical), Home/End jump,
   *    Enter/Space select — so arrowing past a panel that fetches doesn't load it; a disabled
   *    content's toggle is focusable but never selected.
   *  - an indicator slides behind the active toggle.
   *  - horizontal toggles that don't fit scroll (swipe, trackpad), with prev/next arrows that
   *    page — held, they repeat — keeping the focused / active toggle in view.
   *  The active tab is remembered per route (localStorage). A panel renders when first shown;
   *  `preserveInactiveContent` keeps it mounted afterwards. */
  showContentsInTabs?: boolean;
  /** How this level's contents use vertical space at viewport width ≥ Tailwind's `lg` (64rem /
   *  1024px) — below that, `flowOnSmallerView` (default on) makes every level `'flow'`. Default
   *  `'auto'`. Independent per nesting level — NOT cascaded (see `nestedParameter`).
   *  - `'cover'` / `'auto'` (the same): contents fit the available bounded height; each
   *    content's own body scrolls internally (its header/toolbar/paginator stay pinned). The
   *    nested-scroll-region model.
   *  - `'flow'`: contents grow to their natural height and the nearest scrollable ancestor
   *    scrolls instead — another level's `'cover'` body-scroll region when nested, or, at the
   *    root, the contents-view itself once its parent bounds its height (the root host becomes
   *    the scroll container), else the page. */
  contentsFit?: 'auto' | 'cover' | 'flow';
  /** default true: below Tailwind's `lg` (64rem / 1024px) this level flows — natural heights,
   *  one scrolling stack, no fitting into the viewport — whatever its `contentsFit`; re-resolved
   *  live via `matchMedia`. Set false to keep `'cover'` on small screens too. CASCADES to nested
   *  levels like `resizable` (a child sets its own value to override). */
  flowOnSmallerView?: boolean;
  /** default false. When true, and this level lays its contents out as a list/grid (not tabs)
   *  in the resolved `'cover'` fit with more than one visible content, a draggable gutter appears
   *  between every adjacent pair of panes — one per interior column boundary AND one per interior
   *  row boundary of whatever grid `contentsContainerClass` actually renders (MEASURED at
   *  runtime, never assumed, and never overridden): a single-column stack gets height gutters, a
   *  two-column grid gets a width gutter, a wrapped grid gets both. Drag or arrow-key a gutter to
   *  retune how that space is shared. No effect in tabs mode, `'flow'` fit, or with a single
   *  content. Assumes a CSS-grid container; a non-grid `contentsContainerClass` is best-effort.
   *  CASCADES to nested levels — set it once on an ancestor and every nested list/grid level is
   *  resizable too (each still only shows gutters when its own measured layout has >1 track); set
   *  `resizable: false` on a child to opt that subtree out. See `initialSizes` / `onSizesChange`
   *  / `persistSizes` and `ContentsViewInstance.sizes`. */
  resizable?: boolean;
  /** default true. When `resizable` is on, the dragged pane sizes for this level are persisted
   *  to `localStorage` (keyed by route + content slugs) and restored on the next visit with no
   *  wiring. Set false to keep resizing in-memory only for the session. Cascades to nested
   *  levels like `resizable` (a child sets its own value to override). */
  persistSizes?: boolean;
  /** default false. Adds a collapse button to every content at this level (list/grid levels
   *  only — a tab panel is already one-at-a-time), at the end of its header row (which then
   *  always shows — see `ContentViewBase.header`). Collapsing shrinks the pane to a strip showing
   *  just its icon and label — a thin ROW strip when this level's contents are stacked in rows, a
   *  narrow COLUMN strip (label turned 90°) when they sit side by side in one row. A grid track
   *  holding only collapsed panes shrinks to fit the strip and the rest share the space; clicking
   *  the strip restores it (a `resizable` split comes back as it was). At least one pane per level
   *  stays expanded (see `keepOneExpanded`). The collapsed pane stays mounted, so a grid's or
   *  form's state survives. Session-only, not persisted. CASCADES to nested levels like
   *  `resizable`; set `collapsible: false` on a child to opt its subtree out. See
   *  `ContentsViewInstance.collapsed` / `setCollapsed`. */
  collapsible?: boolean;
  /** default true. With `collapsible`, at least one pane per level stays expanded: the last
   *  expanded pane's collapse button is disabled (its tooltip says why) and `setCollapsed` leaves
   *  it be, a lone pane gets no collapse button at all, and a level whose visible panes all end
   *  up collapsed anyway (the open one hidden since) reopens its first. Set false to let every
   *  pane collapse — the strips then pack to the start of the level. Cascades to nested levels
   *  like `collapsible` (a child sets its own value to override). */
  keepOneExpanded?: boolean;
  /** default false. Adds a full-screen button to every content at this level (list and tabs
   *  levels, where the browser supports element full screen), at the end of its header row
   *  (which then always shows — see `ContentViewBase.header`): the pane goes browser full screen
   *  via the Fullscreen API; its button, or Esc, restores it. Dialogs, menus and notifications
   *  opened meanwhile show — and work — inside it (the CDK overlay container moves in with it,
   *  since the browser makes the rest of the page inert). CASCADES to nested levels like
   *  `collapsible`; set `fullscreenable: false` on a child to opt its subtree out. See
   *  `ContentsViewInstance.fullscreenSlug` / `exitFullscreen`. */
  fullscreenable?: boolean;
  /** default true: a tab's content, rendered when the tab is first shown, stays mounted (hidden)
   *  once left — a live `formParams`/`gridParams` embed keeps its state — rather than being
   *  destroyed on tab switch; set false to free resources for a rarely-revisited or expensive tab
   *  instead. Only relevant when `showContentsInTabs` is true. */
  preserveInactiveContent?: boolean;
}

/**
 * A persisted/seeded pane-size distribution for a `resizable` contents layout. Each array is a
 * list of *fractions* — relative weights, e.g. `[1.4, 0.6]` means the first pane gets 70% — not
 * pixels or percentages. An array is applied only when its length equals that axis' current
 * measured track count; a layout whose shape changed since it was saved (viewport crossed a
 * breakpoint, contents added/removed) safely falls back to an equal split for that axis.
 */
export interface ContentsSizes {
  /** column weights, left → right. Length must equal the measured column count. */
  columns?: number[];
  /** row-height weights, top → bottom. Length must equal the measured row count. */
  rows?: number[];
}

interface ContentViewBase extends ContentsLayout {
  icon?: string;
  /** stable identity — used for tracking, `initialActive`/active-selection, and the
   *  payload of `onActive`/`onContentChange`/`ContentsViewInstance.selectContent` */
  slug?: string;
  /** names this content on its tab and its collapsed strip (and in its controls' accessible
   *  names) — and heads its header only under `header: 'full'` with no `title` */
  label?: string;
  /** the heading of this content's header row, in place of `label` — see `header` */
  title?: string;
  /** a short value/count shown as a badge on the content's tab (if shown in tabs),
   *  ahead of the label */
  badge?: string | number | Observable<string | number>;

  /** action buttons rendered in this content's own header row, after its heading — reuses
   *  `ActionButtonsComponent` verbatim (data passed to each button is this `ContentView`). They
   *  always show: having any makes the header row appear, whatever `header` says. */
  actionButtons?: DynamicValue<ActionButton<ContentView>[], ContentView>;

  /** hides this content (and its tab, if shown in tabs) entirely; default true */
  visible?: DynamicValue<boolean, ContentView>;
  /** shows the tab but blocks activation; default false. No effect outside tabs mode */
  disabled?: DynamicValue<boolean, ContentView>;

  /** informational unless `ContentsParameter.hasPermission` is supplied — with no
   *  checker, the caller is expected to have pre-filtered `contents` already */
  permissions?: string[];

  /** styling class for this content's own container (header + body together) */
  class?: string;
  /** styling class for this content's own BODY only (the scrollable region below its header,
   *  holding its rendered table/details/form/html/component) — merged with the cascaded
   *  `bodiesClass` from ancestor levels, see `ContentsLayout.bodiesClass` */
  bodyClass?: string;
  /** styling class for this content's own HEADER only (the heading / actionButtons /
   *  pane-controls row above its body) — merged with the cascaded `headersClass` from ancestor
   *  levels, see `ContentsLayout.headersClass` */
  headerClass?: string;

  /** default false; whether this is the initially active content among its siblings
   *  (only meaningful when the parent renders its children as tabs). If none of a
   *  sibling group sets this, the first one is active by default. */
  initialActive?: boolean;
  /** fires when this content is activated (tabs mode only) */
  onActive?: (content: ContentView, siblings: ContentView[]) => void;

  /** this content's HEADING — the start of its header's top row, ahead of its `actionButtons` and
   *  pane controls (collapse / full screen: `collapsible` / `fullscreenable`). The row shows
   *  whenever it has a heading or any of those buttons; the header itself also shows to hold the
   *  toggles of this content's own horizontal tabs (`showContentsInTabs`), under that row and a
   *  faded rule. With none of these, nothing renders above the body. Default `'auto'`.
   *  - `'auto'`: the `title`, when there is one — with icon and badge in list mode, alone while
   *    shown as a tab (the tab toggle button above already carries those). No `title`, no
   *    heading: the `label` then only names the tab / collapsed strip.
   *  - `'full'`: always the full heading — icon, `title` (else `label`), badge — even as a tab.
   *  - `'none'`: never a heading; the row still shows to hold the buttons. */
  header?: 'auto' | 'full' | 'none';

  /** child contents — always available, on every variant, not just `'group'`. A node
   *  can both render its own view (a grid, a form, ...) AND have its own nested
   *  tabs/list beneath it (e.g. a `'table'` node whose children add a details
   *  drill-down). */
  contents?: ContentView[];
}

export type ContentView =
  | (ContentViewBase & { type: 'group' }) // pure container: only `contents`, no render params
  | (ContentViewBase & { type: 'table'; gridParams: GridParameter })
  | (ContentViewBase & { type: 'details'; detailsParams: DetailsParameter })
  | (ContentViewBase & { type: 'form'; formParams: FormParameter })
  | (ContentViewBase & { type: 'html'; html: string | Observable<string> })
  | (ContentViewBase & {
      type: 'component';
      componentParams: {
        /** dynamic component — caller's choice vs `template`, same convention as
         *  `GridRowDetailConfig`/`GridColumn_.template` */
        component?: Type<unknown>;
        /** template reference instead of `component` */
        template?: TemplateRef<unknown>;
        /** context for `template`; ignored for `component`. Always includes
         *  `$implicit`/`content` (this ContentView) in addition to whatever's merged in */
        templateContext?: Record<string, unknown>;
        inputs?: Record<string, unknown>;
        outputs?: Record<string, (event: unknown) => void>;
      };
    });

/**
 * Inputs to the contents-view component: one or more content types (table, details,
 * form, html, component), shown as tabs or a list, recursively nestable via
 * `ContentView.contents` (a `'group'` node's children can themselves be laid out as
 * tabs or a list, independently of their parent). Takes the full available viewport
 * height/width; see `ContentsLayout.contentsFit` for scroll behavior.
 *
 * By default (not in tabs), children render as a two-column list unless overridden
 * via `contentsContainerClass` — likely single-column on mobile via that same class's
 * own responsive styling, not a separate config option here.
 *
 * `html`/`component`/`template` content don't get a dedicated `loading` prop:
 * `html` as an `Observable<string>` already renders nothing until it emits, and
 * `component`/`template` content is a full Angular component/template that can
 * render its own loading UI internally — an extra flag here would be redundant.
 */
export interface ContentsParameter extends ContentsLayout {
  contents: ContentView[];

  /** gates `ContentView.permissions` — omit to treat `permissions` as informational
   *  only (caller pre-filters `contents` itself) */
  hasPermission?: (permissions: string[], content: ContentView) => boolean;

  /** fires when the active content changes (tabs mode only) */
  onContentChange?: (content: ContentView | undefined, contents: ContentView[]) => void;

  /** seed a previously-saved pane-size distribution for a `resizable` layout — the counterpart
   *  to `GridParameter.initialColumnState`. Only the ROOT mount reads this; nested
   *  `<contents-view>` levels restore from `localStorage` instead (they can't carry a callback).
   *  A stored `localStorage` value, when present and shape-compatible, wins over this. */
  initialSizes?: ContentsSizes;
  /** fires (drag end / arrow-key nudge / `setSizes` / `resetSizes`, never the initial seed)
   *  with the new pane-size distribution — the counterpart to `GridParameter.onColumnStateChange`.
   *  Wire your own persistence here if the built-in `localStorage` (`persistSizes`) isn't enough.
   *  Root mount only. */
  onSizesChange?: (sizes: ContentsSizes) => void;
}

/**
 * Runtime handle for a mounted contents-view — the counterpart to `GridInstance`/
 * `FormInstance` (`data-grid/grid-engine.service.ts`, `generic-form/form-engine.service.ts`).
 * `ContentsViewComponent` builds and emits one via `(instanceChange)`, mirroring those
 * two components' existing pattern. Since `ContentView.contents` nests recursively and
 * each nesting level mounts its own `<contents-view>`, each mount emits its OWN
 * instance, scoped to itself — `activeContent`/`activeSlug`/`selectContent` all operate
 * on THIS mount's own direct children, not the whole tree (a nested mount's tab state
 * is independent of its ancestors').
 */
export interface ContentsViewInstance {
  /** live, flattened list of every ContentView reachable from THIS mount's `contents`
   *  (including nested, regardless of whether a descendant is actually mounted as tabs
   *  are switched — a pure structural walk of the input, not runtime DOM state) */
  readonly contents: ContentView[];
  /** the currently active content among this mount's own top-level siblings, if shown in tabs */
  activeContent(): ContentView | undefined;
  activeSlug(): string | undefined;
  /** activates the content with this slug, among this mount's own top-level siblings;
   *  no-op if not found or not eligible (hidden/disabled) */
  selectContent(slug: string): void;

  /** THIS mount's current pane-size distribution as fraction arrays (`resizable` layouts only;
   *  an axis is empty when it has no gutter). Mirrors `GridInstance.columnState`. */
  sizes(): ContentsSizes;
  /** overwrite the distribution — each axis array is applied only if its length matches the
   *  current column / row count, otherwise ignored. Persists and fires `onSizesChange`.
   *  Mirrors `GridInstance.setColumnWidth`. */
  setSizes(sizes: ContentsSizes): void;
  /** restore an equal split on both axes. Persists and fires `onSizesChange`.
   *  Mirrors `GridInstance.resetColumnState`. */
  resetSizes(): void;

  /** keys of THIS mount's collapsed contents (`collapsible` layouts) — each content's `slug`, or
   *  `#<index>` for one without a slug */
  collapsed(): string[];
  /** collapse (`true`) or restore (`false`) the content with this key (see `collapsed`).
   *  Collapsing the last expanded pane is ignored while `keepOneExpanded` is on (the default). */
  setCollapsed(slug: string, collapsed: boolean): void;
  /** key of THIS mount's content currently in browser full screen (`fullscreenable` layouts),
   *  if any */
  fullscreenSlug(): string | undefined;
  /** leave full screen, if one of THIS mount's contents is in it. (Entering needs a user
   *  gesture, so it has no programmatic counterpart — use the pane's own button.) */
  exitFullscreen(): void;
}
