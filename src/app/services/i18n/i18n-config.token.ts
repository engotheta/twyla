import { InjectionToken, Provider } from '@angular/core';
import { I18nConfig, MessageOverride } from './i18n.interface';

export const DEFAULT_I18N_CONFIG: I18nConfig = {
  languages: [{ code: 'en', name: 'English' }],
  defaultLanguage: 'en',
};

export const I18N_CONFIG = new InjectionToken<I18nConfig>('I18N_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_I18N_CONFIG,
});

/** every `provideMessages()` in the app */
export const MESSAGE_OVERRIDES = new InjectionToken<MessageOverride[]>('MESSAGE_OVERRIDES');

/**
 * The languages the app offers:
 * `provideI18n({ languages: [{ code: 'en', name: 'English', locale: 'en-GB' },
 * { code: 'sw', name: 'Kiswahili', locale: 'sw-TZ' }] })`. Without `defaultLanguage`, the first
 * one listed is the default.
 */
export function provideI18n(config: Partial<I18nConfig>): Provider {
  const languages = config.languages?.length ? config.languages : DEFAULT_I18N_CONFIG.languages;
  return {
    provide: I18N_CONFIG,
    useValue: {
      languages,
      defaultLanguage: config.defaultLanguage ?? languages[0].code,
    } satisfies I18nConfig,
  };
}
