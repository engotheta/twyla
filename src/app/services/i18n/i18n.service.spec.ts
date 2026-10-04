import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18n } from './i18n-config.token';
import { I18nService } from './i18n.service';
import { languageInterceptor } from './language.interceptor';
import { defineMessages, injectMessages, provideMessages } from './message-bundle';

const GREETINGS_EN = {
  hello: 'Hello',
  bye: 'Goodbye',
  rows: (count: number) => (count === 1 ? '1 row' : `${count} rows`),
  menu: { open: 'Open', close: 'Close' },
};
type Greetings = typeof GREETINGS_EN;

// `bye` is left out on purpose: what a language lacks shows in English
const GREETINGS_SW: Omit<Greetings, 'bye'> = {
  hello: 'Habari',
  rows: (count) => `Safu ${count}`,
  menu: { open: 'Fungua', close: 'Funga' },
};
const GREETINGS = defineMessages('greetings', GREETINGS_EN, { sw: GREETINGS_SW });

const TWO_LANGUAGES = provideI18n({
  languages: [
    { code: 'en', name: 'English', locale: 'en-GB' },
    { code: 'sw', name: 'Kiswahili', locale: 'sw-TZ' },
  ],
});

describe('I18nService', () => {
  afterEach(() => (document.documentElement.lang = 'en'));

  it('offers English alone until languages are provided', () => {
    const i18n = TestBed.inject(I18nService);
    expect(i18n.language()).toBe('en');
    expect(i18n.locale()).toBe('en');
    expect(i18n.languages.map((language) => language.code)).toEqual(['en']);
    expect(i18n.use('sw')).toBe(false);
    expect(i18n.language()).toBe('en');
  });

  it('switches between the languages on offer, and says so on <html lang>', () => {
    TestBed.configureTestingModule({ providers: [TWO_LANGUAGES] });
    const i18n = TestBed.inject(I18nService);
    expect(i18n.language()).toBe('en');
    expect(i18n.locale()).toBe('en-GB');

    expect(i18n.use('sw')).toBe(true);
    expect(i18n.language()).toBe('sw');
    expect(i18n.locale()).toBe('sw-TZ');
    expect(i18n.option().name).toBe('Kiswahili');
    expect(document.documentElement.lang).toBe('sw');

    // a regional tag finds its language; one nobody offers changes nothing
    expect(i18n.use('en-US')).toBe(true);
    expect(i18n.language()).toBe('en');
    expect(i18n.use('fr')).toBe(false);
    expect(i18n.language()).toBe('en');
  });

  it('starts in the default language, the first listed unless one is named', () => {
    TestBed.configureTestingModule({
      providers: [
        provideI18n({
          languages: [
            { code: 'en', name: 'English' },
            { code: 'sw', name: 'Kiswahili' },
          ],
          defaultLanguage: 'sw',
        }),
      ],
    });
    expect(TestBed.inject(I18nService).language()).toBe('sw');
    expect(document.documentElement.lang).toBe('sw');
  });

  it("finds the browser's first language the app offers", () => {
    TestBed.configureTestingModule({ providers: [TWO_LANGUAGES] });
    const i18n = TestBed.inject(I18nService);
    const languages = vi.spyOn(window.navigator, 'languages', 'get');

    languages.mockReturnValue(['fr-FR', 'sw-TZ', 'en']);
    expect(i18n.preferred()).toBe('sw');
    languages.mockReturnValue(['fr-FR', 'de']);
    expect(i18n.preferred()).toBe('en');

    languages.mockRestore();
  });
});

describe('messages', () => {
  afterEach(() => (document.documentElement.lang = 'en'));

  it('reads a bundle in the current language, in English where a language has gaps', () => {
    TestBed.configureTestingModule({ providers: [TWO_LANGUAGES] });
    const i18n = TestBed.inject(I18nService);
    const t = i18n.messages(GREETINGS);

    expect(t().hello).toBe('Hello');
    expect(t().rows(1)).toBe('1 row');
    expect(t().menu.close).toBe('Close');

    i18n.use('sw');
    expect(t().hello).toBe('Habari');
    expect(t().rows(3)).toBe('Safu 3');
    expect(t().menu.close).toBe('Funga');
    expect(t().bye).toBe('Goodbye');

    // one signal per bundle, whoever asks
    expect(i18n.messages(GREETINGS)).toBe(t);
  });

  it("takes an app's own wording and languages over the bundle's, the last provided winning", () => {
    TestBed.configureTestingModule({
      providers: [
        provideI18n({
          languages: [
            { code: 'en', name: 'English' },
            { code: 'sw', name: 'Kiswahili' },
            { code: 'fr', name: 'Français' },
          ],
        }),
        provideMessages(GREETINGS, {
          en: { hello: 'Hi' },
          sw: { bye: 'Kwaheri', menu: { open: 'Anza' } },
          fr: { hello: 'Bonjour' },
        }),
        provideMessages(GREETINGS, { sw: { bye: 'Tutaonana' } }),
      ],
    });
    const i18n = TestBed.inject(I18nService);
    const t = i18n.messages(GREETINGS);

    expect(t().hello).toBe('Hi');
    expect(t().bye).toBe('Goodbye');

    i18n.use('sw');
    expect(t().hello).toBe('Habari');
    expect(t().bye).toBe('Tutaonana');
    expect(t().menu).toEqual({ open: 'Anza', close: 'Funga' });

    i18n.use('fr');
    expect(t().hello).toBe('Bonjour');
    expect(t().menu.open).toBe('Open');
  });

  it('keeps the English shape whatever a translation holds', () => {
    TestBed.configureTestingModule({
      providers: [
        TWO_LANGUAGES,
        provideMessages(GREETINGS, {
          // a string where the text takes a count, a group where it is a string, a stray key
          sw: { rows: 'safu', hello: { nested: 'x' }, extra: 'ignored' } as never,
        }),
      ],
    });
    const i18n = TestBed.inject(I18nService);
    i18n.use('sw');
    const text = i18n.messages(GREETINGS)();

    expect(text.rows(2)).toBe('Safu 2');
    expect(text.hello).toBe('Habari');
    expect(Object.keys(text)).toEqual(Object.keys(GREETINGS_EN));
  });

  it('re-renders a component when the language changes', async () => {
    @Component({ selector: 'greeter', template: `<p>{{ t().hello }} · {{ t().rows(count) }}</p>` })
    class GreeterComponent {
      protected readonly t = injectMessages(GREETINGS);
      protected readonly count = 2;
    }
    TestBed.configureTestingModule({ imports: [GreeterComponent], providers: [TWO_LANGUAGES] });
    const fixture = TestBed.createComponent(GreeterComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('Hello · 2 rows');

    TestBed.inject(I18nService).use('sw');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('Habari · Safu 2');
  });
});

describe('languageInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TWO_LANGUAGES,
        provideHttpClient(withInterceptors([languageInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    document.documentElement.lang = 'en';
  });

  it("sends the current language's locale, and leaves a header the request set itself", () => {
    http.get('/a').subscribe();
    expect(backend.expectOne('/a').request.headers.get('Accept-Language')).toBe('en-GB');

    TestBed.inject(I18nService).use('sw');
    http.get('/b').subscribe();
    expect(backend.expectOne('/b').request.headers.get('Accept-Language')).toBe('sw-TZ');

    http.get('/c', { headers: { 'Accept-Language': 'fr' } }).subscribe();
    expect(backend.expectOne('/c').request.headers.get('Accept-Language')).toBe('fr');
  });
});
