import { computed, DestroyRef, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { I18nService } from '@services/i18n/i18n.service';
import { mediaQuerySignal } from '@utils/viewport.helpers';
import { SETTINGS_CONFIG } from './settings-config.token';
import { AppSettings, RevealOrigin, SETTING_CHOICES, TEXT_SCALE } from './settings.interface';

/** marks the readable font's stylesheet, so it's added to the page once */
const FONT_LINK_ATTRIBUTE = 'data-readable-font';

/**
 * What the person set for themselves — theme, language, text size, contrast, motion, font, text
 * spacing, density — kept in localStorage and applied to `<html>`, where the stylesheets pick it
 * up (`styles/_dark.scss`, `styles/_preferences.scss`).
 *
 * `settings()` is what they chose; `dark()`, `moreContrast()`, `reducedMotion()` and `language()`
 * are what that comes to once "system" is resolved against the browser — and they stay live:
 * switch the operating system to dark and an app on "system" follows.
 *
 * `provideSettings()` creates it as the app starts, so the stored settings apply before the
 * first page renders.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly config = inject(SETTINGS_CONFIG);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly storage = localStorageOf(this.window);

  /** what applies until the person chooses otherwise */
  readonly defaults: AppSettings = this.config.defaults;

  private readonly stored = signal<AppSettings>(this.read());
  /** what the person chose */
  readonly settings = this.stored.asReadonly();

  private readonly systemDark = mediaQuerySignal('(prefers-color-scheme: dark)');
  private readonly systemMoreContrast = mediaQuerySignal('(prefers-contrast: more)');
  private readonly systemReducedMotion = mediaQuerySignal('(prefers-reduced-motion: reduce)');

  readonly dark = computed(() => this.isDark(this.stored()));
  readonly moreContrast = computed(() => {
    const { contrast } = this.stored();
    return contrast === 'more' || (contrast === 'system' && this.systemMoreContrast());
  });
  readonly reducedMotion = computed(
    () => this.stored().motion === 'reduced' || this.systemReducedMotion(),
  );
  /** the code of the language in use: the chosen one, else the browser's, else the default */
  readonly language = computed(() => {
    const { language } = this.stored();
    const chosen = language === 'system' ? undefined : this.i18n.supported(language);
    return chosen ?? this.i18n.preferred();
  });
  /** the root font size, as a factor of the browser's own */
  readonly textScale = computed(() => TEXT_SCALE[this.stored().textSize]);
  /** nothing has been changed from the defaults */
  readonly pristine = computed(() => {
    const settings = this.stored();
    return settingKeys(this.defaults).every((key) => settings[key] === this.defaults[key]);
  });

  constructor() {
    // now, before anything renders — then again whenever a setting or a system preference changes
    this.apply();
    effect(() => this.apply());
    this.followOtherTabs();
  }

  /**
   * Changes one or more settings: applied and saved at once. A change of theme opens from
   * `origin` as a circle (where the browser can, and motion isn't reduced).
   */
  update(patch: Partial<AppSettings>, origin?: RevealOrigin): void {
    const next = { ...this.stored(), ...patch };
    const commit = (): void => {
      this.stored.set(next);
      this.write(next);
      this.apply();
    };
    if (this.isDark(next) !== this.dark() && this.canReveal()) this.reveal(commit, origin);
    else commit();
  }

  /** Back to the defaults; the stored choice is forgotten. */
  reset(): void {
    this.stored.set(this.defaults);
    this.write(null);
    this.apply();
  }

  private isDark(settings: AppSettings): boolean {
    return settings.theme === 'dark' || (settings.theme === 'system' && this.systemDark());
  }

  /** everything the stylesheets and the other services need to know, written where they look */
  private apply(): void {
    const root = this.document.documentElement;
    const settings = this.stored();

    root.classList.toggle('dark', this.dark());
    setAttribute(root, 'data-contrast', this.moreContrast() ? 'more' : null);
    setAttribute(root, 'data-motion', this.reducedMotion() ? 'reduced' : null);
    setAttribute(
      root,
      'data-text-size',
      settings.textSize === 'default' ? null : settings.textSize,
    );
    setAttribute(root, 'data-font', settings.font === 'default' ? null : settings.font);
    setAttribute(
      root,
      'data-text-spacing',
      settings.textSpacing === 'default' ? null : settings.textSpacing,
    );
    setAttribute(
      root,
      'data-density',
      settings.density === 'comfortable' ? null : settings.density,
    );

    this.i18n.use(this.language());
    if (settings.font === 'readable') this.loadReadableFont();
  }

  // ── the theme change's reveal (styles/_view-transitions.scss) ──

  private canReveal(): boolean {
    return typeof this.document.startViewTransition === 'function' && !this.reducedMotion();
  }

  /** makes the change inside a view transition: the new theme opens as a circle from `origin`,
   *  far enough to reach the farthest corner */
  private reveal(commit: () => void, origin?: RevealOrigin): void {
    const root = this.document.documentElement;
    const width = this.window?.innerWidth ?? 0;
    const height = this.window?.innerHeight ?? 0;
    const x = origin?.x ?? width / 2;
    const y = origin?.y ?? height / 2;
    const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));

    root.style.setProperty('--reveal-x', `${x}px`);
    root.style.setProperty('--reveal-y', `${y}px`);
    root.style.setProperty('--reveal-radius', `${radius}px`);

    const clear = (): void => {
      for (const name of ['--reveal-x', '--reveal-y', '--reveal-radius']) {
        root.style.removeProperty(name);
      }
    };
    this.document.startViewTransition(commit).finished.then(clear, clear);
  }

  // ── the readable font ──

  private loadReadableFont(): void {
    const url = this.config.readableFontUrl;
    if (!url || this.document.head.querySelector(`link[${FONT_LINK_ATTRIBUTE}]`)) return;
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute(FONT_LINK_ATTRIBUTE, '');
    this.document.head.appendChild(link);
  }

  // ── storage ──

  /** a setting changed in another tab of this browser: follow it */
  private followOtherTabs(): void {
    const win = this.window;
    if (!win) return;
    const onStorage = (event: StorageEvent): void => {
      // `key` is null when the whole storage was cleared
      if (event.key !== null && event.key !== this.config.storageKey) return;
      if (event.storageArea !== this.storage) return;
      this.stored.set(this.read());
    };
    win.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => win.removeEventListener('storage', onStorage));
  }

  /** the stored settings over the defaults; a value that isn't one of the choices is dropped */
  private read(): AppSettings {
    const settings: AppSettings = { ...this.config.defaults };
    const stored = parse(readItem(this.storage, this.config.storageKey));
    if (!stored) return settings;

    if (typeof stored['language'] === 'string') settings.language = stored['language'];
    const record = settings as unknown as Record<string, unknown>;
    for (const [key, choices] of Object.entries(SETTING_CHOICES)) {
      if ((choices as readonly unknown[]).includes(stored[key])) record[key] = stored[key];
    }
    return settings;
  }

  /** `null` forgets */
  private write(settings: AppSettings | null): void {
    try {
      if (settings === null) this.storage?.removeItem(this.config.storageKey);
      else this.storage?.setItem(this.config.storageKey, JSON.stringify(settings));
    } catch {
      // storage blocked or full: the settings last as long as the page
    }
  }
}

function settingKeys(settings: AppSettings): (keyof AppSettings)[] {
  return Object.keys(settings) as (keyof AppSettings)[];
}

function setAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function parse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readItem(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null; // storage blocked
  }
}

/** where the browser blocks storage, even reading `window.localStorage` throws */
function localStorageOf(win: Window | null): Storage | undefined {
  try {
    return win?.localStorage;
  } catch {
    return undefined;
  }
}
