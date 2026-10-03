import { isObservable, Observable, of } from 'rxjs';

/** A value given as is, as an observable of it, or as a function of some data returning either. */
export type DynamicValue<T, D = any> = T | Observable<T> | ((data: D) => T | Observable<T>);

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
