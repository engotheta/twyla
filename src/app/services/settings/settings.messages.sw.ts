import type { SettingsMessages } from './settings.messages';

export const SETTINGS_SW: SettingsMessages = {
  title: 'Mipangilio',
  system: 'Mfumo',

  appearance: 'Mwonekano',
  theme: {
    label: 'Mandhari',
    hint: 'Mfumo hufuata kifaa chako.',
    light: 'Mwanga',
    dark: 'Giza',
  },
  textSize: {
    label: 'Ukubwa wa maandishi',
    hint: 'Hukuza maandishi na nafasi katika programu nzima.',
    default: 'Kawaida',
    large: 'Makubwa',
    larger: 'Makubwa zaidi',
    largest: 'Makubwa kabisa',
  },
  density: {
    label: 'Msongamano',
    hint: 'Iliyobanwa huonyesha mengi zaidi kwenye skrini.',
    comfortable: 'Yenye nafasi',
    compact: 'Iliyobanwa',
  },

  language: {
    label: 'Lugha',
    hint: 'Mfumo hutumia lugha ya kivinjari chako, ikiwa programu inayo.',
  },

  accessibility: 'Ufikivu',
  contrast: {
    label: 'Utofautishaji',
    hint: 'Zaidi huimarisha maandishi, mipaka na alama ya fokasi, na hupigia viungo mstari.',
    standard: 'Kawaida',
    more: 'Zaidi',
  },
  motion: {
    label: 'Punguza mwendo',
    hint: 'Husimamisha uhuishaji na usogezaji laini. Ikizimwa, programu hufuata mpangilio wa kifaa chako.',
  },
  font: {
    label: 'Fonti rahisi kusoma',
    hint: 'Atkinson Hyperlegible: herufi zinazofanana hutofautishwa kwa urahisi.',
  },
  textSpacing: {
    label: 'Nafasi pana ya maandishi',
    hint: 'Nafasi zaidi kati ya mistari, herufi na maneno.',
  },

  keyboard: 'Kibodi',
  shortcuts: {
    label: 'Njia za mkato za kibodi',
    hint: (presses) =>
      `Bonyeza kitufe cha sehemu mara ${presses} haraka ili kuona njia zake za mkato. Zikizimwa, hakuna kitufe kilicho njia ya mkato.`,
    view: 'Tazama njia za mkato',

    scope: 'Programu',
    dark: 'Mandhari ya giza',
    language: 'Lugha',
    textSize: 'Ukubwa wa maandishi',
    compact: 'Msongamano uliobanwa',
    contrast: 'Utofautishaji zaidi',
    fullScreen: 'Skrini nzima',
    settings: 'Fungua mipangilio',
  },

  reset: 'Rejesha chaguo-msingi',

  on: 'imewashwa',
  off: 'imezimwa',
  changed: (setting, value) => `${setting}: ${value}`,
  resetDone: 'Mipangilio imerejeshwa kwenye chaguo-msingi',
};
