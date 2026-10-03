import { HttpHeaders } from '@angular/common/http';
import { InjectionToken, Provider } from '@angular/core';
import { FileKind, FileSourceResult, ViewerAttachment } from './file-viewer.interface';

/** What the `convert` hook learns about a file it may convert. */
export interface ConvertRequest {
  name: string;
  extension: string;
  mime: string;
  kind: FileKind;
  /** the original bytes, when they were already downloaded */
  blob?: Blob;
}

export interface OfficeOnlineConfig {
  /**
   * Opt-in: lets formats with no in-browser renderer (doc, xls, ppt, pptx…) be shown through
   * Microsoft's Office Online viewer. Microsoft's servers fetch the file, so it only works for files
   * at a public URL — and it hands the file to a third party. Default false.
   */
  enabled: boolean;
  /** must be https; the file's public URL is appended, encoded */
  viewerUrl: string;
  /** maps an attachment to a public URL Office Online can fetch (e.g. a signed link) */
  publicUrl?: (attachment: ViewerAttachment) => string | null | undefined;
  /** extensions sent there — default doc, docx, xls, xlsx, ppt, pptx (docx/xlsx only when the
   *  in-browser renderer can't open them) */
  extensions: string[];
}

export interface FileViewerConfig {
  /**
   * Turns an app storage path (`ViewerAttachment.filePath`) into bytes — e.g. GASCO's GraphQL
   * `readAttachment`, EWURA's `FileApi.streamFile`. Without it, `filePath` is fetched as a URL.
   */
  resolvePath?: (path: string, attachment: ViewerAttachment) => FileSourceResult;
  /**
   * Converts a format the browser can't render (doc, xls, ppt…) into one it can — usually a
   * server endpoint returning PDF. Return null/undefined to skip. Runs before Office Online.
   */
  convert?: (file: ConvertRequest, attachment: ViewerAttachment) => FileSourceResult;
  /** base relative URLs resolve against ('' keeps them relative to the app) */
  baseUrl: string;
  withCredentials: boolean;
  headers?: HttpHeaders | Record<string, string | string[]>;
  officeOnline: OfficeOnlineConfig;
  /** where `angular.json` copies pdf.js's worker, cmaps, fonts, wasm and css — trailing slash */
  pdfAssetsUrl: string;
  /** text is shown up to this many bytes (default 2 MB) */
  maxTextBytes: number;
  /** spreadsheet rows rendered per batch (default 200) */
  sheetPageSize: number;
  /** cells read from a sheet before it's cut off (default 2 000 000) */
  maxSheetCells: number;
  /** `FileViewerService.open()` dialog size */
  dialog: { width: string; maxWidth: string; height: string };
}

export const DEFAULT_FILE_VIEWER_CONFIG: FileViewerConfig = {
  baseUrl: '',
  withCredentials: false,
  officeOnline: {
    enabled: false,
    viewerUrl: 'https://view.officeapps.live.com/op/embed.aspx?src=',
    extensions: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  },
  pdfAssetsUrl: 'pdfjs/',
  maxTextBytes: 2 * 1024 * 1024,
  sheetPageSize: 200,
  maxSheetCells: 2_000_000,
  dialog: { width: '96vw', maxWidth: '1280px', height: '92vh' },
};

export const FILE_VIEWER_CONFIG = new InjectionToken<FileViewerConfig>('FILE_VIEWER_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_FILE_VIEWER_CONFIG,
});

export type FileViewerConfigOverrides = Partial<
  Omit<FileViewerConfig, 'officeOnline' | 'dialog'>
> & {
  officeOnline?: Partial<OfficeOnlineConfig>;
  dialog?: Partial<FileViewerConfig['dialog']>;
};

/**
 * Overrides part of `FileViewerConfig`. Pass a factory when the config needs DI — it runs in an
 * injection context: `provideFileViewerConfig(() => { const api = inject(FileApi); return {
 * resolvePath: (path) => api.streamFile(path) }; })`.
 */
export function provideFileViewerConfig(
  config: FileViewerConfigOverrides | (() => FileViewerConfigOverrides),
): Provider {
  return {
    provide: FILE_VIEWER_CONFIG,
    useFactory: (): FileViewerConfig => {
      const overrides = typeof config === 'function' ? config() : config;
      return {
        ...DEFAULT_FILE_VIEWER_CONFIG,
        ...overrides,
        officeOnline: { ...DEFAULT_FILE_VIEWER_CONFIG.officeOnline, ...overrides.officeOnline },
        dialog: { ...DEFAULT_FILE_VIEWER_CONFIG.dialog, ...overrides.dialog },
      };
    },
  };
}
