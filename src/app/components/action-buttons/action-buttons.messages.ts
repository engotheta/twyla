import { defineMessages } from '@services/i18n/message-bundle';
import { ACTION_BUTTONS_SW } from './action-buttons.messages.sw';

export const ACTION_BUTTONS_EN = {
  /** the name of a button, or a menu row, that was given no label and no tooltip */
  action: 'Action',
};

export type ActionButtonsMessages = typeof ACTION_BUTTONS_EN;

export const ACTION_BUTTONS_MESSAGES = defineMessages('action-buttons', ACTION_BUTTONS_EN, {
  sw: ACTION_BUTTONS_SW,
});
