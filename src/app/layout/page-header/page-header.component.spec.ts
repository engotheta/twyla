import { Location } from '@angular/common';
import { ANIMATION_MODULE_TYPE, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { matchRoute } from '../menu/menu.helpers';
import { MenuService } from '../menu/menu.service';
import { PageHeaderComponent } from './page-header.component';
import { PageHeaderToggle } from './page-header.interface';

@Component({
  imports: [PageHeaderComponent],
  template: `<page-header subtitle="All the people" />`,
})
class ListPage {}

@Component({
  imports: [PageHeaderComponent],
  template: `
    <page-header
      title="Tasks"
      goBackUrl="/admin/users"
      [showBackBtn]="true"
      [nav]="['Work', { label: 'Board', route: '/admin/users' }, 'Tasks']"
      [toggleButtons]="views"
      value="list"
      (toggleValue)="picked = $event"
    />
  `,
})
class CustomPage {
  views: PageHeaderToggle[] = [
    { label: 'List', value: 'list' },
    { label: 'Board', value: 'board' },
  ];
  picked: unknown;
}

@Component({
  imports: [PageHeaderComponent],
  template: `<page-header [showBackBtn]="true" />`,
})
class BackPage {}

describe('PageHeaderComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'admin',
            title: 'Administration',
            data: { isMenu: true },
            children: [
              { path: 'users', data: { name: 'Users' }, component: ListPage },
              {
                matcher: (url) => matchRoute(url, 'users', 'userId'),
                data: { name: 'User details' },
                component: ListPage,
              },
              { path: 'custom', component: CustomPage },
              { path: 'back', data: { name: 'Back test' }, component: BackPage },
            ],
          },
        ]),
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    TestBed.inject(MenuService).setFromRoutes(
      [{ path: 'users', data: { isMenu: true, name: 'Users' } }],
      'admin',
    );
  });

  /** each crumb's label (its link or text — not the chevron after it) */
  const crumbs = (root: Element) =>
    Array.from(root.querySelectorAll('nav[aria-label="Breadcrumb"] li')).map((li) =>
      li.querySelector('a, span')?.textContent?.trim(),
    );

  it('titles the page from its route and trails it from the menu', async () => {
    const harness = await RouterTestingHarness.create('/admin/users');
    const root = harness.routeNativeElement!;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Users');
    expect(root.textContent).toContain('All the people');
    expect(crumbs(root)).toEqual(['Administration', 'Users']);
    expect(root.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Users');
  });

  it('puts a detail page under its list', async () => {
    const harness = await RouterTestingHarness.create('/admin/users/42');
    const root = harness.routeNativeElement!;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('User details');
    expect(crumbs(root)).toEqual(['Administration', 'Users', 'User details']);
    expect(root.querySelector('nav a[href="/admin/users"]')).toBeTruthy();
  });

  it('takes an explicit trail, a Back button and toggles', async () => {
    const harness = await RouterTestingHarness.create('/admin/custom');
    const root = harness.routeNativeElement!;
    expect(crumbs(root)).toEqual(['Work', 'Board', 'Tasks']);

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    root.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.click();
    expect(navigate).toHaveBeenCalledWith('/admin/users');

    const group = root.querySelector('mat-button-toggle-group')!;
    expect(group.getAttribute('aria-label')).toBe('View');
    group.querySelectorAll<HTMLButtonElement>('button')[1].click();
    harness.detectChanges();
    expect((harness.routeDebugElement!.componentInstance as CustomPage).picked).toBe('board');
  });

  it('Back goes back through in-app history, or up when the page was opened directly', async () => {
    const harness = await RouterTestingHarness.create('/admin/back');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const back = vi.spyOn(TestBed.inject(Location), 'back').mockImplementation(() => undefined);

    // opened directly: nowhere in-app to go back to, so home
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!
      .click();
    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenLastCalledWith('/modules');

    await harness.navigateByUrl('/admin/users');
    await harness.navigateByUrl('/admin/back');
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!
      .click();
    expect(back).toHaveBeenCalled();
  });
});
