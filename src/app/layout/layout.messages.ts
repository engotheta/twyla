import { defineMessages } from '@services/i18n/message-bundle';
import { LAYOUT_SW } from './layout.messages.sw';

/** The app frame's own text. Menu and page names are the app's: `LayoutConfig.translate`. */
export const LAYOUT_EN = {
  skipToMain: 'Skip to main content',
  /** the module rail's landmark, and the modules list */
  modules: 'Modules',
  allModules: 'All modules',
  /** after the text of a link that leaves the app */
  newTab: '(opens in a new tab)',

  header: {
    toggleNavigation: 'Toggle navigation',
    fullScreen: 'Full screen',
    notifications: 'Notifications',
    unread: (count: number) => `${count} unread`,
    /** after an unread notification's title, for screen readers */
    unreadMark: '(unread)',
    allCaughtUp: "You're all caught up.",
    markAllRead: 'Mark all as read',
    loadingPage: 'Loading page',
  },

  sidebar: {
    /** the sidebar's landmark: "Components menu" */
    menu: (module: string) => `${module} menu`,
    mainMenu: 'Main menu',
    closeNavigation: 'Close navigation',
    switchModule: 'Switch module',
    filterMenu: 'Filter menu',
    noMatch: (query: string) => `No pages match "${query}".`,
  },

  user: {
    /** the user menu's button */
    account: (name: string) => `Account: ${name}`,
    signOut: 'Sign out',
    signIn: 'Sign in',
  },

  /** the public pages' header */
  auth: {
    account: 'Account',
    openModules: 'Open modules',
    home: 'Home',
    signIn: 'Sign in',
    register: 'Register',
  },

  footer: {
    rights: 'All rights reserved.',
    /** the footer links' landmark */
    links: 'Footer',
  },

  page: {
    back: 'Back',
    /** a page header's toggle group, when the page doesn't name it */
    view: 'View',
    breadcrumb: 'Breadcrumb',
    /** a section header's own trail: "Invoices breadcrumb" */
    breadcrumbOf: (title: string) => `${title} breadcrumb`,
  },
};

export type LayoutMessages = typeof LAYOUT_EN;

export const LAYOUT_MESSAGES = defineMessages('layout', LAYOUT_EN, { sw: LAYOUT_SW });
