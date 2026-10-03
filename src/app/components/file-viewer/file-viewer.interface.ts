import { HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ActionButton } from '@components/action-buttons/action-button.interface';

/**
 * What a file renders as. `office` is a format with no client-side renderer (doc, xls, ppt, pptx…):
 * it goes to the app's `convert` hook, Office Online (opt-in) or the "preview not available" card.
 */
export type FileKind =
  | 'image'
  | 'pdf'
  | 'docx'
  | 'sheet'
  | 'csv'
  | 'text'
  | 'audio'
  | 'video'
  | 'office'
  | 'unsupported';

/** Something that eventually yields a file's bytes — the loader unwraps these recursively. */
export type FileSource =
  /** a URL (absolute, relative, `blob:`), a data URL, or raw base64 — told apart by its shape */
  | string
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | ReadableStream<Uint8Array>
  | Response
  | Observable<FileSourceResult>
  | Promise<FileSourceResult>
  /** lazy — runs only when the file is actually shown, so a gallery never fetches files nobody opens */
  | (() => Observable<FileSourceResult> | Promise<FileSourceResult>);

/** What a source may resolve to: another source, an Angular HTTP response/event, or a (partial)
 *  attachment carrying its own name and type — e.g. GASCO's `readAttachment` `{ data, mediaType }`. */
export type FileSourceResult =
  FileSource | HttpResponse<Blob> | HttpEvent<Blob> | Partial<ViewerAttachment> | null | undefined;

export interface ViewerTrack {
  src: string;
  srclang: string;
  label: string;
  kind?: 'captions' | 'subtitles' | 'descriptions';
  default?: boolean;
}

/**
 * One file to show. Field names line up with the apps' `BaseAttachment` / `AttachmentDtoInput`
 * (`data`, `dataBinary`, `filePath`, `fileName`, `attachmentTitle`, `mediaType`, `extension`…), so
 * their DTOs pass straight in. Set any ONE source; when several are set the first of
 * `blob`/`file` → `src` → `data`/`dataBinary` → `dataUrl` → `url` → `filePath` wins.
 */
export interface ViewerAttachment {
  /** generic source — strings are auto-classified (data URL / blob: / URL / base64) */
  src?: FileSource;
  /** base64 or a data URL */
  data?: string | null;
  dataBinary?: string | null;
  dataUrl?: string | null;
  /** fetched through `HttpClient`, so the app's auth interceptors apply */
  url?: string | null;
  /** app-specific storage path, turned into bytes by `FILE_VIEWER_CONFIG.resolvePath` */
  filePath?: string | null;
  blob?: Blob | null;
  file?: File | null;

  fileName?: string | null;
  attachmentTitle?: string | null;
  name?: string | null;
  /** `'pdf'` and `'.pdf'` are both fine — normalized to lowercase, no dot */
  extension?: string | null;
  /** a MIME type (`application/pdf`) or the bare subtype some APIs send (`pdf`) */
  mediaType?: string | null;
  mimeType?: string | null;
  type?: string | null;
  size?: number | null;
  mediaSize?: number | null;

  /** use `url` as-is instead of fetching it (no auth headers, but media can stream with range
   *  requests). Default: true for audio/video URLs, false otherwise. */
  direct?: boolean;
  /** `false` keeps this file away from Office Online even when the app enabled it */
  externalViewer?: boolean;
  /** a public http(s) URL Office Online can fetch, when it differs from `url` */
  publicUrl?: string | null;
  /** `<track>`s for video */
  tracks?: ViewerTrack[];
}

/** Anything a viewer accepts as "a file". */
export type ViewerAttachmentInput = ViewerAttachment | FileSource | Observable<ViewerAttachment>;

export type FileViewerToolbarItem =
  | 'download'
  | 'print'
  | 'openInNewTab'
  | 'fullscreen'
  | 'zoom'
  | 'rotate'
  | 'pages'
  | 'search'
  | 'thumbnails'
  | 'navigation';

/** Zoom request: a fit mode or a scale factor (1 = 100%). */
export type ZoomMode = 'fit' | 'fit-width' | 'actual';
export type ZoomValue = ZoomMode | number;

/**
 * Everything a viewer takes, as one object — a superset of the apps' `AttachmentParameter`, so
 * `{ attachment, title, showTitle, actionButtons }` call sites keep working.
 */
export interface FileViewerParameter {
  attachment?: ViewerAttachmentInput | null;
  /** several files — the viewer gets previous/next and a file menu */
  attachments?: readonly ViewerAttachmentInput[] | null;
  /** which of `attachments` to open first */
  index?: number;
  /** defaults to the file's name */
  title?: string;
  /** default true */
  showTitle?: boolean;
  /** dialog only — default true */
  showCloseBtn?: boolean;
  /** extra toolbar buttons; their `click` receives the resolved file */
  actionButtons?: ActionButton<ResolvedFile>[];
  /** hide toolbar items, e.g. `{ download: false, print: false }` */
  toolbar?: Partial<Record<FileViewerToolbarItem, boolean>>;
  initialZoom?: ZoomValue;
  /** PDFs: page to open on */
  initialPage?: number;
}

/** A file whose bytes (or public URL) are in hand and whose kind is known. */
export interface ResolvedFile {
  /** absent only for files viewed by URL alone (Office Online, streamed media) */
  blob?: Blob;
  /** URL the renderer may use directly (streamed media, Office Online) */
  directUrl?: string;
  /** file name, with extension */
  name: string;
  /** lowercase, no dot — `''` when unknown */
  extension: string;
  mime: string;
  kind: FileKind;
  size?: number;
  /** public http(s) URL, when known — what Office Online needs */
  publicUrl?: string;
  /** shown via the app's `convert` hook; `original` is the file as uploaded */
  converted?: boolean;
  original?: ResolvedFile;
  /** shown through Microsoft Office Online */
  external?: boolean;
  source: ViewerAttachment;
}

/** What `FileLoaderService.load$` emits. */
export type FileLoadEvent =
  { type: 'progress'; loaded: number; total?: number } | { type: 'done'; file: ResolvedFile };

/** A load failure the viewer can describe; `file` is set when the bytes arrived but can't be shown. */
export class FileViewerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly file?: ResolvedFile,
  ) {
    super(message);
    this.name = 'FileViewerError';
  }
}
