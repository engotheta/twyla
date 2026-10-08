import { defer, from, isObservable, Observable } from 'rxjs';
import {
  FormState,
  Option,
  OptionsPage,
  OptionsParameter,
  OptionsRequest,
  OptionsResult,
} from '../../interfaces/form-state.interface';

/** `OptionsParameter.pageSize`, where none is given */
export const DEFAULT_OPTIONS_PAGE_SIZE = 25;
/** `OptionsParameter.searchDebounce`, where none is given */
export const DEFAULT_SEARCH_DEBOUNCE = 300;

/**
 * Normalizes what a source function answers with (a value, a Promise or an Observable) into an
 * Observable. The function runs when that is subscribed to, so one that throws fails the
 * Observable instead of the caller.
 */
export function resolveOptionsSource<R>(fn: () => R | Promise<R> | Observable<R>): Observable<R> {
  return defer(() => {
    const result = fn();
    return isObservable(result) ? result : from(Promise.resolve(result));
  });
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

/** What `optionsFunction` is asked for: `page` of the options matching `search`. */
export function optionsRequest(
  params: Pick<OptionsParameter, 'pageSize' | 'filters'>,
  formState: FormState,
  search = '',
  page = 1,
): OptionsRequest {
  return {
    search,
    page,
    size: params.pageSize ?? DEFAULT_OPTIONS_PAGE_SIZE,
    filters: params.filters ?? {},
    formState,
  };
}

/** A source's answer as a page: a bare array is a page that says nothing of what follows. */
export function toOptionsPage<T>(result: OptionsResult<T> | null | undefined): OptionsPage<T> {
  if (Array.isArray(result)) return { content: result };
  return { ...result, content: result?.content ?? [] };
}

/**
 * Whether a paginated source has more after `page`: what the page says (`hasMore`, else
 * `totalLength` against the `loaded` count), else whether it came back full.
 */
export function hasMoreOptions(page: OptionsPage, loaded: number, size: number): boolean {
  if (page.hasMore !== undefined) return page.hasMore;
  if (page.totalLength !== undefined) return loaded < page.totalLength;
  return page.content.length > 0 && page.content.length >= size;
}

/** `more` after `options`, without those whose value `options` already holds. */
export function mergeOptions<V>(
  options: Option<V>[],
  more: Option<V>[],
  same: (a: V, b: V) => boolean = Object.is,
): Option<V>[] {
  const fresh = more.filter((option) => !options.some((held) => same(held.value, option.value)));
  return fresh.length ? [...options, ...fresh] : options;
}
