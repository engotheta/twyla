import { map, timer } from 'rxjs';
import { findFirstAccessibleRoute, TypedRoutes } from '@layout';

const placeholder = () => import('../shared/placeholder.page').then((m) => m.PlaceholderPage);

/** a live badge: an Observable (a Signal works too) */
const unreadCount$ = timer(0, 8000).pipe(map((tick) => (tick % 4) + 2));

/**
 * The Layout module: the page header's options, and "Menu levels" — groups nested four deep
 * (each group is a real path segment here), with a label tag and badges along the way.
 */
export const LAYOUT_DEMO_ROUTES: TypedRoutes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => findFirstAccessibleRoute(LAYOUT_DEMO_ROUTES) ?? 'page-header',
  },
  {
    path: 'page-header',
    data: { isMenu: true, name: 'Page header', icon: 'title' },
    loadComponent: () => import('./page-header.page').then((m) => m.PageHeaderPage),
  },
  {
    path: 'levels',
    data: { isMenu: true, name: 'Menu levels', icon: 'account_tree', badge: unreadCount$ },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'one' },
      {
        path: 'one',
        data: { isMenu: true, name: 'Level one', subtitle: 'A page one level down' },
        loadComponent: placeholder,
      },
      {
        path: 'two',
        data: { isMenu: true, name: 'Level two', label: { value: 'New', tone: 'success' } },
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            data: { isMenu: true, name: 'Level two overview' },
            loadComponent: placeholder,
          },
          {
            path: 'three',
            data: { isMenu: true, name: 'Level three' },
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'four' },
              {
                path: 'four',
                data: { isMenu: true, name: 'Level four', badge: 3 },
                loadComponent: placeholder,
              },
              {
                path: 'four-b',
                data: { isMenu: true, name: 'Another level four' },
                loadComponent: placeholder,
              },
            ],
          },
        ],
      },
    ],
  },
];

export default LAYOUT_DEMO_ROUTES;
