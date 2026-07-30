import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormInstance } from '../../../form-engine.service';
import { BooleanField } from '../../control.fields';
import { controlStatus } from '../control-status.util';
import { firstErrorMessage } from '../field-errors.util';

@Component({
  selector: 'app-boolean-field',
  imports: [ReactiveFormsModule, MatCheckboxModule, MatSlideToggleModule, MatRadioModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();

    <div
      class="inline-flex flex-col gap-1"
      [matTooltip]="f.tooltip ?? ''"
      [matTooltipDisabled]="!f.tooltip"
    >
      @switch (f.type) {
        @case ('checkbox') {
          <mat-checkbox [formControl]="control()" [class]="f.class ?? ''">
            {{ f.showLabel !== false ? f.label : '' }}
          </mat-checkbox>
        }
        @case ('toggle') {
          <mat-slide-toggle [formControl]="control()" [class]="f.class ?? ''">
            {{ f.showLabel !== false ? f.label : '' }}
          </mat-slide-toggle>
        }
        @case ('radio') {
          <!-- standalone radio (not a select) — represents its own boolean choice, per SPEC -->
          <mat-radio-button
            [checked]="control().value === true"
            [disabled]="status().disabled"
            [class]="f.class ?? ''"
            (change)="selectRadio()"
          >
            {{ f.showLabel !== false ? f.label : '' }}
          </mat-radio-button>
        }
      }

      @if (errorMessage(); as message) {
        <span class="text-xs text-red-600">{{ message }}</span>
      }
    </div>
  `,
})
export class BooleanFieldComponent {
  readonly field = input.required<BooleanField>();
  readonly instance = input.required<FormInstance>();

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
  protected readonly control = computed(() => this.instance().control(this.field()) as FormControl);
  protected readonly status = controlStatus(this.control);

  protected readonly errorMessage = computed(() =>
    this.status().touched ? firstErrorMessage(this.status().errors, this.state().validations) : null,
  );

  protected selectRadio(): void {
    this.control().setValue(true);
    this.control().markAsDirty();
  }
}
