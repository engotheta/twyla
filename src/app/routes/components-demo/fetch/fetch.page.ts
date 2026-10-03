import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@layout/page-header';
import { FetchDemoComponent } from './fetch-demo.component';

@Component({
  selector: 'fetch-page',
  imports: [PageHeaderComponent, FetchDemoComponent],
  template: `
    <page-header subtitle="FetchService, loading overlays and toasts against dummyjson.com" />
    <fetch-demo class="block min-h-0 flex-1" />
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FetchPage {}
