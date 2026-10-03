import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideLayoutConfig } from '../layout-config.token';
import { MenuService } from './menu.service';

@Component({ template: '' })
class PageComponent {}

describe('MenuService', () => {
  const granted = signal<string[]>([]);

  beforeEach(() => {
    granted.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'components',
            title: 'Components',
            data: { isMenu: true, icon: 'widgets', description: 'Demos' },
            children: [
              { path: 'grid', component: PageComponent },
              { path: 'grid/:id', component: PageComponent },
            ],
          },
          {
            path: 'admin',
            title: 'Administration',
            data: { isMenu: true, permissions: ['admin'] },
            children: [],
          },
          { path: 'account', data: { icon: 'person' }, children: [] },
        ]),
        provideLayoutConfig({
          canAccess: ({ permissions }) =>
            !permissions?.length ||
            permissions.some((permission) => granted().includes(permission)),
        }),
      ],
    });
  });

  it('lists the modules from the router config, following what the user may open', () => {
    const menu = TestBed.inject(MenuService);
    expect(menu.modules().map((module) => [module.name, module.link])).toEqual([
      ['Components', '/components'],
    ]);
    expect(menu.modules()[0].description).toBe('Demos');

    granted.set(['admin']);
    expect(menu.modules().map((module) => module.name)).toEqual(['Components', 'Administration']);
  });

  it('setFromRoutes makes a module’s routes its side menu and names the module', () => {
    const menu = TestBed.inject(MenuService);
    menu.setFromRoutes(
      [
        { path: 'grid', data: { isMenu: true, name: 'Grid' } },
        { path: 'secret', data: { isMenu: true, name: 'Secret', permissions: ['admin'] } },
      ],
      'components',
    );
    expect(menu.menu().map((node) => node.link)).toEqual(['/components/grid']);
    expect(menu.module()?.name).toBe('Components');

    menu.add({ route: 'https://angular.dev', name: 'Docs', type: 'extTabLink' });
    expect(menu.menu().map((node) => node.name)).toEqual(['Grid', 'Docs']);

    menu.reset();
    expect(menu.menu()).toEqual([]);
    expect(menu.module()).toBeUndefined();
  });

  it('trail follows navigation, detail pages included', async () => {
    const menu = TestBed.inject(MenuService);
    menu.setFromRoutes([{ path: 'grid', data: { isMenu: true, name: 'Grid' } }], 'components');
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/components/grid');
    expect(menu.trail().map((node) => node.name)).toEqual(['Grid']);
    await router.navigateByUrl('/components/grid/42');
    expect(menu.trail().map((node) => node.name)).toEqual(['Grid']);
  });
});
