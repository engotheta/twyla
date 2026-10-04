import { computed, DOCUMENT, inject, Injectable, Signal, signal } from '@angular/core';
import { I18N_CONFIG, MESSAGE_OVERRIDES } from './i18n-config.token';
import { LanguageOption, MessageBundle, PartialMessages, Phrases } from './i18n.interface';

/**
 * The language the app is showing, as signals, and each feature's text in it.
 *
 * A feature reads its text with `injectMessages(BUNDLE)`; an app picks the language with
 * `use(code)` — `SettingsService` does, from the user's setting. Text a language doesn't have
 * is shown in English, the language every bundle is written in.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly config = inject(I18N_CONFIG);
  private readonly overrides = inject(MESSAGE_OVERRIDES, { optional: true }) ?? [];
  private readonly document = inject(DOCUMENT);

  /** the languages on offer, in the order configured */
  readonly languages: readonly LanguageOption[] = this.config.languages;

  private readonly current = signal(
    this.supported(this.config.defaultLanguage) ?? this.languages[0].code,
  );

  /** the code of the language in use: 'en', 'sw' */
  readonly language = this.current.asReadonly();
  readonly option = computed(
    () => this.languages.find((language) => language.code === this.current()) ?? this.languages[0],
  );
  /** the BCP 47 tag to format dates and numbers with */
  readonly locale = computed(() => this.option().locale ?? this.option().code);

  private readonly cache = new Map<MessageBundle<object>, Signal<object>>();

  constructor() {
    this.document.documentElement.lang = this.current();
  }

  /** Switches language. False — and nothing changes — for one the app doesn't offer. */
  use(code: string): boolean {
    const match = this.supported(code);
    if (!match) return false;
    this.current.set(match);
    // WCAG 3.1.1: the page says what language it is in
    this.document.documentElement.lang = match;
    return true;
  }

  /** the offered language matching `code`: exactly, or by its base ('sw-TZ' → 'sw') */
  supported(code: string | undefined): string | undefined {
    if (!code) return undefined;
    const wanted = code.toLowerCase();
    const codes = this.languages.map((language) => language.code);
    return (
      codes.find((offered) => offered.toLowerCase() === wanted) ??
      codes.find((offered) => baseOf(offered) === baseOf(wanted))
    );
  }

  /** the first of the browser's preferred languages the app offers, else the default */
  preferred(): string {
    const navigator = this.document.defaultView?.navigator;
    const wanted = navigator?.languages?.length ? navigator.languages : [navigator?.language];
    for (const code of wanted) {
      const match = this.supported(code);
      if (match) return match;
    }
    return this.supported(this.config.defaultLanguage) ?? this.languages[0].code;
  }

  /** `bundle`'s text in the current language — what `injectMessages` returns */
  messages<T extends object>(bundle: MessageBundle<T>): Signal<T> {
    let text = this.cache.get(bundle);
    if (!text) {
      text = computed(() => this.resolve(bundle, this.current()));
      this.cache.set(bundle, text);
    }
    return text as Signal<T>;
  }

  /** `text` in the current language, as `phrases` has it — else `text` itself */
  phrase(phrases: Phrases, text: string): string {
    return pick(phrases, this.current())?.[text] ?? text;
  }

  /** English, then the bundle's own translation, then what the app provided — the last wins */
  private resolve<T extends object>(bundle: MessageBundle<T>, language: string): T {
    const layers = [
      pick(bundle.translations, language),
      ...this.overrides
        .filter((override) => override.bundle === bundle)
        .map((override) => pick(override.translations, language)),
    ];
    return mergeMessages(bundle.source, layers as (PartialMessages<T> | undefined)[]);
  }
}

function baseOf(code: string): string {
  return code.toLowerCase().split('-')[0];
}

/** a language's entry: its own, else its base language's ('sw-TZ' reads 'sw') */
function pick<V>(byLanguage: Readonly<Record<string, V>>, language: string): V | undefined {
  return byLanguage[language] ?? byLanguage[baseOf(language)];
}

function isGroup(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `source` with each piece of text replaced by the last layer that has it. The result always
 * has `source`'s shape: keys a layer adds are ignored, and so is a value of the wrong kind (a
 * string where the text takes a value, say).
 */
export function mergeMessages<T extends object>(
  source: T,
  layers: readonly (PartialMessages<T> | undefined)[],
): T {
  const groups = (layers as readonly unknown[]).filter(isGroup);
  return mergeGroup(source as Record<string, unknown>, groups) as T;
}

function mergeGroup(
  source: Record<string, unknown>,
  layers: readonly Record<string, unknown>[],
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const [key, base] of Object.entries(source)) {
    const candidates = layers.map((layer) => layer[key]);
    merged[key] = isGroup(base)
      ? mergeGroup(base, candidates.filter(isGroup))
      : (candidates.filter((value) => typeof value === typeof base).at(-1) ?? base);
  }
  return merged;
}
