import { inject, InjectionToken } from '@angular/core';
import { ToastService } from '../toast';

/** Where `FetchService` sends its success and error messages. */
export interface FetchNotifier {
  success(message: string): void;
  error(message: string): void;
}

/** Defaults to the app's `ToastService`; provide your own to route messages elsewhere. */
export const FETCH_NOTIFIER = new InjectionToken<FetchNotifier>('FETCH_NOTIFIER', {
  providedIn: 'root',
  factory: () => {
    const toasts = inject(ToastService);
    return {
      success: (message) => toasts.success(message),
      error: (message) => toasts.error(message),
    };
  },
});
