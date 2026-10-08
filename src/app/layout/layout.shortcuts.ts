import { Signal } from '@angular/core';
import { actionShortcut, toggleShortcut } from '@services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { LayoutMessages } from './layout.messages';

/** The app frame: its navigation, and the way past it. */
export const LAYOUT_SCOPE: ShortcutScope = { id: 'layout', key: 'l' };

/** what the layout's shortcuts act on — `AppLayoutComponent` hands it over */
export interface LayoutShortcutTarget {
  sidebarVisible: () => boolean;
  toggleSidebar: () => void;
  /** moves focus to the page, past the header and the menus: the skip link's job */
  focusMain: () => void;
  goHome: () => void;
}

export function layoutShortcuts(
  target: LayoutShortcutTarget,
  t: Signal<LayoutMessages>,
): Shortcut[] {
  return [
    toggleShortcut(
      'sidebar',
      's',
      () => t().shortcuts.sidebar,
      target.sidebarVisible,
      target.toggleSidebar,
    ),
    actionShortcut('main', 'm', () => t().shortcuts.main, target.focusMain, { dismiss: true }),
    actionShortcut('home', 'h', () => t().allModules, target.goHome, { dismiss: true }),
  ];
}
