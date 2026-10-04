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
};
