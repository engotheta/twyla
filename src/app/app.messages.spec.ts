import { TestBed } from '@angular/core/testing';
import type { Route } from '@angular/router';
import { appConfig } from './app.config';
import { APP_ROUTES } from './app.routes';
import { ACTION_BUTTONS_MESSAGES } from './components/action-buttons/action-buttons.messages';
import { CONTENTS_MESSAGES } from './components/contents-view/contents.messages';
import { GRID_MESSAGES } from './components/data-grid/grid.messages';
import { DETAILS_MESSAGES } from './components/details/details.messages';
import { FILE_VIEWER_MESSAGES } from './components/file-viewer/file-viewer.messages';
import { FORM_MESSAGES } from './components/generic-form/form.messages';
import { TAB_NAV_MESSAGES } from './components/tab-nav/tab-nav.messages';
import { ROUTE_NAMES } from './configs/route-names';
import { LAYOUT_CONFIG } from './layout/layout-config.token';
import { LAYOUT_MESSAGES } from './layout/layout.messages';
import { ACCOUNT_MESSAGES } from './routes/account/account.messages';
import { ADMIN_MESSAGES } from './routes/admin/admin.messages';
import { AUTH_MESSAGES } from './routes/auth/auth.messages';
import { PAGES_MESSAGES } from './routes/pages.messages';
import { FETCH_MESSAGES } from './services/fetch/fetch.messages';
import type { MessageBundle } from './services/i18n/i18n.interface';
import { MATERIAL_MESSAGES } from './services/i18n/material.messages';
import { LOADING_MESSAGES } from './services/loading/loading.messages';
import { NOTIFICATION_MESSAGES } from './services/notification/notification.messages';
import { SESSION_MESSAGES } from './services/session/session.messages';
import { SETTINGS_MESSAGES } from './services/settings/settings.messages';
import { SHORTCUTS_MESSAGES } from './services/shortcuts/shortcuts.messages';
import { VIEW_MESSAGES } from './services/view/view.messages';

/** every feature's text — a new `*.messages.ts` belongs in this list */
const BUNDLES = [
  ACCOUNT_MESSAGES,
  ACTION_BUTTONS_MESSAGES,
  ADMIN_MESSAGES,
  AUTH_MESSAGES,
  CONTENTS_MESSAGES,
  DETAILS_MESSAGES,
  FETCH_MESSAGES,
  FILE_VIEWER_MESSAGES,
  FORM_MESSAGES,
  GRID_MESSAGES,
  LAYOUT_MESSAGES,
  LOADING_MESSAGES,
  MATERIAL_MESSAGES,
  NOTIFICATION_MESSAGES,
  PAGES_MESSAGES,
  SESSION_MESSAGES,
  SETTINGS_MESSAGES,
  SHORTCUTS_MESSAGES,
  TAB_NAV_MESSAGES,
  VIEW_MESSAGES,
] as MessageBundle<object>[];

/** the languages the app offers besides English (`provideI18n` in `app.config.ts`) */
const LANGUAGES = ['sw'];

/** text that reads the same in every language: symbols, and what is printed on a key… */
const SAME_EVERYWHERE = new Set(['=', '!=', '>', '>=', '<', '<=', 'Esc']);
/** …and, by `bundle id:path`, messages that only arrange their values */
const SAME_FORMAT = new Set(['file-viewer:pdf.frame', 'settings:changed']);

type Leaf = string | ((...args: never[]) => unknown);

/** every message of a bundle, by its path: `['toolbar.close', 'Close']` */
function leaves(value: unknown, path = ''): [string, Leaf][] {
  if (typeof value === 'string' || typeof value === 'function') return [[path, value as Leaf]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, path ? `${path}.${key}` : key),
  );
}

function at(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], value);
}

/** an arrow function's body, which is where its words are: its parameters may be named anew */
const body = (fn: Leaf) => String(fn).replace(/^[^=]*=>\s*/, '');

describe('translations', () => {
  it('has one bundle per id', () => {
    const ids = BUNDLES.map((bundle) => bundle.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const language of LANGUAGES) {
    for (const bundle of BUNDLES) {
      it(`${language}: "${bundle.id}" has every message, and none left in English`, () => {
        const translation = bundle.translations[language];
        expect(translation).toBeDefined();
        const problems: string[] = [];
        for (const [path, english] of leaves(bundle.source)) {
          const translated = at(translation, path) as Leaf | undefined;
          if (translated === undefined) problems.push(`${path}: missing`);
          else if (typeof translated !== typeof english)
            problems.push(`${path}: not the same kind`);
          else if (typeof english === 'string') {
            if (translated === english && !SAME_EVERYWHERE.has(english)) {
              problems.push(`${path}: still "${english}"`);
            }
          } else if (
            body(translated) === body(english) &&
            !SAME_FORMAT.has(`${bundle.id}:${path}`)
          ) {
            problems.push(`${path}: still the English function`);
          }
        }
        // …and nothing the English no longer has
        for (const [path] of leaves(translation)) {
          if (at(bundle.source, path) === undefined) problems.push(`${path}: not in the English`);
        }
        expect(problems).toEqual([]);
      });
    }
  }
});

describe('route names', () => {
  /** what a route tree shows of itself: titles, menu names, descriptions, subtitles and tags */
  async function routeTexts(routes: readonly Route[]): Promise<string[]> {
    const texts: string[] = [];
    for (const route of routes) {
      const data = (route.data ?? {}) as Record<string, unknown>;
      const tag = (data['label'] as { value?: unknown } | undefined)?.value;
      for (const text of [route.title, data['name'], data['description'], data['subtitle'], tag]) {
        if (typeof text === 'string') texts.push(text);
      }
      const loaded: unknown = await (route.loadChildren as (() => unknown) | undefined)?.();
      const lazy = Array.isArray(loaded) ? loaded : (loaded as { default?: Route[] })?.default;
      texts.push(...(await routeTexts([...(route.children ?? []), ...(lazy ?? [])])));
    }
    return texts;
  }

  /** the text the layout config adds: the tagline, the user menu and the footer's links */
  function layoutTexts(): string[] {
    TestBed.configureTestingModule({ providers: [appConfig.providers] });
    const { brand, userMenu, footer } = TestBed.inject(LAYOUT_CONFIG);
    const texts = [
      brand.tagline,
      ...userMenu.map((item) => item.name),
      ...footer.links.map((link) => link.label),
    ];
    return texts.filter((text) => text !== undefined);
  }

  /** menu entries a module shell adds by hand (`MenuService.add()`), which no route carries */
  const ADDED_BY_HAND = ['Angular docs']; // layout-demo.module.ts

  it('has every route, menu and layout name in each language — and nothing else', async () => {
    const written = new Set([
      ...(await routeTexts(APP_ROUTES)),
      ...layoutTexts(),
      ...ADDED_BY_HAND,
    ]);
    expect(written.size).toBeGreaterThan(30);

    for (const language of LANGUAGES) {
      const phrases = ROUTE_NAMES[language] ?? {};
      const missing = [...written].filter((text) => phrases[text] === undefined);
      expect(missing, `${language}: names with no translation`).toEqual([]);
      const stale = Object.keys(phrases).filter((text) => !written.has(text));
      expect(stale, `${language}: translations of names nothing uses`).toEqual([]);
    }
  });
});
