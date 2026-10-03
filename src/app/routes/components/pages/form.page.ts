import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GenericFormComponent } from '../../../components/generic-form';
import { PageHeaderComponent } from '../../../layout/page-header';
import { getFormParameter } from '../../../put-together/form';

@Component({
  selector: 'form-page',
  imports: [PageHeaderComponent, GenericFormComponent],
  template: `
    <page-header
      subtitle="Config-driven fields, dynamic props, lists, steps and cross-field rules"
    />
    <div class="rounded-xl bg-white p-4 ring-1 ring-gray-200 sm:p-6">
      <generic-form [params]="params" />
    </div>
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormPage {
  protected readonly params = getFormParameter();
}
