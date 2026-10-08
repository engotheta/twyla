import { Shortcut } from './shortcuts.interface';

/** the key that, in a hint, opens the full list — and that opens it from anywhere, pressed as a
 *  scope's key is */
export const HELP_KEY = '?';

/**
 * What takes typed characters for itself: fields, and widgets with type-ahead (a select, a menu,
 * a list box). A key pressed there is never a shortcut. `data-shortcuts="off"` opts anything
 * else out.
 */
const TYPING_TARGETS = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="spinbutton"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="tree"]',
  '[data-shortcuts="off"]',
].join(', ');

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(TYPING_TARGETS);
}

/** keys that only modify another: pressing one (Shift, on the way to `?`) is no key of a run */
const MODIFIER_KEYS = new Set(['Shift', 'CapsLock', 'Control', 'Alt', 'AltGraph', 'Meta']);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

/** A key as shortcuts name it: a letter in lower case (so Caps Lock changes nothing), anything
 *  else as `KeyboardEvent.key` gives it. */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** A key as it is shown on a key cap: letters in upper case. */
export function keyCap(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

/** how a key cap is drawn, in the hint and in the panel */
export const KEY_CAP_CLASS =
  'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-gray-100 px-1.5 font-mono text-xs font-semibold text-gray-900';

/**
 * Counts presses of one key in a quick run: each within `window` ms of the one before. Another
 * key, or a pause, starts a new run.
 */
export class KeyRun {
  private key = '';
  private count = 0;
  private last = 0;

  /** the length of the run `key`, pressed at `time`, has reached */
  press(key: string, time: number, window: number): number {
    this.count = key === this.key && time - this.last <= window ? this.count + 1 : 1;
    this.key = key;
    this.last = time;
    return this.count;
  }

  reset(): void {
    this.key = '';
    this.count = 0;
  }
}

/** A dialog that is open, and so all that can be reached: the last one opened. */
export function openModal(document: Document): Element | null {
  const modals = document.querySelectorAll('.cdk-dialog-container, [aria-modal="true"]');
  return modals.length ? modals[modals.length - 1] : null;
}

/**
 * Whether an element is rendered: in the document, and not inside something hidden (an inactive
 * tab panel that stays mounted). Where the browser cannot say (`checkVisibility`), being in the
 * document is taken for it.
 */
export function isOnScreen(host: HTMLElement): boolean {
  if (!host.isConnected) return false;
  if (typeof host.checkVisibility !== 'function') return true;
  if (host.checkVisibility()) return true;
  // `display: contents` has no box of its own to check: what it holds stands in for it
  return Array.from(host.children).some(
    (child) => child instanceof HTMLElement && child.checkVisibility(),
  );
}

/** What `orderHosts` goes by, for each host. */
export interface HostUse {
  host: HTMLElement;
  /** when it was last clicked or focused: higher is later, 0 is never */
  touched: number;
}

/**
 * Which of several is meant, most likely first: the one holding focus (the innermost, where
 * they nest), then the one last clicked or focused, then the first in the document.
 */
export function orderHosts<T extends HostUse>(items: readonly T[], active: Element | null): T[] {
  const holdsFocus = (item: T): boolean => !!active && item.host.contains(active);
  return [...items].sort((a, b) => {
    const focusA = holdsFocus(a);
    const focusB = holdsFocus(b);
    if (focusA !== focusB) return focusA ? -1 : 1;
    // both hold it: one is inside the other, and the inner one is the nearer
    if (focusA && a.host !== b.host) return a.host.contains(b.host) ? 1 : -1;
    if (a.touched !== b.touched) return b.touched - a.touched;
    if (a.host === b.host) return 0;
    return a.host.compareDocumentPosition(b.host) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

/** The innermost of `hosts` that holds `element`. */
export function nearestHost(
  element: Element,
  hosts: readonly HTMLElement[],
): HTMLElement | undefined {
  let nearest: HTMLElement | undefined;
  for (const host of hosts) {
    if (host.contains(element) && (!nearest || nearest.contains(host))) nearest = host;
  }
  return nearest;
}

// ── building shortcuts ──

/** A shortcut that turns something on and off. */
export function toggleShortcut(
  id: string,
  key: string,
  label: () => string,
  on: () => boolean,
  set: (on: boolean) => void,
  more: Partial<Pick<Shortcut, 'available' | 'dismiss'>> = {},
): Shortcut {
  return { id, key, label, on, run: () => set(!on()), ...more };
}

/** A shortcut that steps through `values`, round and round. */
export function cycleShortcut<T>(
  id: string,
  key: string,
  label: () => string,
  values: () => readonly T[],
  current: () => T,
  set: (value: T) => void,
  describe: (value: T) => string,
  more: Partial<Pick<Shortcut, 'available' | 'dismiss'>> = {},
): Shortcut {
  return {
    id,
    key,
    label,
    state: () => describe(current()),
    run: () => {
      const all = values();
      if (all.length) set(all[(all.indexOf(current()) + 1) % all.length]);
    },
    available: () => values().length > 1,
    ...more,
  };
}

/** A shortcut that just does something. */
export function actionShortcut(
  id: string,
  key: string,
  label: () => string,
  run: () => void,
  more: Partial<Pick<Shortcut, 'available' | 'dismiss' | 'state'>> = {},
): Shortcut {
  return { id, key, label, run, ...more };
}
