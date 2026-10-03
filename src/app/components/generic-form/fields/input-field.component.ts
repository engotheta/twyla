import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormInstance } from '../form-engine.service';
import { InputType } from '../interfaces/field-type.interface';
import { InputField } from '../interfaces/control-fields.interface';
import { controlStatus } from '../helpers/control-status.helpers';
import { firstErrorMessage } from '../helpers/field-errors.helpers';

const HTML_TYPE: Record<InputType, string> = {
  text: 'text',
  integer: 'number',
  decimal: 'number',
  email: 'email',
  password: 'password',
  url: 'url',
  search: 'search',
};

@Component({
  selector: 'input-field',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();

    <mat-form-field
      [appearance]="appearance()"
      class="w-full"
      [class.hide-subscript]="!showSubscript()"
    >
      @if (f.showLabel !== false && f.label) {
        <mat-label>{{ f.label }}</mat-label>
      }

      <input
        matInput
        [type]="htmlType()"
        [formControl]="control()"
        [placeholder]="f.placeholder ?? ''"
        [readonly]="f.readonly === true"
        [required]="required()"
        [attr.maxlength]="f.maxLength ?? null"
        [attr.autocomplete]="f.autocomplete ?? null"
        [attr.min]="f.min ?? null"
        [attr.max]="f.max ?? null"
        [attr.step]="stepValue()"
        [matTooltip]="f.tooltip ?? ''"
        [matTooltipDisabled]="!f.tooltip"
        [class]="f.inputClass ?? ''"
      />

      @if (f.icon) {
        <mat-icon matPrefix aria-hidden="true">{{ f.icon }}</mat-icon>
      }
      @if (f.suffixIcon) {
        <mat-icon matSuffix aria-hidden="true">{{ f.suffixIcon }}</mat-icon>
      }
      @if (revealable()) {
        <!-- one fixed name plus aria-pressed, so screen readers hear the state, not a new label -->
        <button
          matSuffix
          mat-icon-button
          type="button"
          aria-label="Show password"
          [attr.aria-pressed]="revealed()"
          (click)="toggleReveal()"
        >
          <mat-icon aria-hidden="true">{{ revealed() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
      }
      @if (f.showClear && status().value) {
        <button
          matSuffix
          mat-icon-button
          type="button"
          [attr.aria-label]="'Clear ' + (f.label ?? 'value')"
          (click)="clear()"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      }

      @if (f.hint && !errorMessage()) {
        <mat-hint>{{ f.hint }}</mat-hint>
      }
      @if (errorMessage(); as message) {
        <mat-error>{{ message }}</mat-error>
      }
    </mat-form-field>
  `,
})
export class InputFieldComponent {
  readonly field = input.required<InputField>();
  readonly instance = input.required<FormInstance>();

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
  protected readonly control = computed(() => this.instance().control(this.field()) as FormControl);
  protected readonly status = controlStatus(this.control);

  protected readonly appearance = computed(
    () => this.state().appearance ?? this.instance().params().appearance ?? 'outline',
  );
  protected readonly showSubscript = computed(
    () => this.state().showSubscript ?? this.instance().params().showSubscript ?? true,
  );

  /** a password the user chose to show — rendered as plain text until toggled back */
  protected readonly revealed = signal(false);
  protected readonly revealable = computed(
    () => this.state().inputType === 'password' && this.state().revealable !== false,
  );

  protected readonly htmlType = computed(() =>
    this.revealable() && this.revealed() ? 'text' : HTML_TYPE[this.state().inputType ?? 'text'],
  );

  protected readonly stepValue = computed(() => {
    const f = this.state();
    if (f.step !== undefined) return f.step;
    if (f.inputType === 'decimal') return 'any';
    if (f.inputType === 'integer') return 1;
    return null;
  });

  protected readonly required = computed(
    () =>
      this.state().showRequiredMarker !== false &&
      !!this.state().validations?.some((v) => v.name === 'required'),
  );

  protected readonly errorMessage = computed(() =>
    this.status().touched
      ? firstErrorMessage(this.status().errors, this.state().validations)
      : null,
  );

  protected clear(): void {
    this.control().setValue(null);
    this.control().markAsDirty();
  }

  protected toggleReveal(): void {
    this.revealed.update((revealed) => !revealed);
  }
}
