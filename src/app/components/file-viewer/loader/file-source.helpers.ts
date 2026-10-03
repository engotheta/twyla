import { HttpEventType, HttpHeaders, HttpResponse } from '@angular/common/http';
import { isObservable } from 'rxjs';
import { FileSource, ViewerAttachment } from '../file-viewer.interface';
import { extensionFromName, normalizeExtension, normalizeMime } from './file-kind.helpers';

/** What a file's metadata says about it — every field optional, merged from several places. */
export interface FileMeta {
  name?: string;
  extension?: string;
  mime?: string;
  size?: number;
}

/** The one source an attachment is loaded from (see `ViewerAttachment` for the precedence). */
export type PickedSource =
  | { type: 'blob'; value: Blob }
  | { type: 'src'; value: FileSource }
  | { type: 'base64'; value: string }
  | { type: 'url'; value: string }
  | { type: 'path'; value: string }
  | { type: 'none' };

export type StringSource = 'dataUrl' | 'blobUrl' | 'url' | 'base64';

const ATTACHMENT_KEYS: readonly (keyof ViewerAttachment)[] = [
  'src',
  'data',
  'dataBinary',
  'dataUrl',
  'url',
  'filePath',
  'blob',
  'file',
  'fileName',
  'attachmentTitle',
  'name',
  'extension',
  'mediaType',
  'mimeType',
  'type',
];

/** A plain object carrying at least one `ViewerAttachment` field (not a Blob, stream, promise…). */
export function isViewerAttachment(value: unknown): value is ViewerAttachment {
  if (typeof value !== 'object' || value === null) return false;
  if (
    value instanceof Blob ||
    isArrayBuffer(value) ||
    ArrayBuffer.isView(value) ||
    value instanceof Response ||
    value instanceof HttpResponse ||
    isReadableStream(value) ||
    isObservable(value) ||
    isPromiseLike(value) ||
    isHttpEvent(value)
  ) {
    return false;
  }
  return ATTACHMENT_KEYS.some((key) => key in value);
}

/** ArrayBuffer from any realm (an iframe, a worker, the test environment) — `instanceof` misses those */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]'
  );
}

export function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === 'function';
}

/** an Angular `HttpEvent` (Sent, progress, header, response…) — has a numeric `type` */
export function isHttpEvent(value: unknown): value is { type: HttpEventType } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'number' &&
    (value as { type: number }).type in HttpEventType
  );
}

const nonEmpty = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** Picks the attachment's source: `blob`/`file` → `src` → `data`/`dataBinary` → `dataUrl` → `url` → `filePath`. */
export function pickSource(a: ViewerAttachment): PickedSource {
  const blob = a.blob ?? a.file;
  if (blob instanceof Blob) return { type: 'blob', value: blob };
  if (a.src !== undefined && a.src !== null && a.src !== '') return { type: 'src', value: a.src };
  const data = nonEmpty(a.data) ?? nonEmpty(a.dataBinary) ?? nonEmpty(a.dataUrl);
  if (data) return { type: 'base64', value: data };
  const url = nonEmpty(a.url);
  if (url) return { type: 'url', value: url };
  const path = nonEmpty(a.filePath);
  if (path) return { type: 'path', value: path };
  return { type: 'none' };
}

/**
 * What the attachment says about itself, in order of trust: its file name fields, then (as
 * fallbacks) its title and the last segment of its URL / path.
 */
export function attachmentMeta(a: ViewerAttachment): FileMeta {
  return mergeMeta(explicitMeta(a), fallbackMeta(a));
}

/** Real file names (`fileName`, `name`, a File's name), the declared extension / MIME type and size. */
export function explicitMeta(a: ViewerAttachment): FileMeta {
  const file = a.file instanceof File ? a.file : undefined;
  const name = nonEmpty(a.fileName) ?? nonEmpty(a.name) ?? file?.name;
  const extension =
    normalizeExtension(a.extension) ||
    extensionFromName(a.fileName) ||
    extensionFromName(a.name) ||
    extensionFromName(file?.name);
  const mime =
    normalizeMime(a.mimeType) ||
    normalizeMime(a.mediaType) ||
    normalizeMime(a.type) ||
    normalizeMime((a.blob ?? a.file)?.type) ||
    dataUrlMime(nonEmpty(a.data) ?? nonEmpty(a.dataBinary) ?? nonEmpty(a.dataUrl));
  const size = a.size ?? a.mediaSize ?? (a.blob ?? a.file)?.size ?? undefined;
  return { name, extension: extension || undefined, mime: mime || undefined, size };
}

/** Weaker hints — a display title and the URL / path's last segment — that a server's
 *  `Content-Disposition` file name should beat. */
export function fallbackMeta(a: ViewerAttachment): FileMeta {
  const urlLike =
    nonEmpty(a.url) ?? nonEmpty(a.filePath) ?? (typeof a.src === 'string' ? a.src : undefined);
  const location = urlLike && classifyString(urlLike) === 'url' ? urlLike : undefined;
  const title = nonEmpty(a.attachmentTitle);
  const extension = extensionFromName(title) || (location ? extensionFromName(location) : '');
  return {
    name: title ?? (location ? basename(location) : undefined),
    extension: extension || undefined,
  };
}

/** Fills the gaps in `primary` from `fallback` — the caller's own fields always win. */
export function mergeMeta(primary: FileMeta, fallback: FileMeta): FileMeta {
  return {
    name: primary.name ?? fallback.name,
    extension: primary.extension ?? fallback.extension,
    mime: primary.mime ?? fallback.mime,
    size: primary.size ?? fallback.size,
  };
}

const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

/**
 * Tells string sources apart: `data:` → data URL, `blob:` → blob URL, anything with a character
 * base64 never contains (`.` `:` `?` `#` `%` space…) → URL, otherwise base64. Short strings without a
 * dot (`files/123`) read as URL paths, since real base64 file content is never that short.
 */
export function classifyString(value: string): StringSource {
  const s = value.trim();
  if (/^data:/i.test(s)) return 'dataUrl';
  if (/^blob:/i.test(s)) return 'blobUrl';
  const compact = s.replace(/\s+/g, '');
  if (compact.length >= 64 && BASE64.test(compact)) return 'base64';
  return 'url';
}

/** Schemes a URL source may use — anything else (`javascript:`, `file:`, `vbscript:`…) is refused. */
export function isAllowedUrl(url: string): boolean {
  const scheme = /^([a-z][a-z\d+\-.]*):/i.exec(url.trim())?.[1]?.toLowerCase();
  return !scheme || scheme === 'http' || scheme === 'https' || scheme === 'blob';
}

export function isHttpUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url.trim());
}

/** Decodes base64 (standard or url-safe, whitespace and missing padding tolerated). */
export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  let b64 = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (b64.length % 4) b64 += '='.repeat(4 - (b64.length % 4));
  const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array<ArrayBuffer> })
    .fromBase64;
  if (native) return native(b64);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** `data:[mime][;params][;base64],payload` → its bytes and MIME type. */
export function parseDataUrl(value: string): { bytes: Uint8Array<ArrayBuffer>; mime: string } {
  const comma = value.indexOf(',');
  if (comma < 0) throw new Error('Malformed data URL');
  const header = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  const params = header.split(';');
  const mime = normalizeMime(params[0]);
  const bytes = params.some((p) => p.trim().toLowerCase() === 'base64')
    ? decodeBase64(payload)
    : new TextEncoder().encode(decodeURIComponent(payload));
  return { bytes, mime };
}

function dataUrlMime(value: string | undefined): string {
  if (!value || !/^data:/i.test(value)) return '';
  return normalizeMime(value.slice(5, value.indexOf(',')).split(';')[0]);
}

/** Last path segment of a URL or path, decoded, without query/hash — undefined when empty. */
export function basename(location: string): string | undefined {
  const path = location.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  const segment = path.slice(path.lastIndexOf('/') + 1);
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** `attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf; filename="resume.pdf"` → `résumé.pdf` */
export function filenameFromContentDisposition(
  header: string | null | undefined,
): string | undefined {
  if (!header) return undefined;
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[2].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to the plain parameter
    }
  }
  const plain = /filename\s*=\s*("((?:[^"\\]|\\.)*)"|[^;]+)/i.exec(header);
  if (!plain) return undefined;
  const name = (plain[2] ?? plain[1]).replace(/\\(.)/g, '$1').trim();
  return name || undefined;
}

/** What response headers say about the file. */
export function metaFromHeaders(headers: HttpHeaders | Headers | null | undefined): FileMeta {
  if (!headers) return {};
  const name = filenameFromContentDisposition(headers.get('content-disposition'));
  const length = Number(headers.get('content-length'));
  return {
    name,
    extension: extensionFromName(name) || undefined,
    mime: normalizeMime(headers.get('content-type')) || undefined,
    size: Number.isFinite(length) && length > 0 ? length : undefined,
  };
}

/** `report` + `pdf` → `report.pdf`; a name that already ends in the extension is left alone. */
export function withExtension(name: string, extension: string): string {
  if (!extension || extensionFromName(name) === extension) return name;
  // jpg / jpeg, htm / html… — an equivalent extension already present is fine too
  const current = extensionFromName(name);
  if (current && EQUIVALENT[current] === extension) return name;
  return `${name}.${extension}`;
}

/** `report.final.pdf` → `report.final` */
export function stripExtension(name: string): string {
  const ext = extensionFromName(name);
  return ext ? name.slice(0, -(ext.length + 1)) : name;
}

const EQUIVALENT: Record<string, string> = {
  jpeg: 'jpg',
  jpg: 'jpeg',
  htm: 'html',
  tif: 'tiff',
  yml: 'yaml',
};

/** `1536` → `1.5 KB` */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
