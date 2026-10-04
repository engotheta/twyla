import { defineMessages } from '@services/i18n/message-bundle';
import { SESSION_SW } from './session.messages.sw';

export const SESSION_EN = {
  signedOut: 'You have been signed out.',
  expired: 'Your session has expired. Please sign in again.',
  /** `permissionGuard` turned the user away */
  noAccess: "You don't have access to that page.",
  errors: {
    offline: "Couldn't reach the server. Check your connection and try again.",
    server: 'The server ran into a problem. Please try again in a moment.',
    unknown: 'Something went wrong. Please try again.',
    // what a `SessionApi` reports by key (`SessionError.key`), so it shows in the user's language
    incorrectCredentials: 'Incorrect username or password.',
    invalidResetLink: 'This reset link is invalid or has expired.',
  },
};

export type SessionMessages = typeof SESSION_EN;

export const SESSION_MESSAGES = defineMessages('session', SESSION_EN, { sw: SESSION_SW });
