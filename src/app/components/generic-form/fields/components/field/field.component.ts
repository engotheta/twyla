import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormInstance } from '../../../form-engine.service';
import {
  FormField,
  isAttachmentField,
  isBooleanField,
  isButtonField,
  isColorField,
  isContentField,
  isDateField,
  isInputField,
  isLabelField,
  isObjectField,
  isSelectField,
  isTextareaField,
} from '../../../form-field.interface';
import { joinClasses } from '../class.util';
import { AttachmentFieldComponent } from '../attachment-field/attachment-field.component';
import { BooleanFieldComponent } from '../boolean-field/boolean-field.component';
import { ButtonFieldComponent } from '../button-field/button-field.component';
import { ColorFieldComponent } from '../color-field/color-field.component';
import { ContentFieldComponent } from '../content-field/content-field.component';
import { DateFieldComponent } from '../date-field/date-field.component';
import { InputFieldComponent } from '../input-field/input-field.component';
import { LabelFieldComponent } from '../label-field/label-field.component';
import { ObjectFieldComponent } from '../object-field/object-field.component';
import { SelectFieldComponent } from '../select-field/select-field.component';
import { TextareaFieldComponent } from '../textarea-field/textarea-field.component';

/** context handed to the `#childTpl` outlet — see the comment on FieldComponent below */
export interface FieldChildContext {
  $implicit: FormField;
  fieldsClass?: string;
}

// ─────────────────────────────────────────────
// The dispatcher: one type guard per leaf/container component (README "rules of engagement").
// Owns the common wrapper chrome (SPEC §6 visibility, class, opacity); each leaf/container
// component owns everything about how ITS OWN control renders.
//
// ObjectFieldComponent needs to recurse back into `app-field` for its children, which would
// make this file and object-field.component.ts import each other — a circular standalone-
// component reference that fails at runtime with NG0919 (see field-group.component.ts's own
// note on this exact trap). Fixed the same shape of way: this component hands ObjectField a
// TemplateRef (`#childTpl`, self-referencing `app-field` — safe, self-import isn't circular)
// instead of ObjectFieldComponent importing FieldComponent directly.
// ─────────────────────────────────────────────

@Component({
  selector: 'app-field',
  imports: [
    FieldComponent,
    ObjectFieldComponent,
    InputFieldComponent,
    BooleanFieldComponent,
    SelectFieldComponent,
    TextareaFieldComponent,
    DateFieldComponent,
    ColorFieldComponent,
    AttachmentFieldComponent,
    ButtonFieldComponent,
    ContentFieldComponent,
    LabelFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    @let resolved = state();

    <div [hidden]="resolved.visible === false" [class]="wrapperClass()" [style.opacity]="resolved.opacity ?? null">
      @if (isObjectField(f)) {
        <app-object-field [field]="f" [instance]="instance()" [fieldTemplate]="childTpl" />
      } @else if (isSelectField(f)) {
        <app-select-field [field]="f" [instance]="instance()" />
      } @else if (isButtonField(f)) {
        <app-button-field [field]="f" [instance]="instance()" />
      } @else if (isContentField(f)) {
        <app-content-field [field]="f" [instance]="instance()" />
      } @else if (isLabelField(f)) {
        <app-label-field [field]="f" [instance]="instance()" />
      } @else if (isInputField(f)) {
        <app-input-field [field]="f" [instance]="instance()" />
      } @else if (isBooleanField(f)) {
        <app-boolean-field [field]="f" [instance]="instance()" />
      } @else if (isTextareaField(f)) {
        <app-textarea-field [field]="f" [instance]="instance()" />
      } @else if (isDateField(f)) {
        <app-date-field [field]="f" [instance]="instance()" />
      } @else if (isColorField(f)) {
        <app-color-field [field]="f" [instance]="instance()" />
      } @else if (isAttachmentField(f)) {
        <app-attachment-field [field]="f" [instance]="instance()" />
      }
    </div>

    <ng-template #childTpl let-child let-fieldsClass="fieldsClass">
      <app-field [field]="child" [instance]="instance()" [fieldsClass]="fieldsClass" />
    </ng-template>
  `,
})
export class FieldComponent {
  readonly field = input.required<FormField>();
  readonly instance = input.required<FormInstance>();
  /** the parent container's `fieldsClass` — applied to EACH descendant's own wrapper, as
   *  opposed to `fieldsContainerClass`, which the parent applies once to its own wrapper */
  readonly fieldsClass = input<string>();

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
  protected readonly wrapperClass = computed(() => joinClasses(this.fieldsClass(), this.state().class));

  protected readonly isObjectField = isObjectField;
  protected readonly isSelectField = isSelectField;
  protected readonly isButtonField = isButtonField;
  protected readonly isContentField = isContentField;
  protected readonly isLabelField = isLabelField;
  protected readonly isInputField = isInputField;
  protected readonly isBooleanField = isBooleanField;
  protected readonly isTextareaField = isTextareaField;
  protected readonly isDateField = isDateField;
  protected readonly isColorField = isColorField;
  protected readonly isAttachmentField = isAttachmentField;
}
