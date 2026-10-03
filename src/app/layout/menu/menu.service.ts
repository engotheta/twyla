import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { LAYOUT_CONFIG } from '../layout-config.token';
import { filterMenu, joinRoute, menuFromRoutes, menuTrail, resolveMenu } from './menu.helpers';
import { Menu, MenuNode, TypedRoute } from './menu.interface';

/**
 * The menus, GASCO style: the top-level `isMenu` routes are the modules, and each module's shell
 * puts its own routes in the side menu — `setFromRoutes(COMPONENTS_DEMO_ROUTES, 'components')`.
 * Everything is a signal, filtered through `LayoutConfig.canAccess`, so menus follow the user.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly router = inject(Router);
  private readonly config = inject(LAYOUT_CONFIG);

  private readonly source = signal<{ menu: Menu[]; prefix: string }>({ menu: [], prefix: '' });

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** every module — the router's own top-level `isMenu` routes (no import of the route config) */
  private readonly allModules = computed(() =>
    resolveMenu(menuFromRoutes(this.router.config, false)),
  );

  /** the modules this user may open: the module rail and the Modules page */
  readonly modules = computed(() => filterMenu(this.allModules(), this.config.canAccess));

  /** the module whose menu is showing (GASCO `module_`) */
  readonly module = computed<MenuNode | undefined>(() => {
    const link = joinRoute(this.source().prefix);
    return link === '/' ? undefined : this.allModules().find((module) => module.link === link);
  });

  /** the current module's side menu: absolute links, filtered for the user */
  readonly menu = computed(() => {
    const { menu, prefix } = this.source();
    return filterMenu(resolveMenu(menu, prefix), this.config.canAccess);
  });

  /** the side-menu path to the current page, root first — breadcrumbs, the sidebar's open branch */
  readonly trail = computed(() => menuTrail(this.menu(), this.url()));

  /** Replaces the side menu; `prefix` is the module path its routes are relative to. */
  set(menu: Menu[], prefix = ''): void {
    this.source.set({ menu, prefix });
  }

  /** The `isMenu` routes of a module's `*.routes.ts` as its side menu. */
  setFromRoutes(routes: readonly TypedRoute[], prefix = ''): void {
    this.set(menuFromRoutes(routes), prefix);
  }

  add(item: Menu): void {
    this.source.update(({ menu, prefix }) => ({ menu: [...menu, item], prefix }));
  }

  reset(): void {
    this.source.set({ menu: [], prefix: '' });
  }
}
