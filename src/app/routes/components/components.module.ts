import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ROW_DETAILS_COMPONENT } from '../../components/data-grid/row-details.token';
import { DetailsComponent } from '../../components/details/details.component';
import { AppLayoutComponent, MenuService } from '../../layout';
import { COMPONENTS_ROUTES } from './components.routes';

/** The Components module's shell (GASCO `*.module.ts`): its routes become the side menu. */
@Component({
  selector: 'components-shell',
  imports: [AppLayoutComponent],
  // the grids' expandable row details — provided here, with the pages that use them, so the
  // details / grid / form code loads with this module rather than at start-up
  providers: [{ provide: ROW_DETAILS_COMPONENT, useValue: DetailsComponent }],
  template: `<app-layout />`,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComponentsShell {
  constructor() {
    inject(MenuService).setFromRoutes(COMPONENTS_ROUTES, 'components');
  }
}
