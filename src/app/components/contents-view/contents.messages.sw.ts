import type { ContentsMessages } from './contents.messages';

export const CONTENTS_SW: ContentsMessages = {
  panel: 'paneli',
  resizeColumns: 'Badili upana wa safu wima',
  resizeRows: 'Badili urefu wa safu mlalo',
  resizePanels: 'Badili ukubwa wa paneli',
  collapse: 'Kunja',
  collapsePane: (pane) => `Kunja ${pane}`,
  keepOneExpanded: 'Angalau paneli moja hubaki wazi',
  restorePane: (pane) => `Rejesha ${pane}`,
  fullScreen: 'Skrini nzima',
  exitFullScreen: 'Ondoka kwenye skrini nzima',
  fullScreenPane: (pane) => `Skrini nzima: ${pane}`,
  exitFullScreenPane: (pane) => `Ondoka kwenye skrini nzima: ${pane}`,

  shortcuts: {
    scope: 'Mwonekano wa maudhui',
    tabs: 'Maudhui kwenye vichupo',
    vertical: 'Vichupo pembeni',
    resizable: 'Paneli zinazobadilika ukubwa',
    collapsible: 'Vitufe vya kukunja',
    fullscreen: 'Vitufe vya skrini nzima',
    fit: 'Tosheleza kwenye dirisha',
    resetSizes: 'Sawazisha ukubwa wa paneli',
    reset: 'Rejesha ilivyopangwa',
  },
};
