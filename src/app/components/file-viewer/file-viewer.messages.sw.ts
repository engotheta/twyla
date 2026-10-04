import type { FileViewerMessages } from './file-viewer.messages';

export const FILE_VIEWER_SW: FileViewerMessages = {
  loading: (name) => `Inapakia ${name}…`,
  loadingLabel: (name) => `Inapakia ${name}`,
  progress: (loaded, total) => `${loaded} kati ya ${total}`,
  empty: 'Hakuna faili la kuonyesha',
  cannotShow: 'Faili hili haliwezi kuonyeshwa',
  previewUnavailable: 'Hakiki haipatikani',
  openingViewer: 'Kitazamaji kinafunguka',
  viewerFailed: 'Kitazamaji kimeshindwa kupakia',
  checkConnection: 'Angalia muunganisho wako kisha ujaribu tena.',

  file: 'Faili',
  fileNumber: (position) => `Faili ${position}`,
  shownAs: (extension) => `linaonyeshwa kama ${extension}`,
  viaOfficeOnline: 'kupitia Office Online',
  noPreviewOffice: (extension) =>
    extension
      ? `Mafaili ya ${extension} hayana hakiki ndani ya kivinjari. Lipakue ili kulifungua kwenye programu yake.`
      : 'Aina hii ya faili haina hakiki ndani ya kivinjari. Lipakue ili kulifungua kwenye programu yake.',
  noPreview: (extension) =>
    extension
      ? `Mafaili ya ${extension} hayawezi kuhakikiwa. Lipakue ili kulifungua.`
      : 'Aina hii ya faili haiwezi kuhakikiwa. Lipakue ili kulifungua.',

  opened: (name) => `Limefunguliwa: ${name}`,
  openedOf: (position, total, name) => `Faili ${position} kati ya ${total}: ${name}`,

  errors: {
    notLoaded: 'Faili hili halikuweza kupakiwa.',
    nothingToShow: 'Hakuna faili la kuonyesha.',
    nothingToDownload: 'Hakuna faili la kupakua.',
    sourceNeverResolved: 'Chanzo cha faili hakikupatikana.',
    loneEvent: 'Tukio la HTTP pekee halina faili.',
    unrecognised: 'Chanzo cha faili hakitambuliki.',
    linkNotAllowed: 'Kiungo hiki cha faili hakiruhusiwi.',
    emptyFile: 'Seva imetuma faili tupu.',
    offline: 'Imeshindikana kuifikia seva — angalia muunganisho wako.',
    forbidden: 'Huna ruhusa ya kufungua faili hili.',
    notFound: 'Faili halikupatikana.',
    linkExpired: 'Muda wa kiungo cha faili umeisha.',
    streamFailed: 'Mtiririko wa faili umekatika.',
    server: (status) => `Seva imeshindwa kutuma faili (${status}).`,
    http: (status, statusText) =>
      `Faili halikuweza kupakiwa (${status}${statusText ? ' ' + statusText : ''}).`,
  },
  downloadFailed: (name) => `Imeshindikana kupakua ${name}.`,
  downloadFailedUnnamed: 'Faili halikuweza kupakuliwa.',
  printBlocked:
    'Kivinjari hakikufungua kidirisha cha kuchapisha — jaribu kufungua faili kwenye kichupo kipya.',

  actions: {
    tryAgain: 'Jaribu tena',
    officeOnline: 'Fungua kwa Office Online',
    openInNewTab: 'Fungua kwenye kichupo kipya',
    download: 'Pakua',
    print: 'Chapisha',
  },

  toolbar: {
    label: 'Kitazamaji cha faili',
    thumbnails: 'Vijipicha vya kurasa',
    find: 'Tafuta kwenye hati',
    findTip: 'Tafuta (Ctrl+F)',
    zoomOut: 'Punguza ukubwa',
    zoomOutTip: 'Punguza ukubwa (−)',
    zoomIn: 'Ongeza ukubwa',
    zoomInTip: 'Ongeza ukubwa (+)',
    zoomMenu: (zoom) => `Ukuzaji ${zoom}, chagua kiwango cha ukuzaji`,
    rotate: 'Zungusha kwa mwelekeo wa saa',
    rotateTip: 'Zungusha (R)',
    previousPage: 'Ukurasa uliotangulia',
    nextPage: 'Ukurasa unaofuata',
    pageNumber: 'Namba ya ukurasa',
    ofPages: (count) => `kati ya ${count}`,
    previousFile: 'Faili lililotangulia',
    previousFileTip: 'Faili lililotangulia (←)',
    nextFile: 'Faili linalofuata',
    nextFileTip: 'Faili linalofuata (→)',
    filesMenu: (position, total) => `Faili ${position} kati ya ${total}, chagua faili`,
    fullScreen: 'Skrini nzima',
    exitFullScreen: 'Ondoka kwenye skrini nzima',
    more: 'Zaidi',
    moreActions: 'Vitendo zaidi',
    close: 'Funga',
    closeViewer: 'Funga kitazamaji',
  },

  zoom: {
    fit: 'Tosheleza kwenye mwonekano',
    'fit-width': 'Tosheleza upana',
    actual: 'Ukubwa halisi',
    level: (percent) => `Ukuzaji ${percent}%`,
    rotated: (degrees) => `Imezungushwa hadi nyuzi ${degrees}`,
  },

  find: {
    label: 'Tafuta kwenye hati',
    previous: 'Tokeo lililotangulia',
    previousTip: 'Lililotangulia (Shift+Enter)',
    next: 'Tokeo linalofuata',
    nextTip: 'Linalofuata (Enter)',
    matchCase: 'Zingatia herufi kubwa na ndogo',
    wholeWords: 'Maneno kamili',
    close: 'Funga utafutaji',
    closeTip: 'Funga (Esc)',
    searching: 'Inatafuta…',
    noMatches: 'Hakuna matokeo',
    matches: (current, total, wrapped) =>
      `${current} kati ya ${total}${wrapped ? ' (imeanza upya)' : ''}`,
  },

  pdf: {
    document: (name) => `${name} — hati ya PDF`,
    frame: (name) => `${name} — PDF`,
    native: (reason) =>
      `Inaonyeshwa kwa kitazamaji cha PDF cha kivinjari chako — kitazamaji cha ndani kimeshindwa kuifungua (${reason}).`,
    passwordPrompt: (name) => `“${name}” inalindwa kwa nenosiri. Weka nenosiri lake ili kuifungua.`,
    wrongPassword: 'Nenosiri si sahihi — jaribu tena.',
    open: 'Fungua',
    opening: 'PDF inafunguka',
    thumbnails: 'Vijipicha vya kurasa',
    page: (number) => `Ukurasa ${number}`,
    damaged: 'PDF hii imeharibika au si PDF hata kidogo.',
    locked: 'PDF hii haikuweza kufunguliwa kwa nenosiri.',
    notDownloaded: 'PDF haikuweza kupakuliwa.',
    missingAssets: 'Kitazamaji cha PDF hakikuweza kuanza (vifaa vyake havipo).',
    failed: (reason) => `PDF hii haikuweza kufunguliwa (${reason}).`,
  },

  docx: {
    document: (name) => `${name} — hati ya Word`,
    opening: 'Hati inafunguka',
    empty: 'Hakuna hati ya kuonyesha.',
    failed:
      'Hati hii ya Word haikuweza kufunguliwa — huenda imeharibika au iko katika muundo wa zamani.',
  },

  sheet: {
    spreadsheet: (name) => `${name} — lahajedwali`,
    sheets: 'Laha',
    headerRow: 'Safu ya kwanza ni kichwa',
    row: 'Safu',
    showMore: (shown, total) => `Onyesha safu zaidi (${shown} kati ya ${total})`,
    truncated: 'Laha hii ni kubwa mno kuonyeshwa yote — pakua faili ili kuona iliyobaki.',
    opening: 'Lahajedwali inafunguka',
    noSheets: 'Kitabu hiki cha kazi hakina laha zinazoonekana.',
    csvFailed: 'Faili hili halikuweza kusomwa kama CSV.',
    failed:
      'Kitabu hiki cha kazi hakikuweza kufunguliwa — huenda kimeharibika, kimelindwa au kiko katika muundo wa zamani wa .xls.',
    sheet: (name) => `Laha ${name}`,
  },

  text: {
    wrap: 'Kunja mistari',
    formatJson: 'Panga JSON',
    truncated: (limit, size) =>
      `Inaonyesha ${limit} za kwanza kati ya ${size} — pakua faili ili kuliona lote.`,
    contents: (name) => `Maudhui ya ${name}`,
    reading: 'Faili linasomwa…',
    empty: 'Hakuna maandishi ya kuonyesha.',
    failed: 'Faili hili halikuweza kusomwa kama maandishi.',
  },

  image: {
    viewer: 'kitazamaji cha picha',
    failed: 'Picha hii haikuweza kuonyeshwa.',
  },

  media: {
    unplayable: 'Kivinjari chako hakiwezi kucheza faili hili — lipakue ili kulicheza kwingine.',
  },

  office: {
    notice:
      'Inaonyeshwa kwa Microsoft Office Online — Microsoft huchukua faili kutoka kwenye kiungo chake cha umma.',
    frame: (name) => `${name} — hakiki ya Microsoft Office Online`,
  },
};
