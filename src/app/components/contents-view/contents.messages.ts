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
};

export type ContentsMessages = typeof CONTENTS_EN;

export const CONTENTS_MESSAGES = defineMessages('contents-view', CONTENTS_EN, { sw: CONTENTS_SW });
