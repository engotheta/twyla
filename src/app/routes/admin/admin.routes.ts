import { findFirstAccessibleRoute, matchRoute, TypedRoutes } from '@layout';

const placeholder = () => import('../shared/placeholder.page').then((m) => m.PlaceholderPage);

/**
 * The Administration module — `app.routes.ts` limits it to the `admin` permission. Shows a
 * detail route matched with `matchRoute` and a `settings` group whose path is a URL segment.
 */
export const ADMIN_ROUTES: TypedRoutes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => findFirstAccessibleRoute(ADMIN_ROUTES) ?? 'users',
  },
  {
    path: 'users',
    data: { isMenu: true, name: 'Users', icon: 'group', badge: 3 },
    loadComponent: () => import('./users.page').then((m) => m.UsersPage),
  },
  {
    // users/2 — not a menu entry; the page header's trail puts it under Users
    matcher: (url) => matchRoute(url, 'users', 'userId'),
    data: { name: 'User details' },
    loadComponent: placeholder,
  },
  {
    path: 'roles',
    data: { isMenu: true, name: 'Roles & permissions', icon: 'admin_panel_settings' },
    loadComponent: placeholder,
  },
  {
    path: 'settings',
    data: { isMenu: true, name: 'Settings', icon: 'settings' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'general' },
      { path: 'general', data: { isMenu: true, name: 'General' }, loadComponent: placeholder },
      {
        path: 'notifications',
        data: { isMenu: true, name: 'Notifications' },
        loadComponent: placeholder,
      },
      {
        path: 'audit-log',
        data: { isMenu: true, name: 'Audit log', label: { value: 'Beta', tone: 'warning' } },
        loadComponent: placeholder,
      },
    ],
  },
];

export default ADMIN_ROUTES;
