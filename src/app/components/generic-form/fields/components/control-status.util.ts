import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { map, merge, of, startWith, switchMap } from 'rxjs';

export interface ControlStatus {
  value: unknown;
  valid: boolean;
  invalid: boolean;
  touched: boolean;
  dirty: boolean;
  disabled: boolean;
  errors: ValidationErrors | null;
}

function snapshot(control: AbstractControl | undefined): ControlStatus {
  return {
    value: control?.value,
    valid: control?.valid ?? true,
    invalid: control?.invalid ?? false,
    touched: control?.touched ?? false,
    dirty: control?.dirty ?? false,
    disabled: control?.disabled ?? false,
    errors: control?.errors ?? null,
  };
}

/**
 * Reactive snapshot of an AbstractControl's status/errors/touched/dirty, for OnPush templates.
 * The engine mutates controls imperatively (SPEC-driven validity toggles, attachment upload
 * errors, cross-validators) outside of any user event on the consuming component, so OnPush
 * needs an explicit signal bridge rather than reading `control.valid` etc. directly.
 *
 * Call as a field initializer (has an injection context there, like the rest of this codebase's
 * `toObservable`/`toSignal` usage): `protected readonly status = controlStatus(this.control);`
 *
 * Deliberately does NOT read `control()` synchronously here for the initial value (e.g. via
 * `snapshot(control())`) — `control` is typically a `computed()` over `input.required()`s, which
 * throws (NG0950) if read during construction, before Angular has set the inputs. `toObservable`
 * defers its own first read to the component's first change-detection pass, by which point the
 * inputs are set — a plain, input-independent placeholder is enough to satisfy `toSignal`.
 */
export function controlStatus(control: Signal<AbstractControl | undefined>): Signal<ControlStatus> {
  return toSignal(
    toObservable(control).pipe(
      switchMap((c) =>
        c ? merge(c.valueChanges, c.statusChanges).pipe(startWith(null), map(() => snapshot(c))) : of(snapshot(c)),
      ),
    ),
    { initialValue: snapshot(undefined) },
  );
}
