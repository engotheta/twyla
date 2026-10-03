import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppLayoutComponent, MenuService } from '../../layout';
import { ADMIN_ROUTES } from './admin.routes';

/** The Administration module's shell: its routes become the side menu. */
@Component({
  selector: 'admin-shell',
  imports: [AppLayoutComponent],
  template: `<app-layout />`,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  constructor() {
    inject(MenuService).setFromRoutes(ADMIN_ROUTES, 'admin');
  }
}
