import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormInstance } from '../../form-engine.service';
import { ColorField } from '../../interfaces/control-fields.interface';
import { controlStatus } from '../../helpers/control-status.helpers';
import { firstErrorMessage } from '../../helpers/field-errors.helpers';
import { fromHex, toHex } from './color.helpers';

@Component({
  selector: 'color-field',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();

    <div class="flex items-end gap-2" [matTooltip]="f.tooltip ?? ''" [matTooltipDisabled]="!f.tooltip">
      <input
        type="color"
        class="h-10 w-12 shrink-0 cursor-pointer rounded border border-black/20 disabled:cursor-not-allowed disabled:opacity-50"
        [attr.aria-label]="(f.label ?? 'Color') + ' picker'"
        [value]="hexValue()"
        [disabled]="status().disabled"
        (input)="onPick($event)"
        (blur)="control().markAsTouched()"
      />

      <mat-form-field [appearance]="appearance()" class="w-full" [class.hide-subscript]="!showSubscript()">
        @if (f.showLabel !== false && f.label) {
          <mat-label>{{ f.label }}</mat-label>
        }
        <input
          matInput
          [formControl]="control()"
          [placeholder]="f.placeholder ?? f.colorFormat ?? 'hex'"
          [readonly]="f.readonly === true"
        />
        @if (f.hint && !errorMessage()) {
          <mat-hint>{{ f.hint }}</mat-hint>
        }
        @if (errorMessage(); as message) {
          <mat-error>{{ message }}</mat-error>
        }
      </mat-form-field>
    </div>
  `,
})
export class ColorFieldComponent {
  readonly field = input.required<ColorField>();
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

  protected readonly hexValue = computed(() =>
    toHex(this.status().value as string | null, this.state().colorFormat ?? 'hex'),
  );

  protected readonly errorMessage = computed(() =>
    this.status().touched ? firstErrorMessage(this.status().errors, this.state().validations) : null,
  );

  protected onPick(event: Event): void {
    const hex = (event.target as HTMLInputElement).value;
    this.control().setValue(fromHex(hex, this.state().colorFormat ?? 'hex'));
    this.control().markAsDirty();
  }
}
