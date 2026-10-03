import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ContentsViewComponent } from '../../../components/contents-view';
import { PageHeaderComponent } from '../../../layout/page-header';
import { getContentsParameter } from '../../../put-together/contents';
import { DemoLogComponent } from '../../shared/demo-log.component';

@Component({
  selector: 'contents-page',
  imports: [PageHeaderComponent, ContentsViewComponent, DemoLogComponent],
  template: `
    <page-header subtitle="Tables, details, forms and components composed into one view" />
    <demo-log />
    <div class="min-h-0 flex-1">
      <contents-view [params]="params" />
    </div>
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentsPage {
  protected readonly params = getContentsParameter();
}
