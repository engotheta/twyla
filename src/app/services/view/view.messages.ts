import { defineMessages } from '@services/i18n/message-bundle';
import { VIEW_SW } from './view.messages.sw';

export const VIEW_EN = {
  /** the X in a dialog's title bar */
  closeDialog: 'Close dialog',
  /** the name of a dialog opened without a title */
  dialog: 'Dialog',
  /** the landmark every menu, select and tooltip opens in (`LandmarkOverlayContainer`) */
  popups: 'Pop-ups',
  confirm: {
    title: 'Please confirm',
    confirm: 'Confirm',
    cancel: 'Cancel',
  },
};

export type ViewMessages = typeof VIEW_EN;

export const VIEW_MESSAGES = defineMessages('view', VIEW_EN, { sw: VIEW_SW });
