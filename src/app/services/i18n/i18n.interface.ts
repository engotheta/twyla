/** A language the app offers. */
export interface LanguageOption {
  /** what translations are keyed by: 'en', 'sw' */
  code: string;
  /** its own name, in that language: 'English', 'Kiswahili' */
  name: string;
  /** the BCP 47 tag dates and numbers are formatted with ('en-GB', 'sw-TZ'); defaults to `code` */
  locale?: string;
}

export interface I18nConfig {
  /** the languages offered */
  languages: LanguageOption[];
  /** the one in use until `I18nService.use()` picks another */
  defaultLanguage: string;
}

/** one piece of text: fixed, or built from values (a name, a count) */
export type Message = string | ((...args: never[]) => string);

/**
 * A translation of `T`, the shape of a feature's English text. Any part may be left out — what
 * is missing is shown in English. Features type their own translations as `T` itself, so a key
 * they forget fails the build; apps overriding a few strings use this.
 */
export type PartialMessages<T> = {
  [K in keyof T]?: T[K] extends Message ? T[K] : PartialMessages<T[K]>;
};

/** A feature's text: English, plus what it ships in other languages (`defineMessages`). */
export interface MessageBundle<T extends object> {
  /** names the bundle in errors: 'data-grid' */
  readonly id: string;
  readonly source: T;
  /** by language code */
  readonly translations: Readonly<Record<string, PartialMessages<T>>>;
}

/**
 * For text an app writes once, in English, where it is used — route titles, menu names: that
 * English → each other language, by language code. Text with no entry stays as written.
 */
export type Phrases = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** what `provideMessages` registers: more translations for a bundle, or other wording */
export interface MessageOverride {
  bundle: MessageBundle<object>;
  translations: Readonly<Record<string, PartialMessages<object>>>;
}
