import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GenericFormComponent } from '@components/generic-form';
import { PageHeaderComponent } from '@layout/page-header';
import { formResult, FormResultsComponent } from './form-results.component';
import { getFormParameter } from './form.demo';

@Component({
  selector: 'form-page',
  imports: [PageHeaderComponent, GenericFormComponent, FormResultsComponent],
  template: `
    <page-header
      subtitle="Config-driven fields, dynamic props, lists, steps and cross-field rules"
    />
    <div class="rounded-xl bg-white p-4 ring-1 ring-gray-200 sm:p-6">
      <generic-form [params]="params" />
    </div>
    <form-results />
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormPage {
  protected readonly params = getFormParameter();

  constructor() {
    // a result left from an earlier visit belongs to a form that no longer exists
    formResult.set(null);
  }
}
