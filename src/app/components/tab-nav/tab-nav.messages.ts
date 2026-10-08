import { defineMessages } from '@services/i18n/message-bundle';
import { TAB_NAV_SW } from './tab-nav.messages.sw';

/** The tabs name themselves from what they are given; this is the text of their shortcuts. */
export const TAB_NAV_EN = {
  /** the keyboard shortcuts (`tab-nav.shortcuts.ts`): what each key does */
  shortcuts: {
    scope: 'Tabs',
    next: 'Next tab',
    previous: 'Previous tab',
    first: 'First tab',
    last: 'Last tab',
  },
};

export type TabNavMessages = typeof TAB_NAV_EN;

export const TAB_NAV_MESSAGES = defineMessages('tab-nav', TAB_NAV_EN, { sw: TAB_NAV_SW });
