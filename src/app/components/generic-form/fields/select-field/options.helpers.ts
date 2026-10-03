import { from, isObservable, Observable } from 'rxjs';
import { Option, OptionsParameter } from '../../interfaces/form-state.interface';

/** normalizes an `optionsFunction` result (sync/Promise/Observable) into an Observable */
export function resolveOptionsSource<T>(
  fn: () => T[] | Promise<T[]> | Observable<T[]>,
): Observable<T[]> {
  const result = fn();
  return isObservable(result) ? result : from(Promise.resolve(result));
}

/**
 * Maps a raw data array into `Option[]` per `OptionsParameter` — `sortBy` (on the raw item)
 * runs first, then each item becomes an option via `mapper` or `labelKey`/`valueKey`.
 */
export function mapRawOptions<T = unknown, V = unknown>(
  raw: T[],
  params: OptionsParameter<T, V>,
): Option<V>[] {
  let items = raw;
  if (params.sortBy) {
    const key = params.sortBy;
    const dir = params.sortDirection === 'DESC' ? -1 : 1;
    items = [...raw].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av === bv) return 0;
      return ((av as never) > (bv as never) ? 1 : -1) * dir;
    });
  }

  return items.map((item) => {
    if (typeof params.mapper === 'function') return params.mapper(item);
    const rec = item as Record<string, unknown>;
    if (params.mapper) {
      return { label: String(rec[params.mapper.label]), value: rec[params.mapper.value] as V };
    }
    const labelKey = params.labelKey ?? 'label';
    const valueKey = params.valueKey ?? 'value';
    return { label: String(rec[labelKey]), value: rec[valueKey] as V };
  });
}
