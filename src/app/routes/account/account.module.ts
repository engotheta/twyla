import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppLayoutComponent, MenuService } from '../../layout';
import { ACCOUNT_ROUTES } from './account.routes';

/** The Account module's shell: its routes become the side menu. */
@Component({
  selector: 'account-shell',
  imports: [AppLayoutComponent],
  template: `<app-layout />`,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountShell {
  constructor() {
    inject(MenuService).setFromRoutes(ACCOUNT_ROUTES, 'account');
  }
}
