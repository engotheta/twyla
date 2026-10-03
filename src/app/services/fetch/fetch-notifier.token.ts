import { inject, InjectionToken } from '@angular/core';
import { NotificationService } from '@services/notification';

/** Where `FetchService` sends its success and error messages. */
export interface FetchNotifier {
  success(message: string): void;
  error(message: string): void;
}

/** Defaults to the app's `NotificationService`; provide your own to route messages elsewhere. */
export const FETCH_NOTIFIER = new InjectionToken<FetchNotifier>('FETCH_NOTIFIER', {
  providedIn: 'root',
  factory: () => {
    const notify = inject(NotificationService);
    return {
      success: (message) => notify.success(message),
      error: (message) => notify.error(message),
    };
  },
});
