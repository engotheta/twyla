// ─────────────────────────────────────────────
// What a person can set for themselves. "system" follows the browser or operating system, and
// keeps following it as it changes.
// ─────────────────────────────────────────────

export type ThemeSetting = 'system' | 'light' | 'dark';
export type ContrastSetting = 'system' | 'standard' | 'more';
/** there is no "full": where the operating system asks for less motion, the browser and
 *  Angular Material hold back on their own and nothing here can make them move again */
export type MotionSetting = 'system' | 'reduced';
export type TextSize = 'default' | 'large' | 'larger' | 'largest';
export type FontSetting = 'default' | 'readable';
export type TextSpacing = 'default' | 'wide';
export type Density = 'comfortable' | 'compact';

export interface AppSettings {
  theme: ThemeSetting;
  /** `'system'` — the browser's language, where the app offers it — or a language code */
  language: string;
  textSize: TextSize;
  contrast: ContrastSetting;
  motion: MotionSetting;
  font: FontSetting;
  textSpacing: TextSpacing;
  density: Density;
}

/** every value a setting may hold — what a stored value is checked against (`language` is free) */
export const SETTING_CHOICES = {
  theme: ['system', 'light', 'dark'],
  textSize: ['default', 'large', 'larger', 'largest'],
  contrast: ['system', 'standard', 'more'],
  motion: ['system', 'reduced'],
  font: ['default', 'readable'],
  textSpacing: ['default', 'wide'],
  density: ['comfortable', 'compact'],
} as const satisfies { [K in Exclude<keyof AppSettings, 'language'>]: readonly AppSettings[K][] };

/** how much each text size scales the page: the root font size, as a factor */
export const TEXT_SCALE: Record<TextSize, number> = {
  default: 1,
  large: 1.125,
  larger: 1.25,
  largest: 1.5,
};

export interface SettingsConfig {
  /** the localStorage key the settings are kept under */
  storageKey: string;
  /** what applies until the person chooses otherwise */
  defaults: AppSettings;
  /**
   * The stylesheet that brings the readable font, added to the page the first time it's chosen.
   * `null` when the app serves the font itself. The family is the `--readable-font-family`
   * custom property (`styles/_preferences.scss`).
   */
  readableFontUrl: string | null;
}

/** where a theme change was made, in viewport pixels — the reveal opens from there */
export interface RevealOrigin {
  x: number;
  y: number;
}
