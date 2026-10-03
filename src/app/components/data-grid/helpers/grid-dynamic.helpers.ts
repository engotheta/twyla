import { isObservable } from 'rxjs';
import { DynamicValue } from '@components/action-buttons/action-button.interface';

/**
 * Best-effort SYNCHRONOUS resolution of a `DynamicValue`: static values and functions returning
 * a static value resolve; anything resolving to an `Observable` falls back to `undefined`.
 * Used only for `GridCell.rowspan`/`colspan`, where the row/col-span render plan must be computed
 * synchronously — an Observable-driven span isn't supported (a documented simplification).
 */
export function resolveSyncDynamic<T, D>(
  value: DynamicValue<T, D> | undefined,
  data: D,
): T | undefined {
  if (value === undefined) return undefined;
  const resolved = typeof value === 'function' ? (value as (data: D) => T | unknown)(data) : value;
  return isObservable(resolved) ? undefined : (resolved as T);
}
