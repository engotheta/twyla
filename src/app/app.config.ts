import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';

// specific files, not barrels: a barrel loads every module it re-exports — with their Material
// imports — into the initial bundle, and the pages that need those load lazily anyway
import { provideFileViewerConfig } from './components/file-viewer/file-viewer-config.token';
import { provideLayoutConfig } from './layout/layout-config.token';
import { PageTitleStrategy } from './layout/app-header/page-title.strategy';
import { provideFetchConfig } from './services/fetch';
import { provideSessionConfig } from './services/session/session-config.token';
import { sessionInterceptor } from './services/session/session.interceptor';
import { SessionService } from './services/session/session.service';
import { APP_ROUTES } from './app.routes';
import {
  demoNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './put-together/notifications';
import {
  DUMMYJSON_DEMO_CREDENTIALS,
  dummyJsonSessionApi,
} from './put-together/support/dummyjson-session.api';
import { SAMPLE_PATHS } from './put-together/support/sample-files';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // query params (`?token=`, `?returnUrl=`) arrive as page inputs
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    // document titles: "Data grid · Studio"
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor])),
    // the put-together demos talk to dummyjson.com, so their slugs resolve against it
    provideFetchConfig({ apiBaseUrl: 'https://dummyjson.com' }),
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
      };
    }),
  ],
};
