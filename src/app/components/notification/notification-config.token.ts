import { InjectionToken, Provider } from '@angular/core';
import { NotificationConfig, NotificationType } from './notification.interface';

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  duration: { success: 4000, info: 4000, warning: 6000, error: 8000 },
  maxVisible: 4,
};

export const NOTIFICATION_CONFIG = new InjectionToken<NotificationConfig>('NOTIFICATION_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_NOTIFICATION_CONFIG,
});

/** Overrides part of the notification config, e.g. `provideNotificationConfig({ duration: { error: 0 } })`. */
export function provideNotificationConfig(config: {
  duration?: Partial<Record<NotificationType, number>>;
  maxVisible?: number;
}): Provider {
  return {
    provide: NOTIFICATION_CONFIG,
    useValue: {
      ...DEFAULT_NOTIFICATION_CONFIG,
      ...config,
      duration: { ...DEFAULT_NOTIFICATION_CONFIG.duration, ...config.duration },
    },
  };
}
