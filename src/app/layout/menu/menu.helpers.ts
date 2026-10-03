import { inject } from '@angular/core';
import { UrlMatchResult, UrlSegment } from '@angular/router';
import { LAYOUT_CONFIG } from '../layout-config.token';
import { AppRouteData, Menu, MenuAccess, MenuNode, TypedRoute } from './menu.interface';

/**
 * The `data.isMenu` routes as menu items (GASCO `getMenuFromRoutes`). The name comes from
 * `data.name`, else the route `title`, else the capitalised path; `deep` takes the `isMenu`
 * children too (any depth). Route-only data (`isMenu`, `title`, `fullHeight`, …) is left out.
 */
export function menuFromRoutes(routes: readonly TypedRoute[], deep = true): Menu[] {
  return routes
    .filter((route) => route.data?.isMenu === true)
    .map((route) => {
      const data: Partial<AppRouteData> = route.data ?? {};
      const { isMenu, title, subtitle, fullHeight, route: link, name, ...menu } = data;
      const children = deep && route.children?.length ? menuFromRoutes(route.children) : [];
      return {
        ...menu,
        route: link ?? route.path ?? '',
        name:
          name ?? (typeof route.title === 'string' ? route.title : capitalize(route.path ?? '')),
        children,
      };
    });
}

/**
 * Ready-to-render items: each route resolved against its parent's (`path: ''` groups add
 * nothing, a leading `/` is absolute), the type inferred, and a stable id assigned (it doubles as
 * the DOM id behind `aria-controls`). `prefix` is the module's path.
 */
export function resolveMenu(menu: readonly Menu[], prefix = '', parentId = 'menu'): MenuNode[] {
  return menu.map((item, index) => {
    const id = `${parentId}-${index}`;
    const type = item.type ?? (item.children?.length ? 'sub' : 'link');
    const external = type === 'extLink' || type === 'extTabLink';
    const link = external
      ? item.route
      : joinRoute(item.route.startsWith('/') ? '' : prefix, item.route);
    return {
      ...item,
      id,
      type,
      name: item.name ?? capitalize(item.route),
      link,
      children: resolveMenu(item.children ?? [], external ? prefix : link, id),
    };
  });
}

/** The items `canAccess` allows; groups left with no children are dropped. */
export function filterMenu(
  nodes: readonly MenuNode[],
  canAccess: (item: MenuAccess) => boolean,
): MenuNode[] {
  return nodes.flatMap((node) => {
    if (!canAccess(node)) return [];
    if (node.type !== 'sub') return [node];
    const children = filterMenu(node.children, canAccess);
    return children.length ? [{ ...node, children }] : [];
  });
}

/**
 * The menu path to `url`, root first: the link that matches it — exactly, or else as the longest
 * whole-segment prefix (so a detail page `/admin/users/2` lands on `/admin/users`) — with its
 * ancestors. Empty when nothing matches. Breadcrumbs and the sidebar's open branch come from it.
 */
export function menuTrail(nodes: readonly MenuNode[], url: string): MenuNode[] {
  const path = urlPath(url);
  let best: { trail: MenuNode[]; score: number } | undefined;

  const visit = (items: readonly MenuNode[], ancestors: MenuNode[]): void => {
    for (const item of items) {
      const trail = [...ancestors, item];
      if (item.type === 'link') {
        const score = matchScore(item.link, path);
        if (score > (best?.score ?? 0)) best = { trail, score };
      }
      visit(item.children, trail);
    }
  };
  visit(nodes, []);
  return best?.trail ?? [];
}

/** The items whose name contains `query` (any case) — a matching group keeps all its children,
 *  other groups only their matching descendants. */
export function searchMenu(nodes: readonly MenuNode[], query: string): MenuNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...nodes];
  return nodes.flatMap((node) => {
    if (node.name.toLowerCase().includes(needle)) return [node];
    const children = searchMenu(node.children, needle);
    return children.length ? [{ ...node, children }] : [];
  });
}

/** every node, depth first */
export function flattenMenu(nodes: readonly MenuNode[]): MenuNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenu(node.children)]);
}

/**
 * GASCO's module index redirect — `redirectTo: () => findFirstAccessibleRoute(ROUTES) ?? 'x'`:
 * the path (relative to the module, through any group paths) of the first `isMenu` page the user
 * may open. Must run in an injection context — a `redirectTo` function is one — as it reads
 * `LAYOUT_CONFIG.canAccess`, unless `canAccess` is passed.
 */
export function findFirstAccessibleRoute(
  routes: readonly TypedRoute[],
  canAccess: (item: MenuAccess) => boolean = inject(LAYOUT_CONFIG).canAccess,
  base = '',
): string | undefined {
  for (const route of routes) {
    const data = route.data ?? {};
    if (data.isMenu === true && !canAccess(data)) continue;
    const path = [base, route.path ?? ''].filter(Boolean).join('/');
    if (route.children?.length) {
      const child = findFirstAccessibleRoute(route.children, canAccess, path);
      if (child) return child;
    } else if (data.isMenu === true && route.path) {
      return path;
    }
  }
  return undefined;
}

/**
 * GASCO's detail-page matcher: matches a URL ending in `slug/<value>` and passes `<value>` as the
 * `param` route parameter — `{ matcher: (url) => matchRoute(url, 'users', 'userId'), … }`.
 */
export function matchRoute(url: UrlSegment[], slug: string, param = 'uid'): UrlMatchResult | null {
  if (url.length < 2 || url[url.length - 2].path !== slug) return null;
  return { consumed: url, posParams: { [param]: url[url.length - 1] } };
}

/** `'/' + segments`, skipping empty ones: joinRoute('components', '', 'data-grid') → '/components/data-grid' */
export function joinRoute(...parts: string[]): string {
  const segments = parts.flatMap((part) => part.split('/')).filter((segment) => segment.trim());
  return `/${segments.join('/')}`;
}

/** the path of a router URL: no query, fragment, matrix params or trailing slash */
export function urlPath(url: string): string {
  const path = url
    .split(/[?#]/)[0]
    .split('/')
    .map((segment) => segment.split(';')[0])
    .join('/');
  return path.length > 1 ? path.replace(/\/+$/, '') : path || '/';
}

function matchScore(link: string, path: string): number {
  if (link === path) return Number.MAX_SAFE_INTEGER;
  return path.startsWith(`${link}/`) ? link.length : 0;
}

function capitalize(text: string): string {
  const words = text.replace(/[-_/]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : '';
}
