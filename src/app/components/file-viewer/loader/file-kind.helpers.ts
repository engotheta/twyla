import { FileKind } from '../file-viewer.interface';

/** A file's kind together with the extension and MIME type it's shown (and downloaded) as. */
export interface KindInfo {
  kind: FileKind;
  /** lowercase, no dot — '' when unknown */
  extension: string;
  mime: string;
}

export interface FileHints {
  extension?: string;
  mime?: string;
}

/** Bytes `sniffKind` looks at — enough for every signature below, ZIP entry names included. */
export const SNIFF_BYTES = 8192;

const GENERIC_MIMES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/binary',
  'application/unknown',
  'application/x-download',
  'application/force-download',
  'application/download',
]);

/** extension → [kind, MIME]; the single source for both lookups */
const EXTENSIONS: Record<string, [FileKind, string]> = {
  pdf: ['pdf', 'application/pdf'],

  png: ['image', 'image/png'],
  apng: ['image', 'image/apng'],
  jpg: ['image', 'image/jpeg'],
  jpeg: ['image', 'image/jpeg'],
  jfif: ['image', 'image/jpeg'],
  pjpeg: ['image', 'image/jpeg'],
  gif: ['image', 'image/gif'],
  webp: ['image', 'image/webp'],
  avif: ['image', 'image/avif'],
  svg: ['image', 'image/svg+xml'],
  bmp: ['image', 'image/bmp'],
  ico: ['image', 'image/x-icon'],
  // browsers (bar Safari) can't decode these
  tif: ['unsupported', 'image/tiff'],
  tiff: ['unsupported', 'image/tiff'],
  heic: ['unsupported', 'image/heic'],
  heif: ['unsupported', 'image/heif'],

  docx: ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  docm: ['docx', 'application/vnd.ms-word.document.macroEnabled.12'],
  dotx: ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template'],
  xlsx: ['sheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xlsm: ['sheet', 'application/vnd.ms-excel.sheet.macroEnabled.12'],
  xltx: ['sheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.template'],
  csv: ['csv', 'text/csv'],
  tsv: ['csv', 'text/tab-separated-values'],

  doc: ['office', 'application/msword'],
  dot: ['office', 'application/msword'],
  rtf: ['office', 'application/rtf'],
  xls: ['office', 'application/vnd.ms-excel'],
  xlt: ['office', 'application/vnd.ms-excel'],
  ppt: ['office', 'application/vnd.ms-powerpoint'],
  pps: ['office', 'application/vnd.ms-powerpoint'],
  pptx: ['office', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ppsx: ['office', 'application/vnd.openxmlformats-officedocument.presentationml.slideshow'],
  odt: ['office', 'application/vnd.oasis.opendocument.text'],
  ods: ['office', 'application/vnd.oasis.opendocument.spreadsheet'],
  odp: ['office', 'application/vnd.oasis.opendocument.presentation'],

  mp3: ['audio', 'audio/mpeg'],
  wav: ['audio', 'audio/wav'],
  oga: ['audio', 'audio/ogg'],
  ogg: ['audio', 'audio/ogg'],
  opus: ['audio', 'audio/ogg'],
  m4a: ['audio', 'audio/mp4'],
  aac: ['audio', 'audio/aac'],
  flac: ['audio', 'audio/flac'],
  weba: ['audio', 'audio/webm'],
  mp4: ['video', 'video/mp4'],
  m4v: ['video', 'video/mp4'],
  webm: ['video', 'video/webm'],
  ogv: ['video', 'video/ogg'],
  mov: ['video', 'video/quicktime'],
  avi: ['unsupported', 'video/x-msvideo'],
  mkv: ['unsupported', 'video/x-matroska'],

  txt: ['text', 'text/plain'],
  text: ['text', 'text/plain'],
  log: ['text', 'text/plain'],
  md: ['text', 'text/markdown'],
  markdown: ['text', 'text/markdown'],
  json: ['text', 'application/json'],
  geojson: ['text', 'application/geo+json'],
  xml: ['text', 'application/xml'],
  html: ['text', 'text/html'],
  htm: ['text', 'text/html'],
  css: ['text', 'text/css'],
  scss: ['text', 'text/x-scss'],
  js: ['text', 'text/javascript'],
  mjs: ['text', 'text/javascript'],
  ts: ['text', 'text/x-typescript'],
  yaml: ['text', 'application/yaml'],
  yml: ['text', 'application/yaml'],
  ini: ['text', 'text/plain'],
  conf: ['text', 'text/plain'],
  cfg: ['text', 'text/plain'],
  env: ['text', 'text/plain'],
  sql: ['text', 'application/sql'],
  sh: ['text', 'text/x-shellscript'],
  bat: ['text', 'text/plain'],
  ps1: ['text', 'text/plain'],
  py: ['text', 'text/x-python'],
  java: ['text', 'text/x-java'],
  kt: ['text', 'text/plain'],
  cs: ['text', 'text/plain'],
  c: ['text', 'text/x-c'],
  h: ['text', 'text/x-c'],
  cpp: ['text', 'text/x-c'],
  go: ['text', 'text/plain'],
  rs: ['text', 'text/plain'],
  rb: ['text', 'text/plain'],
  php: ['text', 'text/plain'],
  graphql: ['text', 'application/graphql'],
  srt: ['text', 'text/plain'],
  vtt: ['text', 'text/vtt'],

  zip: ['unsupported', 'application/zip'],
  rar: ['unsupported', 'application/vnd.rar'],
  '7z': ['unsupported', 'application/x-7z-compressed'],
  gz: ['unsupported', 'application/gzip'],
  tar: ['unsupported', 'application/x-tar'],
};

/** MIME → extension, for MIME types that aren't simply the first match in `EXTENSIONS` */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/x-png': 'png',
  'image/svg': 'svg',
  'image/vnd.microsoft.icon': 'ico',
  'audio/mp3': 'mp3',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'video/ogg': 'ogv',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/xml': 'xml',
  'application/xml': 'xml',
  'application/json': 'json',
  'text/json': 'json',
  'application/x-javascript': 'js',
  'application/javascript': 'js',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/x-zip-compressed': 'zip',
  'application/x-pdf': 'pdf',
  'text/comma-separated-values': 'csv',
  'application/csv': 'csv',
};

const MIME_TO_EXTENSION: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [ext, [, mime]] of Object.entries(EXTENSIONS)) map[mime] ??= ext;
  return { ...map, ...MIME_EXTENSIONS };
})();

/** `'.PDF'`, `'pdf'`, `' Pdf '` → `'pdf'`. A MIME type passed by mistake maps to its extension. */
export function normalizeExtension(value: string | null | undefined): string {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('/')) return MIME_TO_EXTENSION[normalizeMime(raw)] ?? '';
  return raw.replace(/^\.+/, '');
}

/**
 * `'Application/PDF; charset=x'` → `'application/pdf'`. A bare subtype (`'pdf'`, `'png'` — what
 * some APIs put in `mediaType`) maps through the extension table; generic types become `''`.
 */
export function normalizeMime(value: string | null | undefined): string {
  const raw = (value ?? '').split(';')[0].trim().toLowerCase();
  if (!raw) return '';
  const mime = raw.includes('/') ? raw : (EXTENSIONS[raw.replace(/^\.+/, '')]?.[1] ?? '');
  return GENERIC_MIMES.has(mime) ? '' : mime;
}

/** The extension in a file name or URL path (query and hash ignored) — '' when there is none. */
export function extensionFromName(name: string | null | undefined): string {
  if (!name) return '';
  const path = name.split(/[?#]/, 1)[0];
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? normalizeExtension(base.slice(dot + 1)) : '';
}

export function mimeForExtension(extension: string): string {
  return EXTENSIONS[extension]?.[1] ?? '';
}

export function extensionForMime(mime: string): string {
  return MIME_TO_EXTENSION[mime] ?? '';
}

/** What a file's declared extension / MIME type say it is — undefined when they say nothing useful. */
export function kindFromHints({ extension = '', mime = '' }: FileHints): KindInfo | undefined {
  const byExtension = EXTENSIONS[extension];
  if (byExtension) {
    const [kind, extMime] = byExtension;
    // keep a specific declared MIME of the same family (e.g. text/csv;charset → text/csv)
    return { kind, extension, mime: mime && kindOfMime(mime) === kind ? mime : extMime };
  }
  if (!mime) return undefined;
  const kind = kindOfMime(mime);
  return kind ? { kind, extension: extension || extensionForMime(mime), mime } : undefined;
}

function kindOfMime(mime: string): FileKind | undefined {
  const ext = MIME_TO_EXTENSION[mime];
  if (ext && EXTENSIONS[ext]) return EXTENSIONS[ext][0];
  if (mime.startsWith('image/')) return 'unsupported';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('text/')) return 'text';
  if (/[+/](json|xml)$/.test(mime)) return 'text';
  if (mime.startsWith('application/vnd.oasis.opendocument')) return 'office';
  if (mime.includes('wordprocessingml')) return 'docx';
  if (mime.includes('spreadsheetml')) return 'sheet';
  if (mime.includes('presentationml') || mime.includes('ms-')) return 'office';
  return undefined;
}

/** A signature match. `definitive` ones override a contradicting label (servers lie about types). */
interface Sniffed extends KindInfo {
  definitive: boolean;
  /** a ZIP / OLE2 container whose exact format the bytes don't reveal */
  container?: 'zip' | 'ole2';
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);

function sniffed(extension: string, definitive = true, container?: Sniffed['container']): Sniffed {
  const [kind, mime] = EXTENSIONS[extension];
  return { kind, extension, mime, definitive, container };
}

/** Identifies a file from its first bytes (`SNIFF_BYTES` is plenty). */
export function sniffKind(bytes: Uint8Array): Sniffed | undefined {
  if (!bytes.length) return undefined;
  const latin = ascii(bytes, 0, Math.min(bytes.length, 1024));

  if (latin.includes('%PDF-')) return sniffed('pdf');
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return sniffed('png');
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return sniffed('jpg');
  if (latin.startsWith('GIF8')) return sniffed('gif');
  if (latin.startsWith('RIFF') && ascii(bytes, 8, 4) === 'WEBP') return sniffed('webp');
  if (latin.startsWith('RIFF') && ascii(bytes, 8, 4) === 'WAVE') return sniffed('wav');
  if (latin.startsWith('RIFF') && ascii(bytes, 8, 4) === 'AVI ') return sniffed('avi');
  if (
    latin.startsWith('BM') &&
    bytes.length > 9 &&
    bytes[6] === 0 &&
    bytes[7] === 0 &&
    bytes[8] === 0 &&
    bytes[9] === 0
  ) {
    return sniffed('bmp');
  }
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) && bytes.length > 4 && bytes[4] > 0)
    return sniffed('ico');

  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return sniffed('avif');
    if (/^hei[cx]|^mif1|^msf1/.test(brand)) return sniffed('heic');
    if (brand === 'M4A ' || brand === 'M4B ') return sniffed('m4a');
    if (brand === 'qt  ') return sniffed('mov');
    return sniffed('mp4');
  }
  if (latin.startsWith('ID3')) return sniffed('mp3');
  if (latin.startsWith('OggS')) return sniffed('ogg', false); // audio or video — a hint may say which
  if (latin.startsWith('fLaC')) return sniffed('flac');
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return sniffed('webm', false); // webm or mkv

  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const entries = ascii(bytes, 0, bytes.length);
    if (entries.includes('word/')) return sniffed('docx');
    if (entries.includes('xl/')) return sniffed('xlsx');
    if (entries.includes('ppt/')) return sniffed('pptx');
    const odf =
      /mimetypeapplication\/vnd\.oasis\.opendocument\.(text|spreadsheet|presentation)/.exec(
        entries,
      );
    if (odf) return sniffed({ text: 'odt', spreadsheet: 'ods', presentation: 'odp' }[odf[1]]!);
    return sniffed('zip', true, 'zip');
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { kind: 'office', extension: '', mime: '', definitive: true, container: 'ole2' };
  }
  if (latin.startsWith('{\\rtf')) return sniffed('rtf');

  if (isProbablyText(bytes)) {
    const head = latin.replace(/^﻿|^\xEF\xBB\xBF/, '').trimStart();
    if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
      return sniffed('svg');
    }
    return sniffed('txt', false);
  }
  return undefined;
}

/** No NUL bytes and valid UTF-8 (a multi-byte character cut off at the end is fine) — or UTF-16 with a BOM. */
export function isProbablyText(bytes: Uint8Array): boolean {
  if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) return true;
  if (bytes.includes(0)) return false;
  for (let trim = 0; trim < 4 && trim < bytes.length; trim++) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytes.length - trim));
      return true;
    } catch {
      // a truncated character at the end — retry without the last byte(s)
    }
  }
  // not UTF-8: accept single-byte text (windows-1252) when control characters are rare
  let control = 0;
  for (const b of bytes) if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  return control / bytes.length < 0.05;
}

/**
 * Decides what a file is, from its declared extension / MIME type and (when available) its first
 * bytes. A definite signature beats the label — a PDF served as `text/plain` still shows as a PDF —
 * except that a container signature (ZIP, OLE2) can't tell docx from xlsx from pptx on its own, so
 * there the label decides.
 */
export function resolveKind(hints: FileHints, head?: Uint8Array): KindInfo {
  const hinted = kindFromHints(hints);
  const bytes = head ? sniffKind(head) : undefined;

  if (bytes?.container && hinted && ['docx', 'sheet', 'office'].includes(hinted.kind))
    return hinted;
  if (bytes?.container === 'ole2') {
    // a legacy Office file (doc / xls / ppt / msg…) — which one only its label could say
    return { kind: 'office', extension: '', mime: 'application/x-ole-storage' };
  }
  if (bytes?.definitive) {
    // same kind as declared → keep the declared extension (jpeg vs jpg) and MIME
    return hinted && hinted.kind === bytes.kind ? hinted : stripSniff(bytes);
  }
  if (hinted) {
    // a binary file labelled as text can't be shown as text
    if ((hinted.kind === 'text' || hinted.kind === 'csv') && head && !bytes) {
      return { ...hinted, kind: 'unsupported' };
    }
    return hinted;
  }
  if (bytes) {
    // weak signatures: ogg / webm / plain text
    if (bytes.extension === 'txt' && head)
      return { kind: 'text', extension: 'txt', mime: 'text/plain' };
    return stripSniff(bytes);
  }
  return { kind: 'unsupported', extension: hints.extension ?? '', mime: hints.mime ?? '' };
}

function stripSniff({ kind, extension, mime }: Sniffed): KindInfo {
  return { kind, extension, mime };
}
