import { inject, Provider, Signal } from '@angular/core';
import { MESSAGE_OVERRIDES } from './i18n-config.token';
import { MessageBundle, MessageOverride, PartialMessages, Phrases } from './i18n.interface';
import { I18nService } from './i18n.service';

// ─────────────────────────────────────────────
// A feature's built-in text lives in a typed object, English first:
//
//   // grid.messages.ts
//   export const GRID_EN = {
//     clearSearch: 'Clear search',
//     remove: (name: string) => `Remove ${name}`,   // text built from a value is a function
//   };
//   export type GridMessages = typeof GRID_EN;
//   export const GRID_MESSAGES = defineMessages('data-grid', GRID_EN, { sw: GRID_SW });
//
//   // grid.messages.sw.ts — typed as the English shape, so a missing key fails the build
//   export const GRID_SW: GridMessages = { clearSearch: 'Futa utafutaji', remove: (name) => … };
//
//   // a component
//   protected readonly t = injectMessages(GRID_MESSAGES);   // {{ t().clearSearch }}
// ─────────────────────────────────────────────

/** A feature's text: `source` in English, `translations` by language code. */
export function defineMessages<T extends object>(
  id: string,
  source: T,
  translations: Readonly<Record<string, PartialMessages<T>>> = {},
): MessageBundle<T> {
  return { id, source, translations };
}

/**
 * `bundle`'s text in the current language. A signal: read it in the template (`t().save`) and the
 * text follows a language change. Call it in an injection context — a field initialiser.
 */
export function injectMessages<T extends object>(bundle: MessageBundle<T>): Signal<T> {
  return inject(I18nService).messages(bundle);
}

/**
 * A translator for text written in English where it is used — route titles and menu names:
 * `translate: injectPhrases({ sw: { 'Data grid': 'Jedwali la data' } })` for the layout. It reads
 * the current language each time it is called, so what calls it from a template or a `computed`
 * follows a language change. Call it in an injection context.
 */
export function injectPhrases(phrases: Phrases): (text: string) => string {
  const i18n = inject(I18nService);
  return (text) => i18n.phrase(phrases, text);
}

/**
 * An app's own wording for a feature's text, or a language the feature doesn't ship:
 * `provideMessages(GRID_MESSAGES, { sw: { clearSearch: 'Ondoa' }, fr: { … } })`. Whatever is left
 * out keeps the feature's own text; `en` rewords the English.
 */
export function provideMessages<T extends object>(
  bundle: MessageBundle<T>,
  translations: Readonly<Record<string, PartialMessages<T>>>,
): Provider {
  const override = { bundle, translations } as unknown as MessageOverride;
  return { provide: MESSAGE_OVERRIDES, multi: true, useValue: override };
}
