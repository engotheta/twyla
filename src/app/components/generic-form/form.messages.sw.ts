import type { FormMessages } from './form.messages';

function listOf(parts: string[]): string {
  const shown = parts.filter(Boolean);
  if (shown.length < 2) return shown[0] ?? '';
  return `${shown.slice(0, -1).join(', ')} na ${shown[shown.length - 1]}`;
}

export const FORM_SW: FormMessages = {
  submit: 'Wasilisha',
  cancel: 'Ghairi',
  previous: 'Nyuma',
  next: 'Endelea',
  moreInfo: 'Maelezo zaidi',

  list: {
    add: 'Ongeza',
    addItem: (label) => `Ongeza ${label}`,
    item: 'kipengee',
    removeItem: 'Ondoa kipengee',
    itemLabel: (position) => `Kipengee ${position}`,
  },

  input: {
    showPassword: 'Onyesha nenosiri',
    clear: (label) => `Futa ${label}`,
    value: 'thamani',
  },

  select: {
    search: 'Tafuta…',
    searchOptions: 'Tafuta chaguo',
    none: 'Hakuna',
  },

  date: {
    time: 'Saa',
  },

  color: {
    color: 'Rangi',
    picker: (label) => `Kichagua rangi: ${label}`,
  },

  richText: {
    label: 'Maandishi yenye mtindo',
    bold: 'Herufi nzito',
    italic: 'Herufi mlalo',
    underline: 'Pigia mstari',
    bulletList: 'Orodha ya vitone',
  },

  attachment: {
    choose: (many) => (many ? 'Chagua mafaili' : 'Chagua faili'),
    dragDrop: 'au buruta na udondoshe',
    file: (position) => `Faili ${position}`,
    uploading: (name) => `Inapakia ${name}`,
    preview: (name) => `Hakiki ${name}`,
    remove: 'Ondoa faili',
    tooLarge: (name, megabytes) => `"${name}" imezidi kikomo cha MB ${megabytes}`,
    readFailed: 'Imeshindikana kusoma faili',
  },

  errors: {
    required: 'Sehemu hii inahitajika',
    requiredTrue: 'Weka alama kwenye kisanduku hiki ili kuendelea',
    email: 'Weka anwani sahihi ya barua pepe',
    minLength: (length) => `Tumia angalau herufi ${length}`,
    maxLength: (length) => `Tumia herufi zisizozidi ${length}`,
    pattern: 'Weka thamani sahihi',
    mismatch: 'Sehemu hizi lazima zilingane',
    requiredField: (field) => `${field} inahitajika`,
  },

  password: {
    minLength: (length) => `Angalau herufi ${length}`,
    lowercase: 'Herufi ndogo',
    uppercase: 'Herufi kubwa',
    digit: 'Namba',
    symbol: 'Alama, kama ! au #',
    rules: (rules) => {
      const cases =
        rules.lowercase && rules.uppercase
          ? 'herufi kubwa na ndogo'
          : rules.uppercase
            ? 'herufi kubwa'
            : rules.lowercase
              ? 'herufi ndogo'
              : '';
      const list = listOf([cases, rules.digit ? 'namba' : '', rules.symbol ? 'alama' : '']);
      return `Tumia angalau herufi ${rules.minLength}${list ? `, zikiwemo ${list}` : ''}.`;
    },
  },
};
