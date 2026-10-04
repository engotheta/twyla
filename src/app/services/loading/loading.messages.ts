import { defineMessages } from '@services/i18n/message-bundle';
import { LOADING_SW } from './loading.messages.sw';

export const LOADING_EN = {
  /** the spinner's accessible name, unless `LoadingConfig.label` gives another */
  label: 'Loading',
};

export type LoadingMessages = typeof LOADING_EN;

export const LOADING_MESSAGES = defineMessages('loading', LOADING_EN, { sw: LOADING_SW });
