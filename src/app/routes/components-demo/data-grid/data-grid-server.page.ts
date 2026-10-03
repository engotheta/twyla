import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataGridComponent } from '@components/data-grid';
import { PageHeaderComponent } from '@layout/page-header';
import { getGridParameterFetch } from './data-grid-server.demo';

@Component({
  selector: 'data-grid-server-page',
  imports: [PageHeaderComponent, DataGridComponent],
  template: `
    <page-header subtitle="Paging, sorting and search on the server — dummyjson.com users" />
    <div class="min-h-0 flex-1">
      <data-grid [params]="params" />
    </div>
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataGridServerPage {
  protected readonly params = getGridParameterFetch();
}
