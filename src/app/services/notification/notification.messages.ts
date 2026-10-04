import { defineMessages } from '@services/i18n/message-bundle';
import { NOTIFICATION_SW } from './notification.messages.sw';

export const NOTIFICATION_EN = {
  /** the name of the toast stack's landmark */
  region: 'Notifications',
  dismiss: 'Dismiss notification',
};

export type NotificationMessages = typeof NOTIFICATION_EN;

export const NOTIFICATION_MESSAGES = defineMessages('notification', NOTIFICATION_EN, {
  sw: NOTIFICATION_SW,
});
