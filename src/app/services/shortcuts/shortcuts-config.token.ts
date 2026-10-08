import { InjectionToken, Provider } from '@angular/core';
import { ShortcutsConfig } from './shortcuts.interface';

export const DEFAULT_SHORTCUTS_CONFIG: ShortcutsConfig = {
  enabled: true,
  presses: 6,
  window: 500,
  idle: 8000,
  keys: {},
};

export const SHORTCUTS_CONFIG = new InjectionToken<ShortcutsConfig>('SHORTCUTS_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_SHORTCUTS_CONFIG,
});

/**
 * Overrides part of `ShortcutsConfig`: `provideShortcuts({ presses: 4 })`, or
 * `provideShortcuts({ keys: { 'data-grid.export': false } })` to take one shortcut out
 * everywhere. `{ enabled: false }` turns the feature off for the whole app. Without it the
 * defaults apply — the service needs no provider to work.
 */
export function provideShortcuts(config: Partial<ShortcutsConfig> = {}): Provider {
  return {
    provide: SHORTCUTS_CONFIG,
    useValue: {
      ...DEFAULT_SHORTCUTS_CONFIG,
      ...config,
      keys: { ...DEFAULT_SHORTCUTS_CONFIG.keys, ...config.keys },
    } satisfies ShortcutsConfig,
  };
}
