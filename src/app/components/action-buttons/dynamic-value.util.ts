import { isObservable, Observable, of } from 'rxjs';
import { DynamicValue } from './action-button.interface';

/** Normalizes a `DynamicValue` (static, function, or observable) into an observable stream. */
export function resolveDynamicValue$<T, D>(
  value: DynamicValue<T, D> | undefined,
  data: D,
): Observable<T | undefined> {
  if (value === undefined) return of(undefined);

  const resolved =
    typeof value === 'function' ? (value as (data: D) => T | Observable<T>)(data) : value;

  return isObservable(resolved) ? resolved : of(resolved);
}
