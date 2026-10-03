import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormInstance } from '../form-engine.service';
import { TextareaField } from '../interfaces/control-fields.interface';
import { controlStatus } from '../helpers/control-status.helpers';
import { firstErrorMessage } from '../helpers/field-errors.helpers';

@Component({
  selector: 'textarea-field',
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

    @if (f.type === 'textarea') {
      <mat-form-field [appearance]="appearance()" class="w-full" [class.hide-subscript]="!showSubscript()">
        @if (f.showLabel !== false && f.label) {
          <mat-label>{{ f.label }}</mat-label>
        }
        <textarea
          matInput
          [rows]="f.rows ?? 3"
          [formControl]="control()"
          [placeholder]="f.placeholder ?? ''"
          [readonly]="f.readonly === true"
          [required]="required()"
          [attr.maxlength]="f.maxLength ?? null"
          [matTooltip]="f.tooltip ?? ''"
          [matTooltipDisabled]="!f.tooltip"
          [class]="f.inputClass ?? ''"
        ></textarea>

        @if (f.maxLength) {
          <mat-hint align="end">{{ control().value?.length ?? 0 }}/{{ f.maxLength }}</mat-hint>
        }
        @if (f.hint && !errorMessage()) {
          <mat-hint>{{ f.hint }}</mat-hint>
        }
        @if (errorMessage(); as message) {
          <mat-error>{{ message }}</mat-error>
        }
      </mat-form-field>
    } @else {
      <!-- richText: no rich-text-editor dependency is installed, so this is a lightweight
           contenteditable + execCommand fallback. Swap for a real editor lib if requirements
           grow past bold/italic/underline/lists. -->
      <div class="flex w-full flex-col gap-1">
        @if (f.showLabel !== false && f.label) {
          <label class="text-sm font-medium">{{ f.label }}</label>
        }
        <div class="flex items-center gap-1 rounded-t border border-b-0 border-black/20 p-1">
          <button
            type="button"
            mat-icon-button
            aria-label="Bold"
            (mousedown)="$event.preventDefault()"
            (click)="exec('bold')"
          >
            <mat-icon aria-hidden="true">format_bold</mat-icon>
          </button>
          <button
            type="button"
            mat-icon-button
            aria-label="Italic"
            (mousedown)="$event.preventDefault()"
            (click)="exec('italic')"
          >
            <mat-icon aria-hidden="true">format_italic</mat-icon>
          </button>
          <button
            type="button"
            mat-icon-button
            aria-label="Underline"
            (mousedown)="$event.preventDefault()"
            (click)="exec('underline')"
          >
            <mat-icon aria-hidden="true">format_underlined</mat-icon>
          </button>
          <button
            type="button"
            mat-icon-button
            aria-label="Bullet list"
            (mousedown)="$event.preventDefault()"
            (click)="exec('insertUnorderedList')"
          >
            <mat-icon aria-hidden="true">format_list_bulleted</mat-icon>
          </button>
        </div>
        <div
          #editor
          class="focus:outline-primary min-h-32 rounded-b border border-black/20 p-2 focus:outline focus:outline-2 {{
            f.inputClass ?? ''
          }}"
          contenteditable
          role="textbox"
          aria-multiline="true"
          [attr.aria-label]="f.label ?? 'Rich text'"
          [attr.aria-readonly]="f.readonly === true"
          (input)="onInput($event)"
          (blur)="control().markAsTouched()"
        ></div>
        @if (errorMessage(); as message) {
          <span class="text-xs text-red-600">{{ message }}</span>
        } @else if (f.hint) {
          <span class="text-xs text-black/60">{{ f.hint }}</span>
        }
      </div>
    }
  `,
})
export class TextareaFieldComponent {
  readonly field = input.required<TextareaField>();
  readonly instance = input.required<FormInstance>();

  private readonly editor = viewChild<ElementRef<HTMLDivElement>>('editor');

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

  constructor() {
    // richText: reflect external/programmatic value changes into the DOM, but never while the
    // user is actively editing it (that would reset the caret to the start on every keystroke)
    effect(() => {
      const value = (this.control().value as string | null) ?? '';
      const el = this.editor()?.nativeElement;
      if (!el || document.activeElement === el) return;
      if (el.innerHTML !== value) el.innerHTML = value;
    });
  }

  protected onInput(event: Event): void {
    const html = (event.target as HTMLDivElement).innerHTML;
    this.control().setValue(html);
    this.control().markAsDirty();
  }

  protected exec(command: string): void {
    const el = this.editor()?.nativeElement;
    if (!el) return;
    document.execCommand(command);
    el.focus();
    this.control().setValue(el.innerHTML);
    this.control().markAsDirty();
  }
}
