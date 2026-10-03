import type { TypedRoutes } from './layout/menu/menu.interface';
import { authGuard, permissionGuard } from './services/session/session.guards';

/**
 * The app's routes, GASCO style. Top-level `isMenu` routes are the **modules** — the module rail
 * and the Modules page list them; each loads a shell (`*.module.ts`) that renders the app layout
 * and puts the module's own `*.routes.ts` in the side menu.
 */
export const APP_ROUTES: TypedRoutes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'auth', loadChildren: () => import('./routes/auth/auth.routes') },
  {
    path: 'home',
    title: 'Welcome',
    loadComponent: () =>
      import('./layout/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./routes/home.page').then((m) => m.HomePage),
      },
    ],
  },
  {
    path: 'modules',
    title: 'Modules',
    canActivate: [authGuard],
    loadComponent: () => import('./routes/modules.page').then((m) => m.ModulesPage),
  },

  // ── modules ──
  {
    path: 'components',
    title: 'Components',
    canActivate: [authGuard, permissionGuard],
    canActivateChild: [authGuard],
    data: {
      isMenu: true,
      icon: 'widgets',
      description: 'The studio demos: grids, forms, viewers and more.',
    },
    loadComponent: () =>
      import('./routes/components-demo/components-demo.module').then((m) => m.ComponentsDemoShell),
    loadChildren: () => import('./routes/components-demo/components-demo.routes'),
  },
  {
    path: 'layout',
    title: 'Layout',
    canActivate: [authGuard, permissionGuard],
    canActivateChild: [authGuard],
    data: {
      isMenu: true,
      icon: 'space_dashboard',
      description: 'Page headers and menus nested to any depth.',
    },
    loadComponent: () =>
      import('./routes/layout-demo/layout-demo.module').then((m) => m.LayoutDemoShell),
    loadChildren: () => import('./routes/layout-demo/layout-demo.routes'),
  },
  {
    path: 'admin',
    title: 'Administration',
    canActivate: [authGuard, permissionGuard],
    canActivateChild: [authGuard],
    data: {
      isMenu: true,
      icon: 'admin_panel_settings',
      description: 'Users, roles and settings — admins only.',
      permissions: ['admin'],
    },
    loadComponent: () => import('./routes/admin/admin.module').then((m) => m.AdminShell),
    loadChildren: () => import('./routes/admin/admin.routes'),
  },
  {
    // not a module of its own (no isMenu): reached from the user menu
    path: 'account',
    title: 'Account',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    data: { icon: 'person' },
    loadComponent: () => import('./routes/account/account.module').then((m) => m.AccountShell),
    loadChildren: () => import('./routes/account/account.routes'),
  },

  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./routes/not-found.page').then((m) => m.NotFoundPage),
  },
];
