import { TestBed } from '@angular/core/testing';
import { provideI18n } from '@services/i18n/i18n-config.token';
import { I18nService } from '@services/i18n/i18n.service';
import { provideSettings } from './provide-settings';
import { DEFAULT_SETTINGS, SettingsConfigOverrides } from './settings-config.token';
import { AppSettings } from './settings.interface';
import { SettingsService } from './settings.service';

const KEY = 'test.settings';
const DARK = '(prefers-color-scheme: dark)';
const MORE_CONTRAST = '(prefers-contrast: more)';
const LESS_MOTION = '(prefers-reduced-motion: reduce)';

const root = document.documentElement;
const local = (): Storage => document.defaultView!.localStorage;

/** This test environment has no Web Storage, so each test gets an in-memory one. */
function installMemoryStorage(): void {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
  Object.defineProperty(document.defaultView!, 'localStorage', {
    value: storage,
    configurable: true,
  });
}

/** …and no `matchMedia`: this one answers per query, and tells its listeners of a change */
function installMatchMedia(initial: Record<string, boolean> = {}): {
  set: (query: string, matches: boolean) => void;
} {
  const state = new Map(Object.entries(initial));
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();
  const matchMedia = (query: string): MediaQueryList =>
    ({
      media: query,
      get matches() {
        return state.get(query) ?? false;
      },
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        if (!listeners.has(query)) listeners.set(query, new Set());
        listeners.get(query)!.add(listener);
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.get(query)?.delete(listener),
    }) as unknown as MediaQueryList;
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true });

  return {
    set: (query, matches) => {
      state.set(query, matches);
      listeners.get(query)?.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
}

const TWO_LANGUAGES = provideI18n({
  languages: [
    { code: 'en', name: 'English' },
    { code: 'sw', name: 'Kiswahili' },
  ],
});

function setUp(overrides: SettingsConfigOverrides = {}): SettingsService {
  TestBed.configureTestingModule({
    providers: [TWO_LANGUAGES, provideSettings({ storageKey: KEY, ...overrides })],
  });
  return TestBed.inject(SettingsService);
}

const store = (settings: Partial<AppSettings> | string): void =>
  local().setItem(KEY, typeof settings === 'string' ? settings : JSON.stringify(settings));

interface Applied {
  dark: boolean;
  contrast: string | null;
  motion: string | null;
  textSize: string | null;
  font: string | null;
  textSpacing: string | null;
  density: string | null;
}

/** what the service wrote on <html> for the stylesheets */
const applied = (): Applied => ({
  dark: root.classList.contains('dark'),
  contrast: root.getAttribute('data-contrast'),
  motion: root.getAttribute('data-motion'),
  textSize: root.getAttribute('data-text-size'),
  font: root.getAttribute('data-font'),
  textSpacing: root.getAttribute('data-text-spacing'),
  density: root.getAttribute('data-density'),
});

const NOTHING_APPLIED: Applied = {
  dark: false,
  contrast: null,
  motion: null,
  textSize: null,
  font: null,
  textSpacing: null,
  density: null,
};

describe('SettingsService', () => {
  beforeEach(() => installMemoryStorage());

  afterEach(() => {
    root.className = '';
    for (const name of [...root.getAttributeNames()]) {
      if (name.startsWith('data-')) root.removeAttribute(name);
    }
    root.lang = 'en';
    root.removeAttribute('style');
    document.head.querySelectorAll('link[data-readable-font]').forEach((link) => link.remove());
    Reflect.deleteProperty(window, 'matchMedia');
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('starts from the defaults and leaves the page as it is', () => {
    const service = setUp();
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.pristine()).toBe(true);
    expect(service.textScale()).toBe(1);
    expect(applied()).toEqual(NOTHING_APPLIED);
    expect(local().getItem(KEY)).toBeNull();
  });

  it('applies each change to <html> and saves it', () => {
    const service = setUp();

    service.update({ theme: 'dark', textSize: 'larger' });
    service.update({
      contrast: 'more',
      motion: 'reduced',
      font: 'readable',
      textSpacing: 'wide',
      density: 'compact',
    });

    expect(applied()).toEqual({
      dark: true,
      contrast: 'more',
      motion: 'reduced',
      textSize: 'larger',
      font: 'readable',
      textSpacing: 'wide',
      density: 'compact',
    });
    expect(service.dark()).toBe(true);
    expect(service.textScale()).toBe(1.25);
    expect(service.pristine()).toBe(false);
    expect(JSON.parse(local().getItem(KEY)!)).toMatchObject({
      theme: 'dark',
      textSize: 'larger',
      contrast: 'more',
      density: 'compact',
    });
  });

  it("adds the readable font's stylesheet once, when the font is first chosen", () => {
    const links = (): NodeListOf<HTMLLinkElement> =>
      document.head.querySelectorAll<HTMLLinkElement>('link[data-readable-font]');
    const service = setUp({ readableFontUrl: 'https://fonts.test/readable.css' });
    expect(links().length).toBe(0);

    service.update({ font: 'readable' });
    service.update({ font: 'default' });
    service.update({ font: 'readable' });

    expect(links().length).toBe(1);
    expect(links()[0].href).toBe('https://fonts.test/readable.css');
    expect(links()[0].rel).toBe('stylesheet');
  });

  it('restores what was stored, before anything renders', () => {
    store({ theme: 'dark', textSize: 'large', density: 'compact' });
    const service = setUp();

    expect(service.settings()).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      textSize: 'large',
      density: 'compact',
    });
    expect(applied()).toMatchObject({ dark: true, textSize: 'large', density: 'compact' });
  });

  it('drops stored values that are not among the choices, and survives a broken store', () => {
    store({ theme: 'neon', textSize: 'large', motion: 'full', density: 7 } as never);
    expect(setUp().settings()).toEqual({ ...DEFAULT_SETTINGS, textSize: 'large' });

    TestBed.resetTestingModule();
    store('{not json');
    expect(setUp().settings()).toEqual(DEFAULT_SETTINGS);

    TestBed.resetTestingModule();
    store('"a string"');
    expect(setUp().settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('"system" follows the device, and keeps following it', () => {
    const media = installMatchMedia({ [DARK]: true, [MORE_CONTRAST]: true, [LESS_MOTION]: true });
    const service = setUp();

    expect(service.dark()).toBe(true);
    expect(applied()).toMatchObject({ dark: true, contrast: 'more', motion: 'reduced' });

    media.set(DARK, false);
    media.set(MORE_CONTRAST, false);
    media.set(LESS_MOTION, false);
    TestBed.tick();

    expect(service.dark()).toBe(false);
    expect(applied()).toEqual(NOTHING_APPLIED);
  });

  it('an explicit choice wins over the device', () => {
    installMatchMedia({ [DARK]: true, [MORE_CONTRAST]: true });
    const service = setUp();

    service.update({ theme: 'light', contrast: 'standard' });
    expect(applied()).toMatchObject({ dark: false, contrast: null });

    service.update({ theme: 'dark', contrast: 'more' });
    expect(applied()).toMatchObject({ dark: true, contrast: 'more' });
  });

  it('takes its defaults from the app', () => {
    installMatchMedia({ [DARK]: true });
    const service = setUp({ defaults: { theme: 'light', density: 'compact' } });

    expect(service.settings().theme).toBe('light');
    expect(service.pristine()).toBe(true);
    expect(applied()).toMatchObject({ dark: false, density: 'compact' });
  });

  it('uses the browser\'s language on "system", and the chosen one otherwise', () => {
    const languages = vi.spyOn(window.navigator, 'languages', 'get');
    languages.mockReturnValue(['sw-TZ', 'en']);
    const service = setUp();
    const i18n = TestBed.inject(I18nService);

    expect(service.language()).toBe('sw');
    expect(i18n.language()).toBe('sw');
    expect(root.lang).toBe('sw');

    service.update({ language: 'en' });
    expect(i18n.language()).toBe('en');
    expect(root.lang).toBe('en');

    // a language the app doesn't offer falls back to the browser's
    service.update({ language: 'fr' });
    expect(service.language()).toBe('sw');

    languages.mockRestore();
  });

  it('resets to the defaults and forgets the stored choice', () => {
    const service = setUp();
    service.update({ theme: 'dark', textSpacing: 'wide', language: 'sw' });
    expect(local().getItem(KEY)).not.toBeNull();

    service.reset();

    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.pristine()).toBe(true);
    expect(applied()).toEqual(NOTHING_APPLIED);
    expect(local().getItem(KEY)).toBeNull();
  });

  it('follows a change made in another tab', () => {
    const service = setUp();
    const storageEvent = (key: string | null): Event => {
      const event = new Event('storage');
      Object.defineProperties(event, { key: { value: key }, storageArea: { value: local() } });
      return event;
    };

    store({ theme: 'dark', textSize: 'largest' });
    window.dispatchEvent(storageEvent('some.other.key'));
    TestBed.tick();
    expect(service.settings().theme).toBe('system');

    window.dispatchEvent(storageEvent(KEY));
    TestBed.tick();
    expect(service.settings()).toMatchObject({ theme: 'dark', textSize: 'largest' });
    expect(applied()).toMatchObject({ dark: true, textSize: 'largest' });
  });

  describe('the theme reveal', () => {
    let transitions: number;

    /** a browser with view transitions: the change is made inside one */
    function installViewTransitions(): void {
      transitions = 0;
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: (update: () => void) => {
          transitions++;
          update();
          return { finished: Promise.resolve() };
        },
      });
    }

    it('opens a change of theme from where it was made, and nothing else', async () => {
      installViewTransitions();
      const service = setUp();

      service.update({ theme: 'dark' }, { x: 120, y: 40 });
      expect(transitions).toBe(1);
      expect(applied().dark).toBe(true);
      expect(root.style.getPropertyValue('--reveal-x')).toBe('120px');
      expect(root.style.getPropertyValue('--reveal-y')).toBe('40px');
      expect(root.style.getPropertyValue('--reveal-radius')).not.toBe('');

      // the origin is cleared once the transition is over
      await Promise.resolve();
      await Promise.resolve();
      expect(root.style.getPropertyValue('--reveal-x')).toBe('');

      service.update({ textSize: 'large' });
      // dark → dark: the theme as shown doesn't change
      service.update({ theme: 'dark' });
      expect(transitions).toBe(1);
    });

    it('is skipped when motion is reduced', () => {
      installViewTransitions();
      const service = setUp();
      service.update({ motion: 'reduced' });

      service.update({ theme: 'dark' });
      expect(transitions).toBe(0);
      expect(applied().dark).toBe(true);
    });
  });
});
