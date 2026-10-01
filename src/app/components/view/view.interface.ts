import { Type } from '@angular/core';
import { MatDialogConfig } from '@angular/material/dialog';
import { Observable } from 'rxjs';

/** `ViewService.open()` / `openModal()` options — every `MatDialogConfig` option except `data` (the
 *  dialog shell owns it), plus what the shell renders around the hosted component. */
export interface ViewDialogConfig extends Omit<MatDialogConfig, 'data'> {
  /** set on the hosted component as inputs — signal `input()`s included, e.g. `{ params }` */
  inputs?: Record<string, unknown>;
  /** title-bar text; defaults to `inputs.params.title` when that's a string (e.g. `FormParameter.title`) */
  title?: string;
  /** title-bar icon; defaults to `inputs.params.icon` when that's a string */
  icon?: string;
  /** default true — an X button in the title bar */
  showClose?: boolean;
  /** the dialog closes on this stream's first emission */
  closeAction$?: Observable<unknown>;
}

/** `ViewService.openDialog()` — opens `component` itself as the dialog, handing it `data` via
 *  `MAT_DIALOG_DATA`. For dialog-native components that render their own `mat-dialog-title` /
 *  `-content` / `-actions` (the confirm dialog, the grid's export and search panels). */
export interface DialogProps<D = unknown> extends MatDialogConfig<D> {
  component: Type<unknown>;
  /** the dialog closes on this stream's first emission */
  closeAction$?: Observable<unknown>;
}

/** What `ViewDialogComponent` (the shell) receives as `MAT_DIALOG_DATA`. */
export interface ViewDialogData {
  component: Type<unknown>;
  inputs: Record<string, unknown>;
  title?: string;
  icon?: string;
  showClose: boolean;
}

/** One action of `ViewService.onMultipleEvent` — runs when the number of events in a quick run
 *  lands closest to its `threshold` (and has reached it). */
export interface ClickAction<T = unknown> {
  /** events needed; default 1 */
  threshold?: number;
  callback?: (data?: T) => unknown;
  /** handed to `callback` instead of the event's own input */
  callbackInput?: T;
  /** transforms the input before `callback` runs — e.g. fetches the full record for a row */
  queryMapFunction?: (data?: T) => T | Promise<T>;
  /** asks for confirmation (with this message) before running */
  confirmMessage?: string;
  /** asks for confirmation before running, with the confirm dialog's default message */
  confirmFirst?: boolean;
  slug?: string;
}

/** `ClickAction` shorthand: `[callback, threshold?, callbackInput?]` */
export type ClickActionTuple<T = unknown> = [
  callback: (data?: T) => unknown,
  threshold?: number,
  callbackInput?: T,
];
