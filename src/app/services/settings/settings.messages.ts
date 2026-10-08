import { defineMessages } from '@services/i18n/message-bundle';
import { SETTINGS_SW } from './settings.messages.sw';

export const SETTINGS_EN = {
  /** the sheet's title, and the header button's name */
  title: 'Settings',
  /** the choice that follows the device or the browser */
  system: 'System',

  appearance: 'Appearance',
  theme: {
    label: 'Theme',
    hint: 'System follows your device.',
    light: 'Light',
    dark: 'Dark',
  },
  textSize: {
    label: 'Text size',
    hint: 'Scales text and spacing across the app.',
    default: 'Default',
    large: 'Large',
    larger: 'Larger',
    largest: 'Largest',
  },
  density: {
    label: 'Density',
    hint: 'Compact fits more on the screen.',
    comfortable: 'Comfortable',
    compact: 'Compact',
  },

  language: {
    label: 'Language',
    hint: "System uses your browser's language, when the app has it.",
  },

  accessibility: 'Accessibility',
  contrast: {
    label: 'Contrast',
    hint: 'More strengthens text, borders and focus rings, and underlines links.',
    standard: 'Standard',
    more: 'More',
  },
  motion: {
    label: 'Reduce motion',
    hint: "Stops animations and smooth scrolling. Off, the app follows your device's setting.",
  },
  font: {
    label: 'Readable font',
    hint: 'Atkinson Hyperlegible, drawn so that similar letters are easy to tell apart.',
  },
  textSpacing: {
    label: 'Wider text spacing',
    hint: 'More room between lines, letters and words.',
  },

  keyboard: 'Keyboard',
  shortcuts: {
    label: 'Keyboard shortcuts',
    hint: (presses: number) =>
      `Press a section's key ${presses} times quickly to see its shortcuts. Off, no key is a shortcut.`,
    /** opens the list of every shortcut on the page */
    view: 'View shortcuts',

    // the app's own shortcuts (`settings.shortcuts.ts`): what each key switches
    scope: 'App',
    dark: 'Dark theme',
    language: 'Language',
    textSize: 'Text size',
    compact: 'Compact density',
    contrast: 'More contrast',
    fullScreen: 'Full screen',
    settings: 'Open settings',
  },

  reset: 'Reset to defaults',

  // what a screen reader hears after a change
  on: 'on',
  off: 'off',
  changed: (setting: string, value: string) => `${setting}: ${value}`,
  resetDone: 'Settings reset to defaults',
};

export type SettingsMessages = typeof SETTINGS_EN;

export const SETTINGS_MESSAGES = defineMessages('settings', SETTINGS_EN, { sw: SETTINGS_SW });
