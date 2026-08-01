import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, switchMap } from 'rxjs';
import { FieldType } from '../../../interfaces/field-type.interface';
import { FormInstance } from '../../../form-engine.service';
import { ButtonField } from '../../static.fields';

@Component({
  selector: 'app-button-field',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();

    <button
      type="button"
      mat-flat-button
      [color]="f.color ?? 'primary'"
      [disabled]="isSaving()"
      [matTooltip]="f.tooltip ?? ''"
      [matTooltipDisabled]="!f.tooltip"
      [class]="f.class ?? ''"
      (click)="onClick()"
    >
      @if (isSaving()) {
        <mat-icon aria-hidden="true">hourglass_top</mat-icon>
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

  protected async onClick(): Promise<void> {
    const f = this.field();
    if (f.click) {
      await f.click(this.instance().formState().value, this.instance().formState());
      return;
    }
    if (f.type === FieldType.submit) await this.instance().submit();
  }
}
