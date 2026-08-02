import { Observable } from 'rxjs';
import { TemplateRef, Type } from '@angular/core';
import { DynamicValue } from '../action-buttons/action-button.interface';
import { GridParameter } from '../data-grid';
import { DetailsParameter } from '../details/detail.interface';
import { FormParameter } from '../generic-form';

export type ContentType = 'group' | 'table' | 'details' | 'form' | 'html' | 'component';

/** Layout of a node's OWN children — shared by `ContentView` (a group node's children)
 *  and `ContentsViewParameter` (the root's children); each nesting level can lay its
 *  own children out independently. */
export interface ContentsLayout {
  /** merged with each child's own `class`, if any */
  contentsClass?: string;
  contentsContainerClass?: string;
  tabsContainerClass?: string;
  tabsOrientation?: 'horizontal' | 'vertical';
  /** default false */
  showContentsInTabs?: boolean;
  /** default true: contents fit into the available view and scroll internally;
   *  false: contents grow as needed and the whole page scrolls */
  fitContentsIntoView?: boolean;
  /** default true: an inactive tab's content (esp. a live `formParams`/`gridParams`
   *  embed) stays mounted rather than being destroyed on tab switch — set false to
   *  free resources for a rarely-revisited or expensive tab instead. Only relevant
   *  when `showContentsInTabs` is true. */
  preserveInactiveContent?: boolean;
}

interface ContentViewBase extends ContentsLayout {
  icon?: string;
  /** stable identity — used for tracking, `initialActive`/active-selection, and the
   *  payload of `onActive`/`onContentChange`/`ContentsViewInstance.selectContent` */
  slug?: string;
  label?: string;
  /** a short value/count shown as a badge on the content's tab (if shown in tabs),
   *  ahead of the label */
  badge?: string | number | Observable<string | number>;

  /** hides this content (and its tab, if shown in tabs) entirely; default true */
  visible?: DynamicValue<boolean, ContentView>;
  /** shows the tab but blocks activation; default false. No effect outside tabs mode */
  disabled?: DynamicValue<boolean, ContentView>;

  /** informational unless `ContentsViewParameter.hasPermission` is supplied — with no
   *  checker, the caller is expected to have pre-filtered `contents` already */
  permissions?: string[];

  /** styling class for this content's own container */
  class?: string;

  /** default false; whether this is the initially active content among its siblings
   *  (only meaningful when the parent renders its children as tabs). If none of a
   *  sibling group sets this, the first one is active by default. */
  initialActive?: boolean;
  /** fires when this content is activated (tabs mode only) */
  onActive?: (content: ContentView, siblings: ContentView[]) => void;

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
 * height/width; see `ContentsLayout.fitContentsIntoView` for scroll behavior.
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
export interface ContentsViewParameter extends ContentsLayout {
  contents: ContentView[];

  /** gates `ContentView.permissions` — omit to treat `permissions` as informational
   *  only (caller pre-filters `contents` itself) */
  hasPermission?: (permissions: string[], content: ContentView) => boolean;

  /** fires when the active content changes (tabs mode only) */
  onContentChange?: (content: ContentView | undefined, contents: ContentView[]) => void;
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
}
