import { ANIMATION_MODULE_TYPE, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppSidebarComponent } from './app-sidebar.component';
import { provideLayoutConfig } from '../layout-config.token';
import { TypedRoutes } from '../menu/menu.interface';
import { MenuService } from '../menu/menu.service';

@Component({ template: '' })
class PageComponent {}

const MODULE_ROUTES: TypedRoutes = [
  { path: 'overview', data: { isMenu: true, name: 'Overview', icon: 'dashboard' } },
  {
    path: '',
    data: { isMenu: true, name: 'Reports', icon: 'report' },
    children: [
      { path: 'daily', data: { isMenu: true, name: 'Daily' } },
      {
        path: 'archive',
        data: { isMenu: true, name: 'Archive' },
        children: [{ path: 'old', data: { isMenu: true, name: 'Old reports', badge: 4 } }],
      },
    ],
  },
  { path: 'audit', data: { isMenu: true, name: 'Audit', permissions: ['admin'] } },
];

describe('AppSidebarComponent', () => {
  let fixture: ComponentFixture<AppSidebarComponent>;
  const granted = signal<string[]>([]);

  const all = (selector: string) =>
    Array.from(fixture.nativeElement.querySelectorAll(selector)) as HTMLElement[];
  const groupButton = (name: string) =>
    all('button[aria-expanded]').find((button) => button.textContent?.includes(name))!;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    granted.set([]);
    TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [
        provideRouter([
          {
            path: 'reports',
            title: 'Reporting',
            data: { isMenu: true, icon: 'report' },
            children: [
              { path: 'overview', component: PageComponent },
              { path: 'daily', component: PageComponent },
              { path: 'archive/old', component: PageComponent },
            ],
          },
        ]),
        provideLayoutConfig({
          canAccess: ({ permissions }) =>
            !permissions?.length ||
            permissions.some((permission) => granted().includes(permission)),
        }),
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    TestBed.inject(MenuService).setFromRoutes(MODULE_ROUTES, 'reports');
    fixture = TestBed.createComponent(AppSidebarComponent);
    await settle();
  });

  it('names its navigation after the module and shows the module card', () => {
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('Reporting menu');
    expect(fixture.nativeElement.textContent).toContain('Reporting');
  });

  it('renders groups as disclosure buttons that open and close their list', async () => {
    const reports = groupButton('Reports');
    expect(reports.getAttribute('aria-expanded')).toBe('false');
    const list = fixture.nativeElement.querySelector(`#${reports.getAttribute('aria-controls')}`);
    expect(list).toBeTruthy();
    expect(list.closest('[inert]')).toBeTruthy();

    reports.click();
    await settle();
    expect(reports.getAttribute('aria-expanded')).toBe('true');
    expect(list.closest('[inert]')).toBeNull();

    reports.click();
    await settle();
    expect(reports.getAttribute('aria-expanded')).toBe('false');
  });

  it('nests to any depth, with links resolved under the module', () => {
    const links = all('a[href]').map((link) => link.getAttribute('href'));
    expect(links).toEqual([
      '/modules', // the brand: LayoutConfig.homeUrl
      '/reports/overview',
      '/reports/daily',
      '/reports/archive/old',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Old reports');
  });

  it('opens the branch leading to the current page, which is marked aria-current', async () => {
    await TestBed.inject(Router).navigateByUrl('/reports/archive/old');
    await settle();
    expect(groupButton('Reports').getAttribute('aria-expanded')).toBe('true');
    expect(groupButton('Archive').getAttribute('aria-expanded')).toBe('true');
    const current = fixture.nativeElement.querySelector('[aria-current="page"]') as HTMLElement;
    expect(current.textContent).toContain('Old reports');
  });

  it('only shows what the user may open', async () => {
    expect(fixture.nativeElement.textContent).not.toContain('Audit');
    granted.set(['admin']);
    await settle();
    expect(fixture.nativeElement.textContent).toContain('Audit');
  });

  // ── the line beside a nested list ──

  /** the row (link or group button) named `name`, and the pieces of line drawn for it */
  const lineOf = (name: string) => {
    const row = all('sidebar-menu sidebar-menu li > a, sidebar-menu sidebar-menu li > button').find(
      (el) => el.querySelector('.truncate')?.textContent?.trim() === name,
    )!;
    const lit = (el: Element | null | undefined) =>
      el ? el.classList.contains('border-primary') : undefined;
    const node = row.querySelector(':scope > .menu-node')!;
    return {
      rail: lit(row.parentElement!.querySelector(':scope > .menu-rail')), // undefined: no rail
      branch: lit(row.querySelector(':scope > .menu-branch')),
      node: lit(node),
      filled: node.classList.contains('bg-primary'),
    };
  };
  const stemOf = (group: string) => groupButton(group).querySelector(':scope > .menu-stem');

  it('draws each nested item a branch and a node, and a rail for all but the last', () => {
    expect(all('.menu-branch').length).toBe(3); // Daily, Archive, Old reports
    expect(all('.menu-node').length).toBe(3);
    expect(all('.menu-rail').length).toBe(1); // Daily's: the line ends at Archive, the last child
    expect(all('[class*="menu-"][aria-hidden="true"]').length).toBe(7);
    // the top level has no line: its rows carry an icon instead
    expect(all('nav > div > sidebar-menu > ul > li > a > .menu-branch').length).toBe(0);
    expect(all('nav > div > sidebar-menu > ul > li > a > menu-icon').length).toBe(1); // Overview
    // nothing is lit before the current page is one of them
    expect(all('.menu-rail.border-primary, .menu-branch.border-primary').length).toBe(0);
  });

  it('lights the line from the top as far as the current page', async () => {
    await TestBed.inject(Router).navigateByUrl('/reports/daily');
    await settle();

    expect(lineOf('Daily')).toEqual({ rail: false, branch: true, node: true, filled: true });
    // past the current page the line carries on, unlit
    expect(lineOf('Archive')).toEqual({ rail: undefined, branch: false, node: false, filled: false });
    // …and it starts at the group, whose own icon takes the colour
    expect(stemOf('Reports')!.classList).toContain('border-primary');
    expect(groupButton('Reports').querySelector('menu-icon')!.classList).toContain('text-primary');
  });

  it('lights it through every group the current page is under', async () => {
    await TestBed.inject(Router).navigateByUrl('/reports/archive/old');
    await settle();

    // Daily comes before the group on the way: the line runs past it, lit, and its branch stays out
    expect(lineOf('Daily')).toEqual({ rail: true, branch: false, node: false, filled: false });
    // the group on the way: a lit branch to a hollow node
    expect(lineOf('Archive')).toEqual({ rail: undefined, branch: true, node: true, filled: false });
    expect(stemOf('Archive')!.classList).toContain('border-primary');
    // the page itself: a filled one
    expect(lineOf('Old reports')).toEqual({
      rail: undefined,
      branch: true,
      node: true,
      filled: true,
    });
  });

  it('lights nothing when the current page is not in a nested list', async () => {
    await TestBed.inject(Router).navigateByUrl('/reports/overview');
    await settle();
    expect(all('[class*="menu-"].border-primary').length).toBe(0);
    expect(groupButton('Reports').querySelector('menu-icon')!.classList).not.toContain(
      'text-primary',
    );
  });

  it('keeps the start-edge bar for the top level, where there is no line to light', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/reports/overview');
    await settle();
    const top = fixture.nativeElement.querySelector('[aria-current="page"]') as HTMLElement;
    expect(top.className).toContain('before:bg-primary');

    await router.navigateByUrl('/reports/daily');
    await settle();
    const nested = fixture.nativeElement.querySelector('[aria-current="page"]') as HTMLElement;
    expect(nested.className).toContain('bg-primary/10!');
    expect(nested.className).not.toContain('before:bg-primary');
  });
});
