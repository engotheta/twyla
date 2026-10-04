import { defineMessages } from '@services/i18n/message-bundle';
import { FORM_SW } from './form.messages.sw';
// type-only: validators.ts reads `FORM_EN` from this file
import type { PasswordRules } from './validators';

/** the parts of a password rule sentence that apply, as a list: "a, b and c" */
function listOf(parts: string[], and: string): string {
  const shown = parts.filter(Boolean);
  if (shown.length < 2) return shown[0] ?? '';
  return `${shown.slice(0, -1).join(', ')} ${and} ${shown[shown.length - 1]}`;
}

export const FORM_EN = {
  submit: 'Submit',
  cancel: 'Cancel',
  previous: 'Previous',
  next: 'Next',
  /** the step that gathers a stepped form's fields that sit outside any step */
  moreInfo: 'More Info',

  list: {
    add: 'Add',
    /** the add button's name: "Add Phone numbers" */
    addItem: (label: string) => `Add ${label}`,
    /** what a list with no label adds */
    item: 'item',
    removeItem: 'Remove item',
    /** a list item that has no label of its own */
    itemLabel: (position: number) => `Item ${position}`,
  },

  input: {
    showPassword: 'Show password',
    clear: (label: string) => `Clear ${label}`,
    /** what an input with no label clears */
    value: 'value',
  },

  select: {
    search: 'Search…',
    searchOptions: 'Search options',
    none: 'None',
  },

  date: {
    time: 'Time',
  },

  color: {
    color: 'Color',
    picker: (label: string) => `${label} picker`,
  },

  richText: {
    label: 'Rich text',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    bulletList: 'Bullet list',
  },

  attachment: {
    // (`: string` — a function that returns only literals would otherwise be typed as exactly
    // those, and no translation could match)
    choose: (many: boolean): string => (many ? 'Choose files' : 'Choose file'),
    dragDrop: 'or drag & drop',
    /** a picked file that has no name */
    file: (position: number) => `File ${position}`,
    uploading: (name: string) => `Uploading ${name}`,
    preview: (name: string) => `Preview ${name}`,
    remove: 'Remove file',
    tooLarge: (name: string, megabytes: number) => `"${name}" exceeds the ${megabytes}MB limit`,
    readFailed: 'Failed to read file',
  },

  /** what a field shows when a validator has no message of its own (`validators.ts`) */
  errors: {
    required: 'This field is required',
    requiredTrue: 'Tick this box to continue',
    email: 'Enter a valid email address',
    minLength: (length: number) => `Use at least ${length} characters`,
    maxLength: (length: number) => `Use at most ${length} characters`,
    pattern: 'Enter a valid value',
    /** a `match` cross-validator */
    mismatch: 'Fields must match',
    /** a `requiredIf` cross-validator */
    requiredField: (field: string) => `${field} is required`,
  },

  password: {
    minLength: (length: number) => `At least ${length} characters`,
    lowercase: 'A lowercase letter',
    uppercase: 'An uppercase letter',
    digit: 'A number',
    symbol: 'A symbol, such as ! or #',
    /** the rules as one sentence: "Use at least 8 characters, with upper and lower case letters,
     *  a number and a symbol." */
    rules: (rules: PasswordRules) => {
      const cases =
        rules.lowercase && rules.uppercase
          ? 'upper and lower case letters'
          : rules.uppercase
            ? 'an uppercase letter'
            : rules.lowercase
              ? 'a lowercase letter'
              : '';
      const list = listOf(
        [cases, rules.digit ? 'a number' : '', rules.symbol ? 'a symbol' : ''],
        'and',
      );
      return `Use at least ${rules.minLength} characters${list ? `, with ${list}` : ''}.`;
    },
  },
};

export type FormMessages = typeof FORM_EN;

export const FORM_MESSAGES = defineMessages('generic-form', FORM_EN, { sw: FORM_SW });
