import { DESCRIPTION_KEYS, DATE_KEYS, NUMBER_KEYS } from './field-keys.constants';

type Obj = Record<string, any>;

export interface CompoundParameter {
  object?: any;
  keys?: string[];
  separator?: string;
  hasInitial?: boolean;
  mapper?: (item: CompoundParameter) => string;
}

export const COMPOUND_NAMED_KEYS: CompoundParameter[] = [
  { keys: ['firstName', 'middleName', 'lastName'], separator: ' ' },
  { keys: ['chainLevel', 'orderIndex'], separator: ' : Level ' },
];

export const SUFFIX_TYPE_MAP: Obj = {
  Date: 'date',
  date: 'date',
  Amount: 'number',
  amount: 'number',
  At: 'date',
};

//. for exact match e.g(title.), * for likeness (nam*)
export const KEY_FIELD_STRING_MAP = {
  'createdAt.': 'label(Created Date) type(date)',
  updatedAt: 'label(Last Update) type(date)',
  '*Primary': 'class(bg-primary)',
  'secondary*': 'class(bg-secondary)',
};

export const DEFAULT_FIELD_STRINGS = [
  `${DESCRIPTION_KEYS.join(', ')} class(col-span-full) order(100)`,
  `${DATE_KEYS.join(', ')} type(date)`,
  `${NUMBER_KEYS.join(', ')} type(number)`,
];
