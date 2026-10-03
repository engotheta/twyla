import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DetailsComponent } from '../../../components/details/details.component';
import { PageHeaderComponent } from '../../../layout/page-header';
import { detailsParameter } from '../../../put-together/details';
import { DemoLogComponent } from '../../shared/demo-log.component';

@Component({
  selector: 'details-page',
  imports: [PageHeaderComponent, DetailsComponent, DemoLogComponent],
  template: `
    <page-header subtitle="Grouped read-only fields, formatted by type" />
    <demo-log />
    <all-details [params]="params" />
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsPage {
  protected readonly params = detailsParameter;
}
