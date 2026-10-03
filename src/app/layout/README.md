# Layout

The signed-in app frame and its menus, routed the way GASCO is: modules in `app.routes.ts`, each
module's side menu described on its own routes.

```
module rail │ sidebar (brand, module card, menu) │ header
            │                                     │ page (router outlet)
            │                                     │ footer
```

| Piece | Selector | Notes |
| --- | --- | --- |
| `AppLayoutComponent` | `app-layout` | Skip link, rail (from `lg`), sidebar (docked from `lg`, a drawer below), header, `<main>`, footer. A route with `data.fullHeight` gets a fixed-height page for content that scrolls itself. |
| `ModuleRailComponent` | `module-rail` | "All modules" plus one link per module the user may open. |
| `AppSidebarComponent` | `app-sidebar` | The current module's menu, nested to any depth. In the drawer the module card switches modules. A filter box appears from 8 pages. |
| `AppHeaderComponent` | `app-header` | Sidebar toggle, `headerActions`, full screen, notifications, user menu. A progress bar runs while a lazy page loads. |
| `AppFooterComponent` | `app-footer` | © year and owner, links, version. |
| `UserMenuComponent` | `user-menu` | Avatar or initials and the account menu. Shows "Sign in" when nobody is signed in. |
| `MenuService` | — | `modules`, `module`, `menu` and `trail`, all signals. |
| `PageTitleStrategy` | — | Document titles such as "Data grid · Studio". |

Page headers (`<page-header>`) live in `layout/page-header`, imported from `@layout/page-header`.
The public pages share `AuthLayoutComponent` (`layout/auth-layout`): the auth header, the page
and the footer in one scroll area.

## Adding a module

1. **Routes:** write `routes/<module>/<module>.routes.ts` and default-export `TypedRoutes`. Each
   `data.isMenu` route is a menu entry. A route with `children` is a group: with `path: ''` it adds
   nothing to the URL, and any group can nest further.

   ```ts
   export const REPORTS_ROUTES: TypedRoutes = [
     { path: '', pathMatch: 'full', redirectTo: () => findFirstAccessibleRoute(REPORTS_ROUTES) ?? 'daily' },
     {
       path: '',
       data: { isMenu: true, name: 'Production', icon: 'factory' },
       children: [
         { path: 'daily', data: { isMenu: true, name: 'Daily', permissions: ['VIEW_DAILY'] }, loadComponent: … },
         { path: 'monthly', data: { isMenu: true, name: 'Monthly', badge: pending$ }, loadComponent: … },
       ],
     },
     // a detail page: not in the menu, but its breadcrumb finds its list
     { matcher: (url) => matchRoute(url, 'daily', 'reportId'), data: { name: 'Report' }, loadComponent: … },
   ];
   export default REPORTS_ROUTES;
   ```

2. **Shell:** write `routes/<module>/<module>.module.ts`. It turns the routes into the side menu and
   renders the layout.

   ```ts
   @Component({ selector: 'reports-shell', imports: [AppLayoutComponent], template: `<app-layout />`, host: { class: 'block h-full' } })
   export class ReportsShell {
     constructor() { inject(MenuService).setFromRoutes(REPORTS_ROUTES, 'reports'); }
   }
   ```

3. **App routes:** add the module to `APP_ROUTES`. Its `data` puts it in the rail and on the Modules page.

   ```ts
   {
     path: 'reports', title: 'Reports',
     canActivate: [authGuard, permissionGuard], canActivateChild: [authGuard],
     data: { isMenu: true, icon: 'assessment', description: 'Daily and monthly figures', permissions: ['REPORTS_MODULE'] },
     loadComponent: () => import('./routes/reports/reports.module').then((m) => m.ReportsShell),
     loadChildren: () => import('./routes/reports/reports.routes'),
   }
   ```

A link with no route of its own, such as an external site, goes through
`menu.add({ route: 'https://…', name: 'Docs', type: 'extTabLink' })` in the shell.

## Menu entries (`data` on a route, or a `Menu`)

| Field | |
| --- | --- |
| `name` | Defaults to the route `title`, else the capitalised path. |
| `icon`, `iconType` | A Material Icons ligature, or `'svg'` for a registered `svgIcon`. Entries without an icon show their initial. |
| `route` | Relative to the parent entry; a leading `/` makes it absolute. For `extLink` and `extTabLink` it is a URL. |
| `type` | `'link'`, `'sub'`, `'extLink'` or `'extTabLink'`. Inferred when left out. |
| `permissions`, `visibleFor` | Any one permission is enough. `visibleFor` lists user types. Both are checked through `LayoutConfig.canAccess`, and groups left empty are dropped. |
| `badge` | A number or text, or an `Observable` / `Signal` of one. Zero shows muted. |
| `label` | A tag such as `{ value: 'New', tone: 'success' }`. Tones: primary, success, warning, danger, neutral. |
| `expanded` | The group starts open and stays open while its siblings toggle. |
| `description` | The line under a module on the Modules page. |
| `fullHeight` | Route only. The page fills the layout. |

Groups behave as an accordion. Opening one closes its siblings, and each navigation opens the
branch leading to the current page.

## Configuration

```ts
provideLayoutConfig(() => {
  const session = inject(SessionService);
  return {
    brand: { name: 'GASCO', tagline: '…', logo: { src: 'logo.svg', width: 32, height: 32 } },
    homeUrl: '/modules',
    user: session.user,
    canAccess: session.canAccess, // permissions + visibleFor
    signOut: () => void session.logout(),
    userMenu: [{ route: '/account/profile', name: 'Profile', icon: 'person' }],
    headerActions: [], // ActionButton[]
    notifications, onNotification, markAllRead, // the bell shows only when `notifications` is set
    footer: { owner: 'GASCO', links: [{ label: 'Help', route: '/help' }], version: '1.0.0' },
  };
});
// plus { provide: TitleStrategy, useClass: PageTitleStrategy }
```

Import the token and the strategy from their own files, not from this barrel, in `app.config.ts`.
A barrel loads every component it re-exports into the initial bundle.

## Accessibility

- **Landmarks and skip link:** the page has a skip link and landmarks: banner, the "Modules" nav,
  the "<module> menu" nav, main and contentinfo.
- **Groups:** menu groups are disclosure buttons with `aria-expanded` and `aria-controls`, and a
  closed group is `inert`.
- **Current page:** marked with `aria-current="page"`; the current module in the rail with
  `aria-current="true"`.
- **Narrow screens:** the drawer traps focus and closes on Esc, on its backdrop and on navigation.
- **Navigation announcements:** each navigation is announced politely by page title.

## Porting from GASCO / ng-matero

| Before | Now |
| --- | --- |
| `MenuService.setFromRoutes(ROUTES, 'plants-management')` in `plants.module.ts` | Same call in the module's shell. The shell renders `<app-layout />`. |
| `MenuService.modules` built by importing `APP_ROUTES` (a circular import) | `menu.modules()`, read from the router's own config. |
| `menu.getAll()` / `change()` observables | `menu.menu()` / `menu.trail()` signals. |
| `label: { color, value }` (`bg-{{color}}`, which Tailwind never generates) | `label: { value, tone }` |
| `badge` + `badgeFn` | `badge`: a value, an `Observable` or a `Signal`. |
| `isFullLink` / `appendPrefix: false` | A route starting with `/`. |
| `iconType: 'SVG'` as the default | `'material'` is the default; `iconType: 'svg'` for `svgIcon`s. |
| ngx-permissions plus a `visibleFor` filter in the sidemenu | One `LayoutConfig.canAccess`. |
| `findFirstAccessibleRoute` via the static `HasPermissionDirective` | `findFirstAccessibleRoute(ROUTES)` inside the `redirectTo` function. It now includes group paths too (`settings/groups`). |
| `matchRoute(url, slug, param)` | Unchanged. |
| Staff landing (`/staff-landing`) | `routes/modules.page.ts` (`/modules`). |
