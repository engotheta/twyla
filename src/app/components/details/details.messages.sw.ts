import type { DetailsMessages } from './details.messages';

export const DETAILS_SW: DetailsMessages = {
  loading: 'Maelezo yanapakia',
  yes: 'Ndiyo',
  no: 'Hapana',
  viewPdf: 'Tazama PDF',
  viewFile: 'Tazama faili',
  view: (what) => `Tazama ${what}`,
  image: 'picha',
  actions: 'Vitendo',
  group: (position) => `Kundi ${position}`,
  sections: 'Sehemu',

  shortcuts: {
    scope: 'Maelezo',
    list: 'Mpangilio wa orodha',
    inlineList: 'Mpangilio wa mstari mmoja',
    table: 'Mpangilio wa jedwali',
    palettes: 'Mpangilio wa kadi',
    expandLists: 'Orodha zimepanuliwa',
    tabs: 'Makundi kwenye vichupo',
    undefinedValues: 'Sehemu zisizo na thamani',
    emptyArrays: 'Orodha tupu',
    iconMarks: 'Aikoni za usuli',
    reset: 'Rejesha ilivyopangwa',
  },
};
