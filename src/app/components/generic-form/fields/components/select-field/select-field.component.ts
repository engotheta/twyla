import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map, of, switchMap } from 'rxjs';
import { FormInstance } from '../../../form-engine.service';
import { Option } from '../../../interfaces/form-state.interface';
import { SelectField } from '../../control.fields';
import { controlStatus } from '../control-status.util';
import { firstErrorMessage } from '../field-errors.util';
import { mapRawOptions, resolveOptionsSource } from './options.util';

function defaultCompare(a: unknown, b: unknown): boolean {
  return a === b;
}

@Component({
  selector: 'app-select-field',
  imports: [
    ReactiveFormsModule,
    ScrollingModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    MatButtonToggleModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();
    @let opts = resolvedOptions();

    @switch (f.variant ?? 'dropdown') {
      @case ('dropdown') {
        <mat-form-field
          [appearance]="appearance()"
          class="w-full"
          [class.hide-subscript]="!showSubscript()"
        >
          @if (f.showLabel !== false && f.label) {
            <mat-label>{{ f.label }}</mat-label>
          }
          <mat-select
            [formControl]="control()"
            [multiple]="f.multiple === true"
            [compareWith]="f.compareWith ?? defaultCompare"
            [required]="required()"
            (openedChange)="onOpenedChange($event)"
          >
            @if (f.searchable) {
              <div class="sticky top-0 z-10 bg-white p-2" (keydown)="$event.stopPropagation()">
                <input
                  #searchInput
                  type="text"
                  class="w-full rounded border border-black/20 px-2 py-1 text-sm"
                  placeholder="Search…"
                  aria-label="Search options"
                  [value]="search()"
                  (input)="onSearchInput($event)"
                />
              </div>
            }
            @if (f.virtualScroll) {
              <cdk-virtual-scroll-viewport [itemSize]="42" [style.height.px]="viewportHeight()">
                <mat-option
                  *cdkVirtualFor="let opt of filteredOptions()"
                  [value]="opt.value"
                  [disabled]="opt.disabled"
                >
                  {{ opt.label }}
                </mat-option>
              </cdk-virtual-scroll-viewport>
            } @else {
              @for (opt of filteredOptions(); track opt.value) {
                <mat-option [value]="opt.value" [disabled]="opt.disabled">{{
                  opt.label
                }}</mat-option>
              }
            }
          </mat-select>
          @if (f.hint && !errorMessage()) {
            <mat-hint>{{ f.hint }}</mat-hint>
          }
          @if (errorMessage(); as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>
      }
      @case ('radio') {
        <div
          class="flex flex-col gap-1"
          [matTooltip]="f.tooltip ?? ''"
          [matTooltipDisabled]="!f.tooltip"
        >
          @if (f.showLabel !== false && f.label) {
            <span class="text-sm font-medium">{{ f.label }}</span>
          }
          <mat-radio-group [formControl]="control()">
            @for (opt of opts; track opt.value) {
              <mat-radio-button [value]="opt.value" [disabled]="opt.disabled">{{
                opt.label
              }}</mat-radio-button>
            }
          </mat-radio-group>
          @if (errorMessage(); as message) {
            <span class="text-xs text-red-600">{{ message }}</span>
          }
        </div>
      }
      @case ('checkbox') {
        <div
          class="flex flex-col gap-1"
          [matTooltip]="f.tooltip ?? ''"
          [matTooltipDisabled]="!f.tooltip"
        >
          @if (f.showLabel !== false && f.label) {
            <span class="text-sm font-medium">{{ f.label }}</span>
          }
          @for (opt of opts; track opt.value) {
            <mat-checkbox
              [checked]="isChecked(opt.value)"
              [disabled]="opt.disabled || status().disabled"
              (change)="toggleValue(opt.value)"
            >
              {{ opt.label }}
            </mat-checkbox>
          }
          @if (errorMessage(); as message) {
            <span class="text-xs text-red-600">{{ message }}</span>
          }
        </div>
      }
      @default {
        <!-- 'toggle' | 'button' -->
        <div
          class="flex flex-col gap-1"
          [matTooltip]="f.tooltip ?? ''"
          [matTooltipDisabled]="!f.tooltip"
        >
          @if (f.showLabel !== false && f.label) {
            <span class="text-sm font-medium">{{ f.label }}</span>
          }
          <mat-button-toggle-group [formControl]="control()" [multiple]="f.multiple === true">
            @for (opt of opts; track opt.value) {
              <mat-button-toggle [value]="opt.value" [disabled]="opt.disabled">{{
                opt.label
              }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
          @if (errorMessage(); as message) {
            <span class="text-xs text-red-600">{{ message }}</span>
          }
        </div>
      }
    }
  `,
})
export class SelectFieldComponent {
  readonly field = input.required<SelectField>();
  readonly instance = input.required<FormInstance>();

  protected readonly defaultCompare = defaultCompare;

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
  protected readonly control = computed(() => this.instance().control(this.field()) as FormControl);
  protected readonly status = controlStatus(this.control);

  protected readonly appearance = computed(
    () => this.state().appearance ?? this.instance().params.appearance ?? 'outline',
  );
  protected readonly showSubscript = computed(
    () => this.state().showSubscript ?? this.instance().params.showSubscript ?? true,
  );

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

  // `optionsParameter.optionsFunction`: an async raw-data source, mapped via labelKey/valueKey/
  // mapper + sortBy (SPEC: this is orthogonal to Dynamic `options` — it's a mapping layer over a
  // fetched list, resolved once per `optionsParameter` change, not per keystroke/value change).
  private readonly optionsParameter$ = toObservable(computed(() => this.state().optionsParameter));
  private readonly mappedOptions = toSignal(
    this.optionsParameter$.pipe(
      switchMap((params) => {
        if (!params?.optionsFunction) return of([] as Option<unknown>[]);
        const fn = params.optionsFunction;
        return resolveOptionsSource(() => fn(this.instance().formState().value)).pipe(
          map((raw) => mapRawOptions(raw, params)),
        );
      }),
    ),
    { initialValue: [] as Option<unknown>[] },
  );

  protected readonly resolvedOptions = computed<Option<unknown>[]>(() => {
    const f = this.state();
    const base = f.optionsParameter?.optionsFunction
      ? this.mappedOptions()
      : Array.isArray(f.options)
        ? f.options
        : [];
    return f.hasNoneOption ? [{ label: 'None', value: null }, ...base] : base;
  });

  protected readonly search = signal('');
  protected readonly filteredOptions = computed(() => {
    const query = this.search().trim().toLowerCase();
    const opts = this.resolvedOptions();
    return query ? opts.filter((o) => o.label.toLowerCase().includes(query)) : opts;
  });

  protected readonly viewportHeight = computed(() =>
    Math.min(this.filteredOptions().length * 42, 256),
  );

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected onOpenedChange(opened: boolean): void {
    if (opened) {
      queueMicrotask(() => this.searchInput()?.nativeElement.focus());
    } else {
      this.search.set('');
    }
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected isChecked(value: unknown): boolean {
    const current = this.status().value;
    const eq = this.state().compareWith ?? defaultCompare;
    return Array.isArray(current) ? current.some((v) => eq(v, value)) : false;
  }

  protected toggleValue(value: unknown): void {
    const eq = this.state().compareWith ?? defaultCompare;
    const current = Array.isArray(this.status().value)
      ? [...(this.status().value as unknown[])]
      : [];
    const index = current.findIndex((v) => eq(v, value));
    if (index === -1) current.push(value);
    else current.splice(index, 1);
    this.control().setValue(current);
    this.control().markAsDirty();
  }
}
