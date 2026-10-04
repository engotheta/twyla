import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DetailsComponent } from '@components/details';
import { PageHeaderComponent } from '@layout/page-header';
import { detailsParameter, tabbedDetailsParameter } from './details.demo';
import { DemoLogComponent } from '../../shared/demo-log.component';

@Component({
  selector: 'details-page',
  imports: [PageHeaderComponent, DetailsComponent, DemoLogComponent],
  template: `
    <page-header subtitle="Grouped read-only fields, formatted by type" />
    <demo-log />
    <all-details [params]="params" />

    <p class="mt-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
      The same record, its groups in tabs
    </p>
    <all-details [params]="tabbed" />
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsPage {
  protected readonly params = detailsParameter;
  protected readonly tabbed = tabbedDetailsParameter;
}
