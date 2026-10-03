import { findFirstAccessibleRoute, TypedRoutes } from '@layout';

/**
 * The Components module — the studio's demos. Every `isMenu` route is a side-menu entry; a
 * `path: ''` route with children is a menu group that adds nothing to the URL.
 */
export const COMPONENTS_DEMO_ROUTES: TypedRoutes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => findFirstAccessibleRoute(COMPONENTS_DEMO_ROUTES) ?? 'data-grid',
  },
  {
    path: '',
    data: { isMenu: true, name: 'Data', icon: 'table_chart' },
    children: [
      {
        path: 'data-grid',
        data: { isMenu: true, name: 'Data grid', fullHeight: true },
        loadComponent: () => import('./data-grid/data-grid.page').then((m) => m.DataGridPage),
      },
      {
        path: 'data-grid-server',
        data: { isMenu: true, name: 'Server-side grid', fullHeight: true },
        loadComponent: () =>
          import('./data-grid/data-grid-server.page').then((m) => m.DataGridServerPage),
      },
      {
        path: 'details',
        data: { isMenu: true, name: 'Details' },
        loadComponent: () => import('./details/details.page').then((m) => m.DetailsPage),
      },
    ],
  },
  {
    path: '',
    data: { isMenu: true, name: 'Forms & actions', icon: 'edit_note' },
    children: [
      {
        path: 'form',
        data: { isMenu: true, name: 'Generic form' },
        loadComponent: () => import('./form/form.page').then((m) => m.FormPage),
      },
      {
        path: 'buttons',
        data: { isMenu: true, name: 'Action buttons' },
        loadComponent: () => import('./buttons/buttons.page').then((m) => m.ButtonsPage),
      },
    ],
  },
  {
    path: 'contents',
    data: { isMenu: true, name: 'Contents view', icon: 'dashboard', fullHeight: true },
    loadComponent: () => import('./contents/contents.page').then((m) => m.ContentsPage),
  },
  {
    path: 'file-viewer',
    data: { isMenu: true, name: 'File viewer', icon: 'preview', fullHeight: true },
    loadComponent: () => import('./file-viewer/file-viewer.page').then((m) => m.FileViewerPage),
  },
  {
    path: 'fetch',
    data: { isMenu: true, name: 'Fetch & toasts', icon: 'sync_alt', fullHeight: true },
    loadComponent: () => import('./fetch/fetch.page').then((m) => m.FetchPage),
  },
];

export default COMPONENTS_DEMO_ROUTES;
