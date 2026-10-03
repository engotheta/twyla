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
});
