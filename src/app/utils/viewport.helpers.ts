import { DestroyRef, effect, inject, signal, Signal, untracked } from '@angular/core';

/**
 * A read-only signal tracking whether `query` currently matches the viewport, updating
 * whenever that changes.
 *
 * jsdom / SSR-safe: when `window` or `window.matchMedia` is unavailable (the test environment
 * has no `matchMedia`; this app has no server rendering) it returns a static `signal(false)`
 * rather than throwing — callers should treat "cannot tell" as the smaller-screen answer and
 * stub `window.matchMedia` in tests that need a specific result.
 *
 * MUST be called from an injection context — it uses `inject(DestroyRef)` to detach the
 * media-query listener when the owning component/directive is destroyed.
 *
 * `query` may be a function reading signals, for a query that itself changes (a breakpoint that
 * moves with the text size): the listener then follows it from one query to the next.
 */
export function mediaQuerySignal(query: string | (() => string)): Signal<boolean> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return signal(false).asReadonly();
  }
  if (typeof query === 'function') return changingQuerySignal(query);

  const mql = window.matchMedia(query);
  const matches = signal(mql.matches);
  const onChange = (event: MediaQueryListEvent): void => matches.set(event.matches);

  mql.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', onChange));

  return matches.asReadonly();
}

function changingQuerySignal(query: () => string): Signal<boolean> {
  const matches = signal(window.matchMedia(untracked(query)).matches);

  effect((onCleanup) => {
    const mql = window.matchMedia(query());
    const onChange = (event: MediaQueryListEvent): void => matches.set(event.matches);
    matches.set(mql.matches);
    mql.addEventListener('change', onChange);
    onCleanup(() => mql.removeEventListener('change', onChange));
  });

  return matches.asReadonly();
}

/** Tailwind's `lg` breakpoint, in rem */
export const LG_UP_REM = 64;

/** `matchMedia` query for Tailwind's `lg` breakpoint (64rem) — where the default contents grid
 *  goes two-column, the `contentsFit: 'auto'` cover/flow switch happens, and the app layout's
 *  sidebar stops being an overlay drawer. */
export const LG_UP_QUERY = `(min-width: ${LG_UP_REM}rem)`;
