import { defineMessages } from '@services/i18n/message-bundle';
// type-only: file-viewer.interface.ts takes `FileViewerErrorCode` from this file
import type { FileViewerError } from './file-viewer.interface';
import { FILE_VIEWER_SW } from './file-viewer.messages.sw';

export const FILE_VIEWER_EN = {
  // ── the viewer's states ──
  loading: (name: string) => `Loading ${name}…`,
  /** the progress bar's name */
  loadingLabel: (name: string) => `Loading ${name}`,
  /** bytes so far: "1.2 MB of 4 MB" */
  progress: (loaded: string, total: string) => `${loaded} of ${total}`,
  empty: 'No file to show',
  cannotShow: "This file can't be shown",
  previewUnavailable: 'Preview not available',
  openingViewer: 'Opening viewer',
  viewerFailed: "The viewer couldn't load",
  checkConnection: 'Check your connection and try again.',

  /** a file with no name, and a type with none */
  file: 'File',
  fileNumber: (position: number) => `File ${position}`,
  /** in the details line, when a converted copy is on screen: "shown as PDF" */
  shownAs: (extension: string) => `shown as ${extension}`,
  viaOfficeOnline: 'via Office Online',
  noPreviewOffice: (extension: string) =>
    extension
      ? `There's no in-browser preview for ${extension} files. Download it to open it in its app.`
      : "There's no in-browser preview for this kind of file. Download it to open it in its app.",
  noPreview: (extension: string) =>
    extension
      ? `${extension} files can't be previewed. Download it to open it.`
      : "This kind of file can't be previewed. Download it to open it.",

  // what a screen reader hears when a file opens
  opened: (name: string) => `Opened ${name}`,
  openedOf: (position: number, total: number, name: string) =>
    `File ${position} of ${total}: ${name}`,

  /** by `FileViewerError.code` */
  errors: {
    notLoaded: 'This file could not be loaded.',
    nothingToShow: 'There is no file to show.',
    nothingToDownload: 'There is no file to download.',
    sourceNeverResolved: 'The file source never resolved.',
    loneEvent: 'A lone HTTP event carries no file.',
    unrecognised: 'Unrecognised file source.',
    linkNotAllowed: 'This file link is not allowed.',
    emptyFile: 'The server sent an empty file.',
    offline: "Couldn't reach the server — check your connection.",
    forbidden: "You don't have access to this file.",
    notFound: 'The file was not found.',
    linkExpired: 'The file link has expired.',
    streamFailed: 'The file stream failed.',
    server: (status: number) => `The server couldn't send the file (${status}).`,
    http: (status: number, statusText: string) =>
      `The file couldn't be loaded (${status}${statusText ? ' ' + statusText : ''}).`,
  },
  downloadFailed: (name: string) => `Couldn't download ${name}.`,
  downloadFailedUnnamed: "The file couldn't be downloaded.",
  printBlocked: "The browser didn't open the print dialog — try opening the file in a new tab.",

  actions: {
    tryAgain: 'Try again',
    officeOnline: 'Open with Office Online',
    openInNewTab: 'Open in new tab',
    download: 'Download',
    print: 'Print',
  },

  toolbar: {
    label: 'File viewer',
    thumbnails: 'Page thumbnails',
    find: 'Find in document',
    findTip: 'Find (Ctrl+F)',
    zoomOut: 'Zoom out',
    zoomOutTip: 'Zoom out (−)',
    zoomIn: 'Zoom in',
    zoomInTip: 'Zoom in (+)',
    /** the zoom menu's button: "Zoom 125%, choose a zoom level" */
    zoomMenu: (zoom: string) => `Zoom ${zoom}, choose a zoom level`,
    rotate: 'Rotate clockwise',
    rotateTip: 'Rotate (R)',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    pageNumber: 'Page number',
    /** after the page number box: "of 14" */
    ofPages: (count: number) => `of ${count}`,
    previousFile: 'Previous file',
    previousFileTip: 'Previous file (←)',
    nextFile: 'Next file',
    nextFileTip: 'Next file (→)',
    filesMenu: (position: number, total: number) => `File ${position} of ${total}, choose a file`,
    fullScreen: 'Full screen',
    exitFullScreen: 'Exit full screen',
    more: 'More',
    moreActions: 'More actions',
    close: 'Close',
    closeViewer: 'Close viewer',
  },

  /** the shortcuts the toolbar has no words for yet (`file-viewer.shortcuts.ts`) */
  shortcuts: {
    resetZoom: 'Reset zoom',
    titleBar: 'Title bar',
  },

  zoom: {
    fit: 'Fit to view',
    'fit-width': 'Fit width',
    actual: 'Actual size',
    // announced
    level: (percent: number) => `Zoom ${percent}%`,
    rotated: (degrees: number) => `Rotated to ${degrees} degrees`,
  },

  find: {
    label: 'Find in document',
    previous: 'Previous match',
    previousTip: 'Previous (Shift+Enter)',
    next: 'Next match',
    nextTip: 'Next (Enter)',
    matchCase: 'Match case',
    wholeWords: 'Whole words',
    close: 'Close find',
    closeTip: 'Close (Esc)',
    searching: 'Searching…',
    noMatches: 'No matches',
    /** "3 of 12", and "(wrapped)" once the search has gone round */
    matches: (current: number, total: number, wrapped: boolean) =>
      `${current} of ${total}${wrapped ? ' (wrapped)' : ''}`,
  },

  pdf: {
    document: (name: string) => `${name} — PDF document`,
    frame: (name: string) => `${name} — PDF`,
    /** the notice over the browser's own PDF viewer */
    native: (reason: string) =>
      `Shown with your browser's PDF viewer — the built-in viewer couldn't open it (${reason}).`,
    passwordPrompt: (name: string) =>
      `“${name}” is password-protected. Enter its password to open it.`,
    wrongPassword: 'Incorrect password — try again.',
    open: 'Open',
    opening: 'Opening PDF',
    thumbnails: 'Page thumbnails',
    page: (number: number) => `Page ${number}`,
    damaged: 'This PDF is damaged or not a PDF at all.',
    locked: 'This PDF could not be unlocked.',
    notDownloaded: 'The PDF could not be downloaded.',
    missingAssets: 'The PDF viewer could not start (its assets are missing).',
    failed: (reason: string) => `This PDF could not be opened (${reason}).`,
  },

  docx: {
    document: (name: string) => `${name} — Word document`,
    opening: 'Opening document',
    empty: 'There is no document to show.',
    failed: 'This Word document could not be opened — it may be damaged or in an older format.',
  },

  sheet: {
    spreadsheet: (name: string) => `${name} — spreadsheet`,
    /** names the tabs that pick a sheet */
    sheets: 'Sheets',
    headerRow: 'First row is the header',
    /** the corner cell, over the row numbers */
    row: 'Row',
    showMore: (shown: number, total: number) => `Show more rows (${shown} of ${total})`,
    truncated: 'This sheet is too large to show in full — download the file to see the rest.',
    opening: 'Opening spreadsheet',
    noSheets: 'This workbook has no visible sheets.',
    csvFailed: 'This file could not be read as CSV.',
    failed:
      'This workbook could not be opened — it may be damaged, protected or in the older .xls format.',
    /** announced when a sheet is picked */
    sheet: (name: string) => `Sheet ${name}`,
  },

  text: {
    wrap: 'Wrap lines',
    formatJson: 'Format JSON',
    truncated: (limit: string, size: string) =>
      `Showing the first ${limit} of ${size} — download the file to see all of it.`,
    contents: (name: string) => `${name} contents`,
    reading: 'Reading file…',
    empty: 'There is no text to show.',
    failed: 'This file could not be read as text.',
  },

  image: {
    /** the stage's role description */
    viewer: 'image viewer',
    failed: 'This image could not be displayed.',
  },

  media: {
    unplayable: "Your browser can't play this file — download it to play it elsewhere.",
  },

  office: {
    notice: 'Shown with Microsoft Office Online — Microsoft fetches the file from its public link.',
    frame: (name: string) => `${name} — Microsoft Office Online preview`,
  },
};

export type FileViewerMessages = typeof FILE_VIEWER_EN;
/** names one of the viewer's own error messages — `FileViewerError.code` */
export type FileViewerErrorCode = keyof FileViewerMessages['errors'];

/**
 * What went wrong, before it is put into words: text as written, or a pick from the viewer's
 * messages — which then follows the user's language for as long as it is on screen.
 */
export type FileFailure = string | ((text: FileViewerMessages) => string);

export function failureMessage(failure: FileFailure, text: FileViewerMessages): string {
  return typeof failure === 'string' ? failure : failure(text);
}

/** What to show for `error`: the viewer's own message for its `code`, in the language of
 *  `text`, or — for an error with no code, an app's own — its message as written. */
export function fileErrorMessage(
  error: FileViewerError,
  text: FileViewerMessages['errors'],
): string {
  switch (error.code) {
    case undefined:
      return error.message;
    case 'server':
      return text.server(error.status ?? 0);
    case 'http':
      return text.http(error.status ?? 0, error.detail ?? '');
    default:
      return text[error.code];
  }
}

export const FILE_VIEWER_MESSAGES = defineMessages('file-viewer', FILE_VIEWER_EN, {
  sw: FILE_VIEWER_SW,
});
