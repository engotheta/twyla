import type { LayoutMessages } from './layout.messages';

export const LAYOUT_SW: LayoutMessages = {
  skipToMain: 'Ruka hadi maudhui makuu',
  modules: 'Moduli',
  allModules: 'Moduli zote',
  newTab: '(hufunguka kwenye kichupo kipya)',

  header: {
    toggleNavigation: 'Onyesha au ficha menyu',
    fullScreen: 'Skrini nzima',
    notifications: 'Arifa',
    unread: (count) => `${count} hazijasomwa`,
    unreadMark: '(haijasomwa)',
    allCaughtUp: 'Huna arifa mpya.',
    markAllRead: 'Weka zote kuwa zimesomwa',
    loadingPage: 'Ukurasa unapakia',
  },

  sidebar: {
    menu: (module) => `Menyu ya ${module}`,
    mainMenu: 'Menyu kuu',
    closeNavigation: 'Funga menyu',
    switchModule: 'Badili moduli',
    filterMenu: 'Chuja menyu',
    noMatch: (query) => `Hakuna ukurasa unaolingana na "${query}".`,
  },

  user: {
    account: (name) => `Akaunti: ${name}`,
    signOut: 'Ondoka',
    signIn: 'Ingia',
  },

  auth: {
    account: 'Akaunti',
    openModules: 'Fungua moduli',
    home: 'Mwanzo',
    signIn: 'Ingia',
    register: 'Jisajili',
  },

  footer: {
    rights: 'Haki zote zimehifadhiwa.',
    links: 'Kijachini',
  },

  page: {
    back: 'Rudi',
    view: 'Mwonekano',
    breadcrumb: 'Njia ya ukurasa',
    breadcrumbOf: (title) => `Njia ya ${title}`,
  },
};
