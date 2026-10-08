import { Signal } from '@angular/core';
import { actionShortcut, toggleShortcut } from '@services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { ContentsLayout } from './contents.interface';
import { ContentsMessages } from './contents.messages';

/** The contents view's keyboard shortcuts — one target per level: the root, and each nested one. */
export const CONTENTS_SCOPE: ShortcutScope = { id: 'contents-view', key: 'c' };

/** what the shortcuts act on — each `ContentsViewComponent` hands it over for its own level */
export interface ContentsShortcutTarget {
  /** the level's params in force: as given, with the overrides laid over */
  params: () => ContentsLayout;
  overrides: () => ContentsLayout;
  /** lays a patch over the level's params for as long as it is on screen */
  override: (patch: ContentsLayout) => void;
  reset: () => void;
  contentCount: () => number;
  canResetSizes: () => boolean;
  resetSizes: () => void;
}

/**
 * How a level lays its contents out. Each shortcut switches one `ContentsLayout` option for that
 * level; those that cascade (resizing, collapsing, full screen) reach the levels inside it too.
 */
export function contentsShortcuts(
  contents: ContentsShortcutTarget,
  t: Signal<ContentsMessages>,
): Shortcut[] {
  const text = () => t().shortcuts;
  const params = contents.params;
  const several = { available: () => contents.contentCount() > 1 };
  const inTabs = () => params().showContentsInTabs === true;

  return [
    toggleShortcut(
      'tabs',
      't',
      () => text().tabs,
      inTabs,
      (showContentsInTabs) => contents.override({ showContentsInTabs }),
      several,
    ),
    toggleShortcut(
      'vertical',
      'o',
      () => text().vertical,
      () => params().tabsOrientation === 'vertical',
      (on) => contents.override({ tabsOrientation: on ? 'vertical' : 'horizontal' }),
      { available: () => inTabs() && contents.contentCount() > 1 },
    ),
    toggleShortcut(
      'resizable',
      'r',
      () => text().resizable,
      () => params().resizable === true,
      (resizable) => contents.override({ resizable }),
      several,
    ),
    toggleShortcut(
      'collapsible',
      'x',
      () => text().collapsible,
      () => params().collapsible === true,
      (collapsible) => contents.override({ collapsible }),
      several,
    ),
    toggleShortcut(
      'fullscreen',
      'f',
      () => text().fullscreen,
      () => params().fullscreenable === true,
      (fullscreenable) => contents.override({ fullscreenable }),
    ),
    toggleShortcut(
      'fit',
      'w',
      () => text().fit,
      () => params().contentsFit !== 'flow',
      (on) => contents.override({ contentsFit: on ? 'cover' : 'flow' }),
    ),
    actionShortcut('resetSizes', '=', () => text().resetSizes, contents.resetSizes, {
      available: contents.canResetSizes,
    }),
    actionShortcut('reset', '0', () => text().reset, contents.reset, {
      available: () => Object.keys(contents.overrides()).length > 0,
    }),
  ];
}
