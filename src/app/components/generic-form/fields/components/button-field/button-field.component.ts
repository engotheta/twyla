import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, switchMap } from 'rxjs';
import { FieldType } from '../../../interfaces/field-type.interface';
import { FormInstance } from '../../../form-engine.service';
import { ButtonField } from '../../static.fields';

@Component({
  selector: 'app-button-field',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();

    <!-- busy: disabled but still focusable (disabledInteractive), so focus isn't dropped mid-submit;
         the engine ignores a second submit while the first runs -->
    <button
      [type]="nativeSubmit() ? 'submit' : 'button'"
      mat-flat-button
      [color]="f.color ?? 'primary'"
      [disabled]="busy()"
      [disabledInteractive]="true"
      [matTooltip]="f.tooltip ?? ''"
      [matTooltipDisabled]="!f.tooltip"
      [class]="f.class ?? ''"
      (click)="onClick()"
    >
      @if (busy()) {
        <mat-progress-spinner
          class="me-2 inline-block align-middle [--mat-progress-spinner-active-indicator-color:currentColor]"
          mode="indeterminate"
          diameter="18"
          aria-hidden="true"
        />
      } @else if (f.icon) {
        <mat-icon aria-hidden="true">{{ f.icon }}</mat-icon>
      }
      {{ f.label }}
    </button>
  `,
})
export class ButtonFieldComponent {
  readonly field = input.required<ButtonField>();
  readonly instance = input.required<FormInstance>();

  protected readonly state = computed(() => this.instance().fieldState(this.field())());

  private readonly isSaving$ = toObservable(computed(() => this.field().isSaving$));
  protected readonly isSaving = toSignal(
    this.isSaving$.pipe(switchMap((subject) => subject ?? of(false))),
    { initialValue: false },
  );

  /** a plain submit button inside a `nativeForm`: the form's own submit event runs the submit */
  protected readonly nativeSubmit = computed(
    () =>
      this.field().type === FieldType.submit && !this.field().click && this.instance().nativeForm,
  );

  /** `isSaving$`, or — for a submit button — the form's own submit in progress */
  protected readonly busy = computed(
    () =>
      this.isSaving() || (this.field().type === FieldType.submit && this.instance().submitting()),
  );

  protected async onClick(): Promise<void> {
    if (this.nativeSubmit() || this.busy()) return;
    const f = this.field();
    if (f.click) {
      await f.click(this.instance().formState().value, this.instance().formState());
      return;
    }
    if (f.type === FieldType.submit) await this.instance().submit();
  }
}
