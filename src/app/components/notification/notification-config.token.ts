import { InjectionToken, Provider } from '@angular/core';
import { ToastConfig, ToastType } from './toast.interface';

export const DEFAULT_TOAST_CONFIG: ToastConfig = {
  duration: { success: 4000, info: 4000, error: 8000 },
  maxVisible: 4,
};

export const TOAST_CONFIG = new InjectionToken<ToastConfig>('TOAST_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_TOAST_CONFIG,
});

/** Overrides part of the toast config, e.g. `provideToastConfig({ duration: { error: 0 } })`. */
export function provideToastConfig(config: {
  duration?: Partial<Record<ToastType, number>>;
  maxVisible?: number;
}): Provider {
  return {
    provide: TOAST_CONFIG,
    useValue: {
      ...DEFAULT_TOAST_CONFIG,
      ...config,
      duration: { ...DEFAULT_TOAST_CONFIG.duration, ...config.duration },
    },
  };
}
