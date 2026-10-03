import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  reflectComponentType,
  Type,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ViewDialogData } from './view.interface';

/** The input a hosted component declares to learn that IT is the dialog's content — the shell
 *  binds its own `MatDialogRef` there (see `GenericFormComponent`'s Cancel / close-on-submit). */
export const DIALOG_REF_INPUT = 'dialogRef';

function acceptsDialogRef(component: Type<unknown>): boolean {
  const inputs = reflectComponentType(component)?.inputs ?? [];
  return inputs.some((input) => input.templateName === DIALOG_REF_INPUT);
}

/**
 * The shell `ViewService.open()` puts every component in: a title bar (icon, title, close button)
 * over a scrolling `mat-dialog-content` hosting `data.component` with `data.inputs` bound. Hosted
 * components stay plain embeddable components that never read `MAT_DIALOG_DATA` themselves — so
 * a component merely nested somewhere inside a dialog can't mistake itself for the dialog's root
 * (the ambient-DI trap the old dual-mode details/field-group/form components fell into).
 */
@Component({
  selector: 'view-dialog',
  imports: [NgComponentOutlet, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    @if (data.title || data.showClose) {
      <div class="flex items-center gap-1 pe-2">
        @if (data.title) {
          <h2 mat-dialog-title class="grow">
            <span class="inline-flex items-center gap-2">
              @if (data.icon) {
                <mat-icon aria-hidden="true">{{ data.icon }}</mat-icon>
              }
              <span>{{ data.title }}</span>
            </span>
          </h2>
        }
        @if (data.showClose) {
          <button
            mat-icon-button
            mat-dialog-close
            type="button"
            class="ms-auto shrink-0"
            aria-label="Close dialog"
          >
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        }
      </div>
    }

    <mat-dialog-content>
      <ng-container *ngComponentOutlet="data.component; inputs: inputs" />
    </mat-dialog-content>
  `,
  // the hosted component is a full page UI, not a dialog's short "supporting text": keep the
  // page's own text color — Material's lighter default drops secondary text (e.g. the details
  // labels' `opacity-60`) below WCAG AA contrast
  styles: `
    :host {
      --mat-dialog-supporting-text-color: var(--mat-sys-on-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewDialogComponent {
  protected readonly data = inject<ViewDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ViewDialogComponent>);

  /** `data.inputs`, plus this dialog's ref when the hosted component declares a `dialogRef` input */
  protected readonly inputs: Record<string, unknown> = acceptsDialogRef(this.data.component)
    ? { ...this.data.inputs, [DIALOG_REF_INPUT]: this.dialogRef }
    : this.data.inputs;
}
