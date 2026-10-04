import { InjectionToken } from '@angular/core';
import { AppSettings, SettingsConfig } from './settings.interface';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'system',
  textSize: 'default',
  contrast: 'system',
  motion: 'system',
  font: 'default',
  textSpacing: 'default',
  density: 'comfortable',
};

export const DEFAULT_SETTINGS_CONFIG: SettingsConfig = {
  storageKey: 'settings',
  defaults: DEFAULT_SETTINGS,
  readableFontUrl:
    'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;500;700&display=swap',
};

export const SETTINGS_CONFIG = new InjectionToken<SettingsConfig>('SETTINGS_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_SETTINGS_CONFIG,
});

export type SettingsConfigOverrides = Partial<Omit<SettingsConfig, 'defaults'>> & {
  defaults?: Partial<AppSettings>;
};

/** `DEFAULT_SETTINGS_CONFIG` with `overrides` applied — what `provideSettings` provides */
export function settingsConfig(overrides: SettingsConfigOverrides = {}): SettingsConfig {
  return {
    ...DEFAULT_SETTINGS_CONFIG,
    ...overrides,
    defaults: { ...DEFAULT_SETTINGS, ...overrides.defaults },
  };
}
