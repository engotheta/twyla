import { inject, Injectable, Type } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, Observable, take, takeUntil } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { ConfirmDialog } from './confirm-dialog/confirm-dialog.interface';
import { ViewDialogComponent } from './view-dialog.component';
import {
  ClickAction,
  ClickActionTuple,
  DialogProps,
  ViewDialogConfig,
  ViewDialogData,
} from './view.interface';

/** Quiet gap (ms) that ends a run of rapid clicks / key presses. */
export const MULTI_EVENT_WINDOW_MS = 500;

/** `autoFocus: 'dialog'` puts focus on the dialog itself, so screen readers announce its title
 *  before the user tabs into the content; `maxWidth` keeps phones from clipping a fixed `width`. */
const SHELL_DEFAULTS: MatDialogConfig = { autoFocus: 'dialog', maxWidth: '95vw' };

interface EventRun {
  count: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Opens components in dialogs, plus the multi-click helpers ported from GASCO's `ViewService`
 * (same method names and call shapes, so ported call sites keep working).
 *
 * - `open(Component, { inputs, title, ... })` — hosts ANY component in the dialog shell
 *   (`ViewDialogComponent`: title bar + scrolling content). The component needs no dialog
 *   awareness; declare a `dialogRef` input only to close the dialog from inside.
 * - `openModal(Component, params, width?, maxHeight?)` — GASCO's shape: `params` becomes the
 *   component's `params` input (`<data-grid>`, `<all-details>`, `<generic-form>`, `<contents-view>`).
 * - `openDialog({ component, data, ... })` — opens a dialog-native component (one that reads
 *   `MAT_DIALOG_DATA` and renders its own dialog sections) directly.
 *
 * Unlike GASCO it doesn't default `disableClose: true`: Esc and a backdrop click close dialogs.
 */
@Injectable({ providedIn: 'root' })
export class ViewService {
  private readonly dialog = inject(MatDialog);

  private readonly multiClickRun: EventRun & { input?: unknown } = { count: 0 };
  private readonly multiEventRun: EventRun = { count: 0 };
  private delayTimer?: ReturnType<typeof setTimeout>;

  /** Hosts `component` in the dialog shell with `config.inputs` bound. */
  open<C, R = unknown>(
    component: Type<C>,
    config: ViewDialogConfig = {},
  ): MatDialogRef<ViewDialogComponent, R> {
    const { inputs = {}, title, icon, showClose = true, closeAction$, ...dialogConfig } = config;
    const data: ViewDialogData = {
      component,
      inputs,
      title: title ?? stringProp(inputs['params'], 'title'),
      icon: icon ?? stringProp(inputs['params'], 'icon'),
      showClose,
    };

    const ref = this.dialog.open<ViewDialogComponent, ViewDialogData, R>(ViewDialogComponent, {
      ...SHELL_DEFAULTS,
      ...dialogConfig,
      // a titled dialog is labelled by its `mat-dialog-title`; an untitled one still needs a name
      ariaLabel: dialogConfig.ariaLabel ?? (data.title ? undefined : 'Dialog'),
      data,
    });

    this.closeOn(ref, closeAction$);
    return ref;
  }

  /** GASCO's call shape: `params` is bound to the component's `params` input. */
  openModal<C, R = unknown>(
    component: Type<C>,
    params?: unknown,
    width?: string,
    maxHeight?: string,
    config: ViewDialogConfig = {},
  ): MatDialogRef<ViewDialogComponent, R> {
    return this.open<C, R>(component, {
      ...config,
      width: width ?? config.width,
      maxHeight: maxHeight ?? config.maxHeight,
      inputs: params === undefined ? config.inputs : { ...config.inputs, params },
    });
  }

  /** Opens a dialog-native component directly — it receives `data` via `MAT_DIALOG_DATA`. */
  openDialog<D = unknown, R = unknown>({
    component,
    closeAction$,
    ...config
  }: DialogProps<D>): MatDialogRef<unknown, R> {
    const ref = this.dialog.open<unknown, D, R>(component, {
      maxWidth: SHELL_DEFAULTS.maxWidth,
      ...config,
    });
    this.closeOn(ref, closeAction$);
    return ref;
  }

  /** Resolves `true` only when the user confirms — Cancel, Esc and a backdrop click all mean no. */
  confirm(config: ConfirmDialog = {}): Promise<boolean> {
    const ref = this.openDialog<ConfirmDialog, boolean>({
      component: ConfirmDialogComponent,
      data: config,
    });
    return firstValueFrom(ref.afterClosed()).then((confirmed) => confirmed === true);
  }

  closeTopDialog(): void {
    this.dialog.openDialogs.at(-1)?.close();
  }

  closeAll(): void {
    this.dialog.closeAll();
  }

  /**
   * Runs `callback(input)` once `threshold` events (default 3) arrive in one quick run — each
   * within `MULTI_EVENT_WINDOW_MS` of the one before. An event for a different `input` starts a
   * new run, e.g. `onMultiClick(() => openDetails(row), 7, row.id)` from every row click.
   */
  onMultiClick<T>(callback: (input?: T) => unknown, threshold = 3, input?: T): void {
    const run = this.multiClickRun;
    clearTimeout(run.timer);
    if (run.count && !Object.is(run.input, input)) run.count = 0;
    run.input = input;

    if (++run.count < threshold) {
      run.timer = setTimeout(() => (run.count = 0), MULTI_EVENT_WINDOW_MS);
      return;
    }

    run.count = 0;
    callback(input);
  }

  /**
   * Picks one of several actions by how many events arrive in one quick run. Once the run ends
   * (`MULTI_EVENT_WINDOW_MS` of quiet), the action whose `threshold` is closest to the count runs,
   * if the count has reached it; reaching the highest threshold runs that action immediately.
   * e.g. `onMultipleEvent([{ callback: goHome, threshold: 1 }, { callback: openIcons, threshold: 7 }])`.
   */
  onMultipleEvent<T>(actions: readonly (ClickAction<T> | ClickActionTuple<T>)[], input?: T): void {
    const list = actions.map(toClickAction);
    if (!list.length) return;

    const run = this.multiEventRun;
    clearTimeout(run.timer);
    const count = ++run.count;

    const finish = (): void => {
      run.count = 0;
      const action = closestByThreshold(list, count);
      if (count >= thresholdOf(action)) void this.runClickAction(action, input);
    };

    if (count >= Math.max(...list.map(thresholdOf))) finish();
    else run.timer = setTimeout(finish, MULTI_EVENT_WINDOW_MS);
  }

  /** Debounce: runs `callback` once no further call has come in for `ms`. */
  delayedExecution(callback: () => unknown, ms = MULTI_EVENT_WINDOW_MS): void {
    clearTimeout(this.delayTimer);
    this.delayTimer = setTimeout(callback, ms);
  }

  private async runClickAction<T>(action: ClickAction<T>, input?: T): Promise<void> {
    const needsConfirm = action.confirmFirst || action.confirmMessage;
    if (needsConfirm && !(await this.confirm({ message: action.confirmMessage }))) return;

    let data = action.callbackInput ?? input;
    if (action.queryMapFunction) data = await action.queryMapFunction(data);
    action.callback?.(data);
  }

  private closeOn(ref: MatDialogRef<unknown>, closeAction$?: Observable<unknown>): void {
    closeAction$?.pipe(take(1), takeUntil(ref.afterClosed())).subscribe(() => ref.close());
  }
}

function toClickAction<T>(action: ClickAction<T> | ClickActionTuple<T>): ClickAction<T> {
  if (!Array.isArray(action)) return action;
  const [callback, threshold, callbackInput] = action;
  return { callback, threshold, callbackInput };
}

function thresholdOf(action: Pick<ClickAction, 'threshold'>): number {
  return action.threshold ?? 1;
}

/** the action whose threshold is nearest `count` — the earlier one wins a tie */
function closestByThreshold<T>(actions: ClickAction<T>[], count: number): ClickAction<T> {
  return actions.reduce((closest, action) =>
    Math.abs(thresholdOf(action) - count) < Math.abs(thresholdOf(closest) - count)
      ? action
      : closest,
  );
}

function stringProp(source: unknown, key: string): string | undefined {
  if (typeof source !== 'object' || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}
