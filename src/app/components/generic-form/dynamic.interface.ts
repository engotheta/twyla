// ─────────────────────────────────────────────
// Dynamic prop system
// ─────────────────────────────────────────────

/**
 * Observes one or more control paths (top-most form scope, dot-notation for
 * nesting: 'address.street'). The callback receives the observed values in
 * path order and RETURNS the new prop value. Also invoked once at init.
 *
 * For a field that lives inside an `isList` item (e.g. one row of an
 * `ObjectField` with `isList: true`), a path starting with `'./'` resolves
 * against that item's OWN group instead of the top form — e.g. `'./key'` from
 * a field at `searchFields.2.value` resolves to `searchFields.2.key`, its
 * sibling within the same item. Every clone of the template field resolves
 * `'./...'` relative to its OWN index, so one field definition works for every
 * item. Not applicable outside an isList item (there's no item group to
 * resolve against) — use an absolute path there.
 */
export interface ObserverParameter<T = unknown> {
  paths: string | string[];
  callback: (...values: any[]) => T | Promise<T>;
}

/** Every field prop can be static, or observed/derived from other controls. */
export type Dynamic<T> = T | ObserverParameter<T>;

export const observe = <T>(
  paths: string | string[],
  callback: (...values: any[]) => T | Promise<T>,
): ObserverParameter<T> => ({ paths, callback });

/** alias */
export const obs = observe;

/** Runtime guard used by the renderer to resolve Dynamic<T> props. */
export const isObserver = <T>(value: Dynamic<T> | undefined): value is ObserverParameter<T> =>
  !!value &&
  typeof value === 'object' &&
  'paths' in (value as object) &&
  'callback' in (value as object) &&
  typeof (value as ObserverParameter<T>).callback === 'function';

/** `Dynamic<T>` → `T`; leaves already-plain props untouched. Distributes over unions, so
 *  `Resolved<FormField>` stays a discriminated union of each field's own resolved shape. */
type StripDynamic<T> = T extends ObserverParameter<infer U> ? U : T;

/**
 * The runtime shape of a field once the engine has resolved its Dynamic props (SPEC §1): every
 * `Dynamic<T>` prop becomes a plain `T`. This is what `FormInstance.fieldState()` hands to
 * render components — they must never read `label`/`visible`/`disabled`/etc. as `Dynamic` off
 * the raw config type (README "rules of engagement").
 */
export type Resolved<F> = { [K in keyof F]: StripDynamic<F[K]> };
