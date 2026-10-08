import { DOCUMENT, inject } from '@angular/core';
import { I18nService } from '@services/i18n/i18n.service';
import { injectMessages } from '@services/i18n/message-bundle';
import {
  actionShortcut,
  cycleShortcut,
  toggleShortcut,
} from '@services/shortcuts/shortcuts.helpers';
import { ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { registerShortcuts } from '@services/shortcuts/shortcuts.service';
import { ViewService } from '@services/view/view.service';
import { toggleDocumentFullscreen } from '@utils/fullscreen-overlay.helpers';
import { SETTING_CHOICES } from './settings.interface';
import { SETTINGS_MESSAGES } from './settings.messages';
import { SettingsService } from './settings.service';
import { openSettingsSheet } from './settings-sheet';

/** The app's own shortcuts: what a person sets for themselves, on every page. */
export const APP_SCOPE: ShortcutScope = { id: 'app', key: 'a' };

/**
 * Registers the app's own shortcuts — theme, language, text size, density, contrast, full
 * screen, the settings sheet — for as long as the app runs. Each one changes a setting through
 * `SettingsService`, so it is saved like any other change. `provideSettings` calls it; it needs
 * an injection context.
 */
export function registerSettingsShortcuts(): void {
  const settings = inject(SettingsService);
  const i18n = inject(I18nService);
  const view = inject(ViewService);
  const document = inject(DOCUMENT);
  const t = injectMessages(SETTINGS_MESSAGES);
  const text = () => t().shortcuts;

  registerShortcuts(
    APP_SCOPE,
    () => [
      toggleShortcut(
        'dark',
        'd',
        () => text().dark,
        () => settings.dark(),
        (on) => settings.update({ theme: on ? 'dark' : 'light' }),
      ),
      cycleShortcut(
        'language',
        'l',
        () => text().language,
        () => i18n.languages.map((language) => language.code),
        () => settings.language(),
        (language) => settings.update({ language }),
        (code) => i18n.languages.find((language) => language.code === code)?.name ?? code,
      ),
      cycleShortcut(
        'textSize',
        't',
        () => text().textSize,
        () => SETTING_CHOICES.textSize,
        () => settings.settings().textSize,
        (textSize) => settings.update({ textSize }),
        (size) => t().textSize[size],
      ),
      toggleShortcut(
        'compact',
        'c',
        () => text().compact,
        () => settings.settings().density === 'compact',
        (on) => settings.update({ density: on ? 'compact' : 'comfortable' }),
      ),
      toggleShortcut(
        'contrast',
        'k',
        () => text().contrast,
        () => settings.moreContrast(),
        (on) => settings.update({ contrast: on ? 'more' : 'standard' }),
      ),
      // entering full screen is not done by the time this returns: it shows no state to be wrong
      actionShortcut(
        'fullScreen',
        'f',
        () => text().fullScreen,
        () => toggleDocumentFullscreen(document),
        { available: () => !!document.fullscreenEnabled },
      ),
      actionShortcut(
        'settings',
        's',
        () => text().settings,
        () => void openSettingsSheet(view, () => t().title),
        { dismiss: true },
      ),
    ],
    { label: () => text().scope, host: null },
  );
}
