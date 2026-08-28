/**
 * Best-effort localStorage persistence for "which tab/step was last active" (used by
 * `SlidingTabIndicatorDirective` and `StepperProgressIndicatorDirective`). Keys are derived from
 * the labels of the group itself rather than assigned by the caller, so a directive can restore
 * across a page refresh without any wiring from the component it's attached to.
 */

const STORAGE_PREFIX = 'studio.tab-state.';

/** keys already handed out during this session, so two structurally-identical groups (e.g. same
 *  labels, same route) rendered on the same view don't read/write the same storage slot */
const claimedKeys = new Set<string>();

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** collapses internal whitespace, for comparing a stored label back against live DOM text */
export function normalizeLabel(text: string | null | undefined): string {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

/** derives a storage key from `namespace` + `route` + the group's own labels, disambiguating
 *  against any identical key already claimed this session by appending `#2`, `#3`, ... — call
 *  `releasePersistedSelectionKey` in `ngOnDestroy` or the disambiguation counter only ever grows */
export function claimPersistedSelectionKey(
  namespace: string,
  route: string,
  labels: string[],
): string {
  const base = `${namespace}:${route}:${labels.map(slugify).join('|')}`;
  let key = base;
  let suffix = 2;
  while (claimedKeys.has(key)) {
    key = `${base}#${suffix++}`;
  }
  claimedKeys.add(key);
  return key;
}

export function releasePersistedSelectionKey(key: string): void {
  claimedKeys.delete(key);
}

export function readPersistedSelection(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

export function writePersistedSelection(key: string, value: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // storage unavailable (private browsing, quota exceeded, ...) — persistence is best-effort
  }
}
