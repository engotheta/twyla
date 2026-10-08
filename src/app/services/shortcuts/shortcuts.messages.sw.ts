import type { ShortcutsMessages } from './shortcuts.messages';

export const SHORTCUTS_SW: ShortcutsMessages = {
  title: 'Njia za mkato za kibodi',

  named: (scope, name) => `${scope} — ${name}`,
  result: (label, state) => `${label} — ${state}`,
  on: 'imewashwa',
  off: 'imezimwa',
  button: 'Kitufe',

  keys: {
    escape: 'Esc',
  },

  hint: {
    armed: (scope) => `Njia za mkato za ${scope}. Bonyeza kitufe, au Escape ili kufunga.`,
    position: (index, count) => `${index} kati ya ${count}`,
    next: 'Inayofuata',
    all: 'Njia zote za mkato',
    close: 'Funga',
    closed: 'Njia za mkato zimefungwa',
  },

  panel: {
    intro: (presses) =>
      `Bonyeza kitufe cha sehemu mara ${presses} mfululizo, haraka, ili kuona njia zake za mkato. Kisha bonyeza mojawapo. Herufi zinazoandikwa kwenye sehemu ya maandishi hazihesabiwi.`,
    alsoHere: 'Kila njia ya mkato hapa chini pia ni kitufe.',
    times: (key, presses) => `${key}, mara ${presses}`,
    row: (shortcut, key) => `${shortcut}, kitufe ${key}`,
    none: 'Hakuna kitu kwenye ukurasa huu chenye njia za mkato.',
  },
};
