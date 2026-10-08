import { defineMessages } from '@services/i18n/message-bundle';
import { SHORTCUTS_SW } from './shortcuts.messages.sw';

export const SHORTCUTS_EN = {
  /** the panel's title, and the name of what opens it */
  title: 'Keyboard shortcuts',

  /** names one of several of a kind: "Data grid: Employees" */
  named: (scope: string, name: string) => `${scope}: ${name}`,
  /** what a shortcut with a state says it did: "Paginator: off" */
  result: (label: string, state: string) => `${label}: ${state}`,
  on: 'on',
  off: 'off',
  /** an action button that has a key but no name */
  button: 'Button',

  /** key caps, as they are printed on the keys */
  keys: {
    escape: 'Esc',
  },

  hint: {
    /** said as a scope is armed: "Data grid shortcuts. Press a key, or Escape to close." */
    armed: (scope: string) => `${scope} shortcuts. Press a key, or Escape to close.`,
    /** which of several: "2 of 3" */
    position: (index: number, count: number) => `${index} of ${count}`,
    next: 'Next',
    all: 'All shortcuts',
    close: 'Close',
    /** said when the hint goes */
    closed: 'Shortcuts closed',
  },

  panel: {
    /** how it works, above the list */
    intro: (presses: number) =>
      `Press a section's key ${presses} times in a row, quickly, to see its shortcuts. Then press one. Keys typed in a field never count.`,
    /** every shortcut is also a button here */
    alsoHere: 'Each shortcut below is also a button.',
    /** a scope's own key, as its heading shows it: "G, 6 times" */
    times: (key: string, presses: number) => `${key}, ${presses} times`,
    /** a row's button, named in full for a screen reader: "Paginator: on, key P" */
    row: (shortcut: string, key: string) => `${shortcut}, key ${key}`,
    /** nothing on the page has any */
    none: 'Nothing on this page has shortcuts.',
  },
};

export type ShortcutsMessages = typeof SHORTCUTS_EN;

export const SHORTCUTS_MESSAGES = defineMessages('shortcuts', SHORTCUTS_EN, { sw: SHORTCUTS_SW });
