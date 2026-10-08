import { Signal } from '@angular/core';
import { actionShortcut } from '@services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { TabNavItem } from './tab-nav.interface';
import { TabNavMessages } from './tab-nav.messages';

/**
 * A row of tabs' keyboard shortcuts — one target per `tab-nav`, wherever it is rendered: a
 * contents view's tabs, a details' groups, a page's own.
 */
export const TAB_NAV_SCOPE: ShortcutScope = { id: 'tab-nav', key: 't' };

/** what the shortcuts act on — each `TabNavComponent` hands it over */
export interface TabNavShortcutTarget {
  tabs: () => readonly TabNavItem[];
  activeKey: () => string | undefined;
  /** a tab was picked: the nav owns no selection, it says which (`tabSelect`) */
  select: (key: string) => void;
}

/**
 * Steps through the tabs that can be picked — a disabled one is passed over — wrapping at
 * either end. The arrow keys, on the tabs themselves, go on moving focus as they do.
 */
export function tabNavShortcuts(nav: TabNavShortcutTarget, t: Signal<TabNavMessages>): Shortcut[] {
  const text = () => t().shortcuts;
  const pickable = () => nav.tabs().filter((tab) => !tab.disabled);
  const active = () => pickable().find((tab) => tab.key === nav.activeKey());
  const several = () => pickable().length > 1;

  const go = (to: (index: number, count: number) => number): void => {
    const tabs = pickable();
    const index = tabs.findIndex((tab) => tab.key === nav.activeKey());
    const tab = tabs[(to(index, tabs.length) + tabs.length) % tabs.length];
    if (tab) nav.select(tab.key);
  };

  // where the row stands is the tab it is on: said once a step has been taken
  const stepping = { available: several, state: () => active()?.label };

  return [
    actionShortcut(
      'next',
      'n',
      () => text().next,
      () => go((index) => index + 1),
      stepping,
    ),
    actionShortcut(
      'previous',
      'p',
      () => text().previous,
      () => go((index) => index - 1),
      stepping,
    ),
    actionShortcut(
      'first',
      'f',
      () => text().first,
      () => go(() => 0),
      { available: several },
    ),
    actionShortcut(
      'last',
      'l',
      () => text().last,
      () => go((_, count) => count - 1),
      {
        available: several,
      },
    ),
  ];
}
