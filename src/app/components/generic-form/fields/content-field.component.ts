import { ChangeDetectionStrategy, Component, computed, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormInstance } from '../form-engine.service';
import { ContentField } from '../interfaces/static-fields.interface';

@Component({
  selector: 'content-field',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();
    @let value = f.value;

    <div [class]="f.class ?? ''" [style.opacity]="f.opacity ?? null">
      @if (isTemplateRef(value)) {
        <ng-container [ngTemplateOutlet]="value" [ngTemplateOutletContext]="{ $implicit: contentParameter() }" />
      } @else if (isString(value)) {
        <!-- Angular sanitizes innerHTML bindings by default; this is form-config-authored
             content (a developer wrote it), not raw end-user input. -->
        <div [innerHTML]="value"></div>
      } @else if (value != null) {
        {{ value }}
      }
    </div>
  `,
})
export class ContentFieldComponent {
  readonly field = input.required<ContentField>();
  readonly instance = input.required<FormInstance>();

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
  protected readonly contentParameter = computed(
    () => this.field().contentParameter ?? this.instance().formState().value,
  );

  protected isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  protected isTemplateRef(value: unknown): value is TemplateRef<unknown> {
    return value instanceof TemplateRef;
  }
}
