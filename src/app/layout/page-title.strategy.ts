import { effect, inject, Injectable, Injector } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  TitleStrategy,
} from '@angular/router';
import { LAYOUT_CONFIG } from './layout-config.token';

/**
 * Document titles like "Data grid · Studio": the deepest route's menu `data.name`, else its
 * `title` — so GASCO-style routes, which name pages in `data`, get titles without repeating them.
 * The name goes through `LayoutConfig.translate`, and the title is written again when the
 * language changes. `{ provide: TitleStrategy, useClass: PageTitleStrategy }`.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  // read on first use: the Router creates this strategy, and an app's layout config may well
  // inject services that need the Router (a session service) — injecting it here would loop
  private readonly injector = inject(Injector);

  constructor() {
    super();
    // `translate` reads the language, which makes it this effect's dependency
    effect(() => this.updateTitle(this.injector.get(Router).routerState.snapshot));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const { brand, translate } = this.injector.get(LAYOUT_CONFIG);
    const page = pageName(snapshot.root);
    this.title.setTitle(page ? `${translate(page)} · ${brand.name}` : brand.name);
  }
}

/** the deepest route's `data.name` or `title` */
export function pageName(root: ActivatedRouteSnapshot): string | undefined {
  let name: string | undefined;
  let route: ActivatedRouteSnapshot | null = root;
  while (route) {
    const own: unknown = route.data['name'] ?? route.title;
    if (typeof own === 'string' && own) name = own;
    route = route.firstChild;
  }
  return name;
}
