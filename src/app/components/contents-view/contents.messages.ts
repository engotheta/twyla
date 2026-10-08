import { defineMessages } from '@services/i18n/message-bundle';
import { CONTENTS_SW } from './contents.messages.sw';

export const CONTENTS_EN = {
  /** what a pane with no label, title or slug is called */
  panel: 'panel',
  resizeColumns: 'Resize columns',
  resizeRows: 'Resize rows',
  resizePanels: 'Resize panels',
  collapse: 'Collapse',
  collapsePane: (pane: string) => `Collapse ${pane}`,
  /** why the last expanded pane's collapse button does nothing */
  keepOneExpanded: 'At least one pane stays expanded',
  restorePane: (pane: string) => `Restore ${pane}`,
  fullScreen: 'Full screen',
  exitFullScreen: 'Exit full screen',
  fullScreenPane: (pane: string) => `Full screen: ${pane}`,
  exitFullScreenPane: (pane: string) => `Exit full screen: ${pane}`,

  /** the keyboard shortcuts (`contents.shortcuts.ts`): what each key switches */
  shortcuts: {
    scope: 'Contents view',
    tabs: 'Contents in tabs',
    vertical: 'Tabs down the side',
    resizable: 'Resizable panes',
    collapsible: 'Collapse buttons',
    fullscreen: 'Full-screen buttons',
    fit: 'Fit to the window',
    resetSizes: 'Even pane sizes',
    reset: 'Back to how it was set up',
  },
};

export type ContentsMessages = typeof CONTENTS_EN;

export const CONTENTS_MESSAGES = defineMessages('contents-view', CONTENTS_EN, { sw: CONTENTS_SW });
