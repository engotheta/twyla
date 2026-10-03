import { UrlSegment } from '@angular/router';
import {
  filterMenu,
  findFirstAccessibleRoute,
  flattenMenu,
  joinRoute,
  matchRoute,
  menuFromRoutes,
  menuTrail,
  resolveMenu,
  searchMenu,
  urlPath,
} from './menu.helpers';
import { MenuAccess, TypedRoutes } from './menu.interface';

/** a trimmed copy of GASCO's plants.routes.ts shape */
const ROUTES: TypedRoutes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    data: { isMenu: true, name: 'Dashboard', icon: 'dashboard', permissions: ['VIEW_DASHBOARD'] },
  },
  { path: 'plants', data: { isMenu: true, name: 'Plants', icon: 'factory' } },
  { matcher: (url) => matchRoute(url, 'plants', 'plantUid') },
  {
    path: '',
    data: { isMenu: true, name: 'Reports', icon: 'report' },
    children: [
      { path: 'daily', data: { isMenu: true, name: 'Daily', permissions: ['VIEW_DAILY'] } },
      { path: 'weekly', data: { isMenu: true, name: 'Weekly', permissions: ['VIEW_WEEKLY'] } },
    ],
  },
  { path: 'hse-reports', data: { icon: 'document_settings' } }, // kept as a route, not in the menu
  {
    path: 'settings',
    data: { isMenu: true, name: 'Settings', icon: 'settings' },
    children: [{ path: 'groups', data: { isMenu: true, name: 'Form groups' } }],
  },
];

const allowing =
  (...granted: string[]) =>
  ({ permissions }: MenuAccess): boolean =>
    !permissions?.length || permissions.some((permission) => granted.includes(permission));

const names = (nodes: { name: string }[]) => nodes.map((node) => node.name);

describe('menu helpers', () => {
  it('menuFromRoutes keeps the isMenu routes, any depth, with their data', () => {
    const menu = menuFromRoutes(ROUTES);
    expect(names(menu as { name: string }[])).toEqual([
      'Dashboard',
      'Plants',
      'Reports',
      'Settings',
    ]);
    expect(menu[2].children?.map((item) => item.route)).toEqual(['daily', 'weekly']);
    expect(menu[0]).toMatchObject({
      route: 'dashboard',
      icon: 'dashboard',
      permissions: ['VIEW_DASHBOARD'],
    });
    expect(menu[0]).not.toHaveProperty('isMenu');
    expect(menuFromRoutes(ROUTES, false)[2].children).toEqual([]);
  });

  it('names an item by data.name, else the route title, else its path', () => {
    const menu = menuFromRoutes([
      { path: 'a', title: 'Alpha', data: { isMenu: true } },
      { path: 'beta-items', data: { isMenu: true } },
    ]);
    expect(menu.map((item) => item.name)).toEqual(['Alpha', 'Beta items']);
  });

  it('resolveMenu resolves links under the module, skipping empty group paths', () => {
    const nodes = resolveMenu(menuFromRoutes(ROUTES), 'plants-management');
    expect(nodes[0].link).toBe('/plants-management/dashboard');
    expect(nodes[2].type).toBe('sub');
    expect(nodes[2].children.map((node) => node.link)).toEqual([
      '/plants-management/daily',
      '/plants-management/weekly',
    ]);
    expect(nodes[3].children[0].link).toBe('/plants-management/settings/groups');

    const ids = flattenMenu(nodes).map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps absolute and external routes as given', () => {
    const nodes = resolveMenu(
      [
        { route: '/home', name: 'Home' },
        { route: 'https://angular.dev', name: 'Docs', type: 'extTabLink' },
      ],
      'module',
    );
    expect(nodes.map((node) => node.link)).toEqual(['/home', 'https://angular.dev']);
  });

  it('filterMenu drops what the user may not see, and groups left empty', () => {
    const nodes = resolveMenu(menuFromRoutes(ROUTES), 'p');
    const visible = filterMenu(nodes, allowing('VIEW_WEEKLY'));
    expect(names(visible)).toEqual(['Plants', 'Reports', 'Settings']);
    expect(names(visible[1].children)).toEqual(['Weekly']);

    expect(names(filterMenu(nodes, allowing()))).toEqual(['Plants', 'Settings']);
  });

  it('menuTrail finds a page with its groups; a detail URL lands on its list', () => {
    const nodes = resolveMenu(menuFromRoutes(ROUTES), 'p');
    expect(names(menuTrail(nodes, '/p/daily?tab=2#top'))).toEqual(['Reports', 'Daily']);
    expect(names(menuTrail(nodes, '/p/plants/42'))).toEqual(['Plants']);
    expect(names(menuTrail(nodes, '/p/settings/groups'))).toEqual(['Settings', 'Form groups']);
    expect(menuTrail(nodes, '/p/plantsXYZ')).toEqual([]); // whole segments only
    expect(menuTrail(nodes, '/elsewhere')).toEqual([]);
  });

  it('searchMenu keeps the matches and the groups leading to them', () => {
    const nodes = resolveMenu(menuFromRoutes(ROUTES), 'p');
    const found = searchMenu(nodes, 'WEEK');
    expect(names(found)).toEqual(['Reports']);
    expect(names(found[0].children)).toEqual(['Weekly']);
    expect(searchMenu(nodes, '  ')).toHaveLength(nodes.length);
  });

  it('findFirstAccessibleRoute returns the first page the user may open, through group paths', () => {
    expect(findFirstAccessibleRoute(ROUTES, allowing('VIEW_DASHBOARD'))).toBe('dashboard');
    expect(findFirstAccessibleRoute(ROUTES, allowing())).toBe('plants');

    const groupsOnly = ROUTES.filter((route) => route.children?.length);
    expect(findFirstAccessibleRoute(groupsOnly, allowing('VIEW_WEEKLY'))).toBe('weekly');
    expect(findFirstAccessibleRoute(groupsOnly, allowing())).toBe('settings/groups');
  });

  it('matchRoute matches slug/<value> and passes the value as the named param', () => {
    const segments = (...paths: string[]) => paths.map((path) => new UrlSegment(path, {}));
    expect(matchRoute(segments('users', '7'), 'users', 'userId')?.posParams?.['userId'].path).toBe(
      '7',
    );
    expect(matchRoute(segments('users'), 'users')).toBeNull();
    expect(matchRoute(segments('roles', '7'), 'users')).toBeNull();
  });

  it('urlPath and joinRoute normalise paths', () => {
    expect(urlPath('/a/b/?q=1#x')).toBe('/a/b');
    expect(urlPath('/a;m=1/b')).toBe('/a/b');
    expect(urlPath('/')).toBe('/');
    expect(joinRoute('components', '', '/data-grid/')).toBe('/components/data-grid');
    expect(joinRoute('')).toBe('/');
  });
});
