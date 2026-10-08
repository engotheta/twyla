// ─────────────────────────────────────────────
// Keyboard shortcuts, by scope. A scope is a kind of component — the data grid, the form — or a
// part of the app. Its key, pressed several times in one quick run, arms it; one more key then
// runs one of its shortcuts (README.md).
// ─────────────────────────────────────────────

/** A kind of component, or a part of the app, that has shortcuts. */
export interface ShortcutScope {
  /** stable: `'data-grid'`. What an app re-keys or removes it by (`ShortcutsConfig.keys`) */
  id: string;
  /** the key that arms it — one key as `KeyboardEvent.key` gives it, in lower case: `'g'` */
  key: string;
}

/** One thing a scope's key can then do. */
export interface Shortcut {
  /** stable within its scope: `'paginator'` */
  id: string;
  /** one key as `KeyboardEvent.key` gives it; a letter in lower case: `'p'`, `'1'`, `'='` */
  key: string;
  /** what it does, in the user's language, as it reads now */
  label: () => string;
  run: () => void;
  /** a switch: whether it is on. Shown beside it, and said once it has run, as on / off */
  on?: () => boolean;
  /** or, for one that steps through values, the value it stands at, in words: `'Table'` */
  state?: () => string | undefined;
  /** not offered while false: there is nothing for it to act on */
  available?: () => boolean;
  /** it opens something — a panel, a dialog: the hint closes as it runs */
  dismiss?: boolean;
}

/** What a component hands over as it registers: one instance of a scope. */
export interface ShortcutTarget {
  scope: ShortcutScope;
  /** the scope's name in the user's language: "Data grid" */
  label: () => string;
  /** what tells this one from another of its kind on the same page: a grid's own label */
  name?: () => string | undefined;
  /**
   * Its element. Decides whether it can be reached (on screen, inside the open dialog), which
   * of several is meant (the one holding focus, else the one last used), and where its ring is
   * drawn. Without one the target is always there: the app's own scope.
   */
  host?: HTMLElement;
  /** false takes this one out: `params.shortcuts: false` */
  enabled?: () => boolean;
  /** its shortcuts, as they stand: read each time they are shown or one is pressed */
  shortcuts: () => Shortcut[];
}

export interface ShortcutsConfig {
  /** false: nothing listens, and Settings offers no switch. Default true */
  enabled: boolean;
  /** presses of a scope's key, in one quick run, that arm it. Default 6 */
  presses: number;
  /** the most ms between two presses of one run. Default 500 */
  window: number;
  /** ms an armed scope waits for a key before it lets go. Default 8000 */
  idle: number;
  /**
   * An app's own keys, by id: `{ 'data-grid': 'q' }` re-keys a scope,
   * `{ 'data-grid.paginator': 'n' }` one of its shortcuts, and `false` removes either.
   */
  keys: Readonly<Record<string, string | false>>;
}

/** One row of the hint, or of the panel. */
export interface ShortcutRow {
  id: string;
  key: string;
  label: string;
  /** on / off, or the value it stands at */
  state?: string;
}

/** Where the armed target is, in the window's own pixels: what the hint draws its ring around. */
export interface ShortcutBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** What the hint shows while a scope is armed. */
export interface ShortcutHint {
  /** "Data grid", or "Data grid: Employees" when the target has a name */
  title: string;
  /** the scope's key: pressed again, it moves to the next of several targets */
  key: string;
  /** which of several targets this is */
  position?: { index: number; count: number };
  shortcuts: ShortcutRow[];
  /** what the last shortcut did: "Paginator: off" */
  said?: string;
}
