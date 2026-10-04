import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';

// specific files, not barrels: a barrel loads every module it re-exports — with their Material
// imports — into the initial bundle, and the pages that need those load lazily anyway
import { provideFileViewerConfig } from './components/file-viewer/file-viewer-config.token';
import { provideLayoutConfig } from './layout/layout-config.token';
import { PageTitleStrategy } from './layout/page-title.strategy';
import { provideFetchConfig } from './services/fetch';
import { provideI18n } from './services/i18n/i18n-config.token';
import { languageInterceptor } from './services/i18n/language.interceptor';
import { injectPhrases } from './services/i18n/message-bundle';
import { provideSessionConfig } from './services/session/session-config.token';
import { sessionInterceptor } from './services/session/session.interceptor';
import { SessionService } from './services/session/session.service';
import { provideSettings } from './services/settings/provide-settings';
import { provideOverlayLandmark } from './services/view/landmark-overlay-container';
import { APP_ROUTES } from './app.routes';
import {
  demoNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './configs/demo-notifications';
import { DUMMYJSON_DEMO_CREDENTIALS, dummyJsonSessionApi } from './configs/dummyjson-session.api';
import { SAMPLE_PATHS } from './configs/demo-file-paths';
import { ROUTE_NAMES } from './configs/route-names';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // query params (`?token=`, `?returnUrl=`) arrive as page inputs
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    // document titles: "Data grid · Studio"
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    // requests carry the session's token, and the language the user reads (`Accept-Language`)
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor, languageInterceptor])),
    // the languages on offer; each feature ships its own text for them (`*.messages.ts`)
    provideI18n({
      languages: [
        { code: 'en', name: 'English', locale: 'en-GB' },
        { code: 'sw', name: 'Kiswahili', locale: 'sw-TZ' },
      ],
    }),
    // the user's own theme, language, text size, … — applied as the app starts. The key and the
    // default theme are also known to the script in index.html that prevents a light flash.
    provideSettings({ storageKey: 'studio.settings' }),
    // menus, selects and tooltips open under <body>: a named landmark there keeps them inside one
    provideOverlayLandmark(),
    // the demo pages talk to dummyjson.com, so their slugs resolve against it; the fetch demo's
    // GraphQL query goes to a public countries API
    provideFetchConfig({
      apiBaseUrl: 'https://dummyjson.com',
      graphqlUrl: 'https://countries.trevorblades.com',
    }),
    // the file-viewer demo: its "storage paths" resolve to public URLs, and Office Online is opted
    // into so the .pptx sample has a preview (apps leave it off unless their files may go to Microsoft)
    provideFileViewerConfig({
      resolvePath: (path) => ({ url: SAMPLE_PATHS[path] ?? path }),
      officeOnline: { enabled: true },
    }),
    // sign-in is real (dummyjson.com, emilys / emilyspass); sign-up and password resets are local
    provideSessionConfig(() => ({
      api: dummyJsonSessionApi(),
      storageKey: 'studio.session',
      tokenUrls: ['https://dummyjson.com/auth/'],
      demoCredentials: DUMMYJSON_DEMO_CREDENTIALS,
    })),
    provideLayoutConfig(() => {
      const session = inject(SessionService);
      return {
        brand: { name: 'Studio', tagline: 'An Angular starter built from reusable parts.' },
        user: session.user,
        canAccess: session.canAccess,
        signOut: () => void session.logout(),
        userMenu: [
          { route: '/account/profile', name: 'Profile', icon: 'person' },
          { route: '/account/security', name: 'Password & security', icon: 'lock' },
          { route: '/account/preferences', name: 'Preferences', icon: 'tune' },
        ],
        notifications: demoNotifications,
        onNotification: markNotificationRead,
        markAllRead: markAllNotificationsRead,
        footer: {
          owner: 'Studio',
          links: [
            { label: 'Home', route: '/home' },
            { label: 'Angular', href: 'https://angular.dev' },
          ],
          version: '0.0.0',
        },
        storageKey: 'studio.layout',
        // menu and page names are written in English in the routes: their other languages
        translate: injectPhrases(ROUTE_NAMES),
      };
    }),
  ],
};
