import { ChangeDetectionStrategy, Component, computed, effect, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { merge } from 'rxjs';
import { FormInstance } from '../form-engine.service';
import { DateField } from '../interfaces/control-fields.interface';
import { controlStatus } from '../helpers/control-status.helpers';
import { firstErrorMessage } from '../helpers/field-errors.helpers';

@Component({
  selector: 'date-field',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  // self-contained: doesn't require the host app to configure a global DateAdapter
  providers: [provideNativeDateAdapter()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();

    @switch (f.dateType ?? 'date') {
      @case ('time') {
        <mat-form-field [appearance]="appearance()" class="w-full" [class.hide-subscript]="!showSubscript()">
          @if (f.showLabel !== false && f.label) {
            <mat-label>{{ f.label }}</mat-label>
          }
          <input
            matInput
            type="time"
            [formControl]="control()"
            [readonly]="f.readonly === true"
            [required]="required()"
            [matTooltip]="f.tooltip ?? ''"
            [matTooltipDisabled]="!f.tooltip"
          />
          @if (f.hint && !errorMessage()) {
            <mat-hint>{{ f.hint }}</mat-hint>
          }
          @if (errorMessage(); as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>
      }
      @case ('dateTime') {
        <div class="flex gap-2">
          <mat-form-field [appearance]="appearance()" class="flex-1" [class.hide-subscript]="!showSubscript()">
            @if (f.showLabel !== false && f.label) {
              <mat-label>{{ f.label }}</mat-label>
            }
            <input
              matInput
              [matDatepicker]="dtPicker"
              [formControl]="datePartControl"
              [min]="f.minDate ?? null"
              [max]="f.maxDate ?? null"
              [matDatepickerFilter]="f.dateFilter ?? null"
              [readonly]="f.readonly === true"
              [required]="required()"
            />
            <mat-datepicker-toggle matIconSuffix [for]="dtPicker" />
            <mat-datepicker #dtPicker />
            @if (errorMessage(); as message) {
              <mat-error>{{ message }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field [appearance]="appearance()" class="w-32" [class.hide-subscript]="!showSubscript()">
            <mat-label>Time</mat-label>
            <input matInput type="time" [formControl]="timePartControl" [readonly]="f.readonly === true" />
          </mat-form-field>
        </div>
        @if (f.hint) {
          <div class="text-xs text-black/60">{{ f.hint }}</div>
        }
      }
      @default {
        <mat-form-field [appearance]="appearance()" class="w-full" [class.hide-subscript]="!showSubscript()">
          @if (f.showLabel !== false && f.label) {
            <mat-label>{{ f.label }}</mat-label>
          }
          <input
            matInput
            [matDatepicker]="picker"
            [formControl]="control()"
            [min]="f.minDate ?? null"
            [max]="f.maxDate ?? null"
            [matDatepickerFilter]="f.dateFilter ?? null"
            [readonly]="f.readonly === true"
            [required]="required()"
            [matTooltip]="f.tooltip ?? ''"
            [matTooltipDisabled]="!f.tooltip"
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker
            #picker
            [startView]="f.dateType === 'year' || f.dateType === 'monthYear' ? 'multi-year' : 'month'"
            (yearSelected)="onYearSelected($event, picker)"
            (monthSelected)="onMonthSelected($event, picker)"
          />
          @if (f.hint && !errorMessage()) {
            <mat-hint>{{ f.hint }}</mat-hint>
          }
          @if (errorMessage(); as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>
      }
    }
  `,
})
export class DateFieldComponent {
  readonly field = input.required<DateField>();
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

  protected readonly required = computed(
    () =>
      this.state().showRequiredMarker !== false &&
      !!this.state().validations?.some((v) => v.name === 'required'),
  );

  protected readonly errorMessage = computed(() =>
    this.status().touched ? firstErrorMessage(this.status().errors, this.state().validations) : null,
  );

  // 'dateTime': the real control holds one combined Date; these two local controls are the
  // split date/time UI, kept in sync with it (never registered on the form themselves)
  protected readonly datePartControl = new FormControl<Date | null>(null);
  protected readonly timePartControl = new FormControl<string | null>(null);
  private syncingParts = false;

  constructor() {
    effect(() => {
      const value = this.status().value as Date | string | null;
      if (this.syncingParts) return;
      const date = value ? new Date(value) : null;
      this.datePartControl.setValue(date, { emitEvent: false });
      this.timePartControl.setValue(date && !Number.isNaN(date.getTime()) ? this.toTimeString(date) : null, {
        emitEvent: false,
      });
    });

    merge(this.datePartControl.valueChanges, this.timePartControl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.combineParts());
  }

  protected onYearSelected(year: Date, picker: MatDatepicker<Date>): void {
    if (this.state().dateType !== 'year') return; // 'monthYear' auto-transitions to month view
    this.control().setValue(year);
    this.control().markAsDirty();
    picker.close();
  }

  protected onMonthSelected(month: Date, picker: MatDatepicker<Date>): void {
    if (this.state().dateType !== 'monthYear') return;
    this.control().setValue(month);
    this.control().markAsDirty();
    picker.close();
  }

  private combineParts(): void {
    const date = this.datePartControl.value;
    if (!date) {
      this.syncingParts = true;
      this.control().setValue(null);
      this.control().markAsDirty();
      this.syncingParts = false;
      return;
    }
    const combined = new Date(date);
    const time = this.timePartControl.value;
    if (time) {
      const [h, m] = time.split(':').map(Number);
      combined.setHours(h, m, 0, 0);
    }
    this.syncingParts = true;
    this.control().setValue(combined);
    this.control().markAsDirty();
    this.syncingParts = false;
  }

  private toTimeString(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
