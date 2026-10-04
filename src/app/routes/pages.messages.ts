import { defineMessages } from '@services/i18n';
import { PAGES_SW } from './pages.messages.sw';

/**
 * The text of the pages that sit outside a module: the landing page, the modules page, "not
 * found" and the placeholder page. Marks in a text — `code` and **strong** — are shown as such
 * (`<rich-text>`).
 */
export const PAGES_EN = {
  home: {
    eyebrow: 'Angular starter',
    heading: 'Build admin apps from parts that already work',
    /** follows the brand's tagline */
    lead: 'Data grids, config-driven forms, a file viewer and a full app layout — accessible, signal-based, and ready to point at your API.',
    openModules: 'Open modules',
    getStarted: 'Get started',
    signIn: 'Sign in',
    featuresHeading: "What's inside",
    features: {
      grid: {
        title: 'Data grid',
        text: 'Local or server rows with sorting, filters, grouping, inline editing and export.',
      },
      forms: {
        title: 'Config-driven forms',
        text: 'Fields, lists, steps and cross-field rules from one config — sign-in forms included.',
      },
      details: {
        title: 'Details',
        text: 'Read-only records, grouped and formatted by type, with actions.',
      },
      viewer: {
        title: 'File viewer',
        text: 'PDF, Office, images, text and media from URLs, base64, blobs or streams.',
      },
      contents: {
        title: 'Contents view',
        text: 'Tables, details and forms composed into tabbed, resizable views.',
      },
      layout: {
        title: 'Layout & sessions',
        text: 'Modules, menus nested to any depth, page headers, sign-in, sign-up and password resets.',
      },
    },
    ctaHeading: 'Ready when you are',
    ctaText: 'Sign in with the demo account and open the modules.',
  },

  modules: {
    welcome: (firstName: string) => (firstName ? `Welcome back, ${firstName}` : 'Welcome back'),
    lead: 'Pick a module to get started.',
    empty: "You don't have access to any modules yet.",
    gettingStarted: 'Getting started',
    steps: {
      modules:
        '**Modules** are the `isMenu` routes in `app.routes.ts`: each loads a shell (`*.module.ts`) and its own routes (`*.routes.ts`).',
      menus:
        "**Side menus** come from each module's routes: `data: { isMenu, name, icon, permissions }` — a `path: ''` route with children is a group.",
      brand: '**Brand, header and footer**: `provideLayoutConfig()` in `app.config.ts`.',
      signIn:
        '**Sign-in**: point `provideSessionConfig({ api })` at your backend — the guards and the token interceptor are already wired.',
    },
  },

  notFound: {
    heading: 'Page not found',
    text: "The page you're looking for doesn't exist, or it has moved.",
    home: 'Go home',
    modules: 'All modules',
  },

  placeholder: {
    heading: 'Nothing here yet',
    text: 'This page is a placeholder. Give its route a real `loadComponent` to build it out.',
  },
};

export type PagesMessages = typeof PAGES_EN;

export const PAGES_MESSAGES = defineMessages('pages', PAGES_EN, { sw: PAGES_SW });
