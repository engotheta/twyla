import { defineMessages } from '@services/i18n';
import { ACCOUNT_SW } from './account.messages.sw';

/** The account pages' text. Their names in the menu are route names (`configs/route-names.ts`). */
export const ACCOUNT_EN = {
  profile: {
    subtitle: "Who you're signed in as",
    /** names the card for a screen reader */
    label: 'Profile',
    name: 'Name',
    username: 'Username',
    email: 'Email',
    roles: 'Roles',
    permissions: 'Permissions',
    /** a user with no permissions */
    none: 'none',
  },
  preferences: {
    subtitle: 'How the app looks and reads for you, on this device',
  },
};

export type AccountMessages = typeof ACCOUNT_EN;

export const ACCOUNT_MESSAGES = defineMessages('account', ACCOUNT_EN, { sw: ACCOUNT_SW });
