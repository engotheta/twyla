import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GenericFormComponent } from '@components/generic-form';
import { PageHeaderComponent } from '@layout/page-header';
import { applog } from '../../shared/applog';
import { DemoLogComponent } from '../../shared/demo-log.component';
import { formResult, FormResultsComponent } from './form-results.component';
import { getSelectFormParameter } from './select.demo';

@Component({
  selector: 'select-page',
  imports: [PageHeaderComponent, GenericFormComponent, DemoLogComponent, FormResultsComponent],
  template: `
    <page-header
      subtitle="Options from an API: loaded, searched, filtered, paged and fetched on a form event — dummyjson.com"
    />
    <demo-log />
    <div class="rounded-xl bg-white p-4 ring-1 ring-gray-200 sm:p-6">
      <generic-form [params]="params" />
    </div>
    <form-results />
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectPage {
  protected readonly params = getSelectFormParameter();

  constructor() {
    // what an earlier visit, or another demo, left behind is not this form's
    formResult.set(null);
    applog.set('');
  }
}
