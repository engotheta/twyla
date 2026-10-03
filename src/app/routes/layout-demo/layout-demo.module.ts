import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppLayoutComponent, MenuService } from '@layout';
import { LAYOUT_DEMO_ROUTES } from './layout-demo.routes';

/** The Layout module's shell: its routes become the side menu, plus one entry added by hand. */
@Component({
  selector: 'layout-demo-shell',
  imports: [AppLayoutComponent],
  template: `<app-layout />`,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutDemoShell {
  constructor() {
    const menu = inject(MenuService);
    menu.setFromRoutes(LAYOUT_DEMO_ROUTES, 'layout');
    // an external link has no route of its own — MenuService.add() takes a plain Menu
    menu.add({
      route: 'https://angular.dev',
      name: 'Angular docs',
      icon: 'menu_book',
      type: 'extTabLink',
    });
  }
}
