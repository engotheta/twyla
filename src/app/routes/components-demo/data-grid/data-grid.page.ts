import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataGridComponent } from '@components/data-grid';
import { PageHeaderComponent } from '@layout/page-header';
import { gridParameter } from './data-grid.demo';
import { DemoLogComponent } from '../../shared/demo-log.component';

@Component({
  selector: 'data-grid-page',
  imports: [PageHeaderComponent, DataGridComponent, DemoLogComponent],
  template: `
    <page-header subtitle="Local rows — sorting, filters, grouping, inline editing and export" />
    <demo-log />
    <div class="min-h-0 flex-1">
      <data-grid [params]="params" />
    </div>
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridPage {
  protected readonly params = gridParameter;
}
