import { Signal } from '@angular/core';
import { Route } from '@angular/router';
import { Observable } from 'rxjs';

// ─────────────────────────────────────────────
// Menus are described on the routes themselves (GASCO): every route with `data.isMenu` becomes a
// menu item — top-level routes are the modules (module rail, Modules page), each module's own
// `*.routes.ts` is its side menu. `Menu` is also accepted directly by `MenuService.set()`.
// ─────────────────────────────────────────────

export type MenuType = 'link' | 'sub' | 'extLink' | 'extTabLink';

export type MenuTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

/** a short text chip after the name — "New", "Beta" */
export interface MenuTag {
  value: string;
  /** default 'primary' */
  tone?: MenuTone;
}

/** a count or short text pill after the name; an Observable or Signal keeps it live */
export type MenuBadge =
  number | string | Observable<number | string | undefined> | Signal<number | string | undefined>;

/** what decides whether the current user sees an item (`LayoutConfig.canAccess`) */
export interface MenuAccess {
  /** any one of them is enough; none = everyone */
  permissions?: readonly string[];
  /** user types allowed (`SessionUser.type`, e.g. 'internal' / 'external'); none = everyone */
  visibleFor?: readonly string[];
}

export interface Menu extends MenuAccess {
  /**
   * Path segment(s), relative to the parent item's route — `path: ''` groups add nothing — or,
   * with a leading `/`, absolute. For `extLink` / `extTabLink`, the URL.
   */
  route: string;
  name?: string;
  /** inferred: `'sub'` when it has children, else `'link'`. `extTabLink` opens a new tab. */
  type?: MenuType;
  icon?: string;
  /** `'material'` (default): a Material Icons ligature; `'svg'`: a registered `svgIcon` name */
  iconType?: 'material' | 'svg';
  label?: MenuTag;
  badge?: MenuBadge;
  /** one line about it — under a module's name on the Modules page */
  description?: string;
  children?: Menu[];
  /** a `sub` that starts open and stays open while siblings are toggled */
  expanded?: boolean;
}

/** A menu item ready to render: absolute `link`, stable `id`, resolved `type`. */
export interface MenuNode extends Omit<Menu, 'children' | 'type' | 'name'> {
  id: string;
  name: string;
  type: MenuType;
  /** the router link (`/components/data-grid`), the URL of an external link, or the group's path */
  link: string;
  children: MenuNode[];
}

/** `data` of a GASCO-style route. */
export interface AppRouteData extends Omit<Menu, 'route' | 'children'> {
  /** list the route in the menu (a top-level route: in the module rail and on the Modules page) */
  isMenu?: boolean;
  /** overrides the route path as the menu link */
  route?: string;
  title?: string;
  subtitle?: string;
  /** the page fills the layout's height and scrolls inside itself (grids, viewers) */
  fullHeight?: boolean;
}

/** A `Route` whose `data` is typed — still assignable to Angular's `Routes`. */
export interface TypedRoute<TData = AppRouteData> extends Omit<Route, 'data' | 'children'> {
  data?: Partial<TData>;
  children?: TypedRoutes<Partial<TData>>;
}

export type TypedRoutes<TData = AppRouteData> = TypedRoute<TData>[];
