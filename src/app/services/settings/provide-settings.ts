import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { SETTINGS_CONFIG, settingsConfig, SettingsConfigOverrides } from './settings-config.token';
import { SettingsService } from './settings.service';
import { registerSettingsShortcuts } from './settings.shortcuts';

/**
 * The person's own settings — theme, language, text size, contrast, motion, font, text spacing,
 * density, keyboard shortcuts: `provideSettings({ storageKey: 'my-app.settings' })` in the app
 * config. They are read and applied as the app starts, before the first page renders.
 *
 * `defaults` changes what applies until someone chooses: `{ defaults: { theme: 'light' } }`
 * keeps an app light whatever the operating system prefers. (The script in `index.html` that
 * turns the page dark before it loads assumes the default theme is `'system'` and the key is
 * `twyla.settings` — change it along with either.)
 */
export function provideSettings(config: SettingsConfigOverrides = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SETTINGS_CONFIG, useValue: settingsConfig(config) },
    provideAppInitializer(() => {
      inject(SettingsService);
      // the settings a key away, on every page (`ShortcutsService`)
      registerSettingsShortcuts();
    }),
  ]);
}
