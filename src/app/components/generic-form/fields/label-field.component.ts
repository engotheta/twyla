import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormInstance } from '../form-engine.service';
import { LabelField } from '../interfaces/static-fields.interface';

@Component({
  selector: 'label-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();
    <span [class]="f.class ?? ''" [style.opacity]="f.opacity ?? null">{{ f.value }}</span>
  `,
})
export class LabelFieldComponent {
  readonly field = input.required<LabelField>();
  readonly instance = input.required<FormInstance>();

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
}
