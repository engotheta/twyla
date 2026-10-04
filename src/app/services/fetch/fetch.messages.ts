import { defineMessages } from '@services/i18n/message-bundle';
import type { FetchMessages } from './fetch-config.token';
import { FETCH_SW } from './fetch.messages.sw';

/** the toasts `FetchService` shows when neither the call nor the server says anything better */
export const FETCH_EN: FetchMessages = {
  success: 'Completed successfully',
  failed: 'Request failed',
  error: 'Something went wrong',
  network: 'Network error — check your connection',
};

export const FETCH_MESSAGES = defineMessages('fetch', FETCH_EN, { sw: FETCH_SW });
