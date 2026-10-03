import {
  HttpClient,
  HttpErrorResponse,
  HttpEventType,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  concat,
  concatMap,
  defer,
  EMPTY,
  from,
  isObservable,
  map,
  Observable,
  of,
  switchMap,
  takeWhile,
  throwError,
} from 'rxjs';
import { resolveUrl } from '@services/fetch/fetch.helpers';
import { FILE_VIEWER_CONFIG, FileViewerConfig } from '../file-viewer-config.token';
import {
  FileLoadEvent,
  FileSourceResult,
  FileViewerError,
  ResolvedFile,
  ViewerAttachment,
  ViewerAttachmentInput,
} from '../file-viewer.interface';
import { KindInfo, kindFromHints, resolveKind, SNIFF_BYTES } from './file-kind.helpers';
import { readBlob } from './text-decode.helpers';
import {
  attachmentMeta,
  classifyString,
  decodeBase64,
  explicitMeta,
  fallbackMeta,
  FileMeta,
  isArrayBuffer,
  isAllowedUrl,
  isHttpEvent,
  isHttpUrl,
  isPromiseLike,
  isReadableStream,
  isViewerAttachment,
  mergeMeta,
  metaFromHeaders,
  parseDataUrl,
  pickSource,
  stripExtension,
  withExtension,
} from './file-source.helpers';

export interface FileLoadOptions {
  /** run the app's `convert` hook for formats the browser can't render (default true) */
  convert?: boolean;
  /** allow Office Online for those formats (default true — it still needs the app's opt-in) */
  external?: boolean;
  /** allow viewing audio/video/images/PDF straight from their URL (default true) */
  direct?: boolean;
}

/** What resolving a source emits on the way to its bytes. */
type SourceEvent =
  | { type: 'progress'; loaded: number; total?: number }
  | { type: 'meta'; meta: FileMeta }
  | { type: 'blob'; blob: Blob; meta?: FileMeta };

const MAX_DEPTH = 8;

/** Kinds that may be shown from a URL without downloading the bytes first. */
const DIRECT_KINDS = new Set(['audio', 'video']);

/**
 * Turns anything `ViewerAttachmentInput` allows into a `ResolvedFile`: bytes in hand, kind decided,
 * name and MIME type settled. URLs go through `HttpClient` (so the app's auth interceptors apply),
 * streams are read chunk by chunk, Observables / Promises / loader functions are unwrapped — each
 * with progress events, and all of it cancelled when the subscription ends.
 */
@Injectable({ providedIn: 'root' })
export class FileLoaderService {
  private readonly http = inject(HttpClient);
  private readonly config: FileViewerConfig = inject(FILE_VIEWER_CONFIG);

  /** Progress events, then exactly one `done` — or an error (a `FileViewerError` when describable). */
  load$(input: ViewerAttachmentInput, options: FileLoadOptions = {}): Observable<FileLoadEvent> {
    return defer(() => {
      const attachment: ViewerAttachment = isViewerAttachment(input) ? input : { src: input };
      return this.loadAttachment$(attachment, options);
    });
  }

  /** Just the file — for callers that don't need progress (downloads, prints). */
  resolve(input: ViewerAttachmentInput, options?: FileLoadOptions): Promise<ResolvedFile> {
    return new Promise((resolve, reject) => {
      this.load$(input, options).subscribe({
        next: (event) => event.type === 'done' && resolve(event.file),
        error: reject,
        complete: () => reject(new FileViewerError('There is no file to show.')), // no-op once resolved
      });
    });
  }

  /** The Office Online URL for `file`, or undefined when the app hasn't opted in or it isn't eligible. */
  officeOnlineUrl(
    file: Pick<ResolvedFile, 'extension' | 'publicUrl' | 'source'>,
  ): string | undefined {
    const office = this.config.officeOnline;
    if (!office.enabled || file.source.externalViewer === false) return undefined;
    if (!office.extensions.includes(file.extension) || !isHttpUrl(file.publicUrl)) return undefined;
    if (!/^https:\/\//i.test(office.viewerUrl)) return undefined;
    return office.viewerUrl + encodeURIComponent(file.publicUrl);
  }

  private loadAttachment$(
    attachment: ViewerAttachment,
    options: FileLoadOptions,
  ): Observable<FileLoadEvent> {
    const explicit = explicitMeta(attachment);
    const fallback = fallbackMeta(attachment);
    const declared = mergeMeta(explicit, fallback);
    const picked = pickSource(attachment);
    const publicUrl = this.publicUrl(attachment, picked);
    const hinted = kindFromHints({ extension: declared.extension, mime: declared.mime });

    // audio / video at a URL: let the element stream it (range requests) instead of buffering it all
    const location =
      picked.type === 'url' || (picked.type === 'src' && typeof picked.value === 'string')
        ? (picked.value as string)
        : undefined;
    const directAllowed = options.direct !== false && attachment.direct !== false;
    if (
      location &&
      directAllowed &&
      classifyString(location) === 'url' &&
      isAllowedUrl(location) &&
      hinted &&
      (DIRECT_KINDS.has(hinted.kind) || (attachment.direct === true && hinted.kind !== 'office'))
    ) {
      const directUrl = resolveUrl(this.config.baseUrl, location);
      return of(this.done(attachment, declared, hinted, undefined, { directUrl, publicUrl }));
    }

    // a format with no in-browser renderer: convert it or hand it to Office Online before
    // downloading anything
    if (hinted?.kind === 'office') {
      const shortcut = this.officeShortcut$(
        attachment,
        declared,
        hinted,
        undefined,
        publicUrl,
        options,
      );
      if (shortcut) return shortcut;
    }

    // the caller's file name beats the server's, which beats a title or the URL's last segment
    let received: FileMeta = {};
    const meta = () => mergeMeta(mergeMeta(explicit, received), fallback);
    return this.source$(picked, attachment, 0).pipe(
      concatMap((event): Observable<FileLoadEvent> => {
        switch (event.type) {
          case 'progress':
            return of({
              type: 'progress',
              loaded: event.loaded,
              total: event.total ?? meta().size,
            });
          case 'meta':
            received = mergeMeta(received, event.meta);
            return EMPTY;
          case 'blob':
            received = mergeMeta(received, {
              ...event.meta,
              mime: event.meta?.mime ?? (event.blob.type || undefined),
            });
            return from(readBlob(event.blob.slice(0, SNIFF_BYTES))).pipe(
              switchMap((head) => {
                const final = meta();
                const info = resolveKind(
                  { extension: final.extension, mime: final.mime },
                  new Uint8Array(head),
                );
                if (info.kind === 'office' && hinted?.kind !== 'office') {
                  const shortcut = this.officeShortcut$(
                    attachment,
                    final,
                    info,
                    event.blob,
                    publicUrl,
                    options,
                  );
                  if (shortcut) return shortcut;
                }
                return of(this.done(attachment, final, info, event.blob, { publicUrl }));
              }),
            );
        }
      }),
    );
  }

  /** `convert` hook first (keeps the file in-house), then Office Online — undefined when neither applies. */
  private officeShortcut$(
    attachment: ViewerAttachment,
    meta: FileMeta,
    info: KindInfo,
    blob: Blob | undefined,
    publicUrl: string | undefined,
    options: FileLoadOptions,
  ): Observable<FileLoadEvent> | undefined {
    const name = withExtension(meta.name ?? 'file', info.extension);
    const original = this.done(attachment, meta, info, blob, { publicUrl }).file;

    if (options.convert !== false && this.config.convert) {
      const converted = this.config.convert(
        { name, extension: info.extension, mime: info.mime, kind: info.kind, blob },
        attachment,
      );
      if (converted !== null && converted !== undefined) {
        const next: ViewerAttachment = isViewerAttachment(converted)
          ? converted
          : { src: converted as ViewerAttachment['src'] };
        return this.load$(next, { ...options, convert: false }).pipe(
          map((event): FileLoadEvent =>
            event.type === 'done'
              ? {
                  type: 'done',
                  // contract.doc shown as PDF → contract.pdf, whatever the conversion endpoint is called
                  file: {
                    ...event.file,
                    name: withExtension(stripExtension(original.name), event.file.extension),
                    converted: true,
                    original,
                  },
                }
              : event,
          ),
        );
      }
    }

    if (options.external !== false && this.officeOnlineUrl(original)) {
      return of({ type: 'done', file: { ...original, external: true } });
    }
    return undefined;
  }

  private done(
    attachment: ViewerAttachment,
    meta: FileMeta,
    info: KindInfo,
    blob: Blob | undefined,
    extra: { directUrl?: string; publicUrl?: string },
  ): Extract<FileLoadEvent, { type: 'done' }> {
    const mime = info.mime || meta.mime || blob?.type || 'application/octet-stream';
    // re-type the blob so blob: URLs (new tab, print, <object>) are served with the right MIME type
    const typed = blob && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
    const fallbackName = info.extension ? `file.${info.extension}` : 'file';
    return {
      type: 'done',
      file: {
        blob: typed,
        directUrl: extra.directUrl,
        name: meta.name ? withExtension(meta.name, info.extension) : fallbackName,
        extension: info.extension,
        mime,
        kind: info.kind,
        size: typed?.size ?? meta.size,
        publicUrl: extra.publicUrl,
        source: attachment,
      },
    };
  }

  /** A public http(s) URL for Office Online: explicit, from the app's mapper, or the source URL itself. */
  private publicUrl(
    attachment: ViewerAttachment,
    picked: ReturnType<typeof pickSource>,
  ): string | undefined {
    const explicit = attachment.publicUrl ?? this.config.officeOnline.publicUrl?.(attachment);
    if (explicit) return isHttpUrl(explicit) ? explicit : undefined;
    const location =
      picked.type === 'url' || (picked.type === 'src' && typeof picked.value === 'string')
        ? resolveUrl(this.config.baseUrl, picked.value as string)
        : undefined;
    return location && classifyString(location) === 'url' && isHttpUrl(location)
      ? location
      : undefined;
  }

  // ---------------------------------------------------------------------------------------------
  // sources → bytes
  // ---------------------------------------------------------------------------------------------

  private source$(
    picked: ReturnType<typeof pickSource>,
    attachment: ViewerAttachment,
    depth: number,
  ): Observable<SourceEvent> {
    switch (picked.type) {
      case 'blob':
        return of({ type: 'blob', blob: picked.value });
      case 'src':
        return this.result$(picked.value, attachment, depth);
      case 'base64':
        return this.string$(picked.value);
      case 'url':
        return this.url$(picked.value);
      case 'path':
        return this.config.resolvePath
          ? defer(() =>
              this.result$(this.config.resolvePath!(picked.value, attachment), attachment, depth),
            )
          : this.url$(picked.value);
      case 'none':
        return throwError(() => new FileViewerError('There is no file to show.'));
    }
  }

  /** Unwraps anything a source may resolve to. */
  private result$(
    value: FileSourceResult,
    attachment: ViewerAttachment,
    depth: number,
  ): Observable<SourceEvent> {
    if (depth > MAX_DEPTH)
      return throwError(() => new FileViewerError('The file source never resolved.'));
    if (value === null || value === undefined || value === '') {
      return throwError(() => new FileViewerError('There is no file to show.'));
    }
    if (typeof value === 'string') return this.string$(value);
    if (value instanceof Blob) {
      return of({
        type: 'blob',
        blob: value,
        meta: value instanceof File ? { name: value.name } : undefined,
      });
    }
    if (isArrayBuffer(value) || ArrayBuffer.isView(value)) {
      return of({ type: 'blob', blob: new Blob([value as BlobPart]) });
    }
    if (value instanceof HttpResponse)
      return this.httpResponse$(value as HttpResponse<unknown>, attachment, depth);
    if (typeof Response !== 'undefined' && value instanceof Response) return this.response$(value);
    if (isReadableStream(value)) return readStream$(value, attachment.size ?? undefined);
    if (isObservable(value))
      return this.observable$(value as Observable<FileSourceResult>, attachment, depth);
    if (isPromiseLike(value)) {
      return from(value as PromiseLike<FileSourceResult>).pipe(
        switchMap((resolved) => this.result$(resolved, attachment, depth + 1)),
      );
    }
    if (typeof value === 'function') {
      return defer(() => this.result$(value(), attachment, depth + 1));
    }
    if (isViewerAttachment(value)) {
      // a nested attachment (e.g. an API's `{ data, mediaType, attachmentTitle }`) — its metadata
      // fills the gaps, its own source supplies the bytes
      return concat(
        of<SourceEvent>({ type: 'meta', meta: attachmentMeta(value) }),
        this.source$(pickSource(value), { ...attachment, ...value }, depth + 1),
      );
    }
    if (isHttpEvent(value)) {
      return throwError(() => new FileViewerError('A lone HTTP event carries no file.'));
    }
    return throwError(() => new FileViewerError('Unrecognised file source.'));
  }

  /** An Observable of sources or of `HttpEvent`s (`http.get(url, { observe: 'events', … })`). */
  private observable$(
    source: Observable<FileSourceResult>,
    attachment: ViewerAttachment,
    depth: number,
  ): Observable<SourceEvent> {
    return source.pipe(
      concatMap((value): Observable<SourceEvent> => {
        if (isHttpEvent(value)) {
          const event = value as { type: HttpEventType; loaded?: number; total?: number };
          if (event.type === HttpEventType.DownloadProgress) {
            return of({ type: 'progress', loaded: event.loaded ?? 0, total: event.total });
          }
          if (value instanceof HttpResponse)
            return this.httpResponse$(value as HttpResponse<unknown>, attachment, depth);
          return EMPTY; // Sent, ResponseHeader, UploadProgress, User
        }
        return this.result$(value, attachment, depth + 1);
      }),
      takeWhile((event) => event.type !== 'blob', true),
    );
  }

  private httpResponse$(
    res: HttpResponse<unknown>,
    attachment: ViewerAttachment,
    depth: number,
  ): Observable<SourceEvent> {
    const meta = metaFromHeaders(res.headers);
    return concat(
      of<SourceEvent>({ type: 'meta', meta }),
      this.result$(res.body as FileSourceResult, attachment, depth + 1),
    );
  }

  private response$(res: Response): Observable<SourceEvent> {
    if (!res.ok) return throwError(() => httpError(res.status, res.statusText));
    const meta = metaFromHeaders(res.headers);
    if (!res.body) {
      return from(res.blob()).pipe(map((blob): SourceEvent => ({ type: 'blob', blob, meta })));
    }
    return concat(
      of<SourceEvent>({ type: 'meta', meta }),
      readStream$(res.body, meta.size, meta.mime),
    );
  }

  private string$(value: string): Observable<SourceEvent> {
    switch (classifyString(value)) {
      case 'dataUrl':
        return defer(() => {
          const { bytes, mime } = parseDataUrl(value.trim());
          return of<SourceEvent>({ type: 'blob', blob: new Blob([bytes], { type: mime }) });
        });
      case 'base64':
        return defer(() =>
          of<SourceEvent>({ type: 'blob', blob: new Blob([decodeBase64(value)]) }),
        );
      case 'blobUrl':
        return fromFetch$(value.trim());
      case 'url':
        return this.url$(value);
    }
  }

  /** GET through `HttpClient` — auth interceptors apply — with download progress. */
  private url$(url: string): Observable<SourceEvent> {
    const trimmed = url.trim();
    if (!isAllowedUrl(trimmed)) {
      return throwError(() => new FileViewerError('This file link is not allowed.'));
    }
    if (/^blob:/i.test(trimmed)) return fromFetch$(trimmed);

    const headers = this.config.headers;
    return this.http
      .get(resolveUrl(this.config.baseUrl, trimmed), {
        observe: 'events',
        reportProgress: true,
        responseType: 'blob',
        withCredentials: this.config.withCredentials,
        headers:
          headers instanceof HttpHeaders ? headers : headers ? new HttpHeaders(headers) : undefined,
      })
      .pipe(
        concatMap((event): Observable<SourceEvent> => {
          if (event.type === HttpEventType.DownloadProgress) {
            return of({ type: 'progress', loaded: event.loaded, total: event.total });
          }
          if (event.type === HttpEventType.Response) {
            if (!event.body)
              return throwError(() => new FileViewerError('The server sent an empty file.'));
            return of({ type: 'blob', blob: event.body, meta: metaFromHeaders(event.headers) });
          }
          return EMPTY;
        }),
        catchError((err: unknown) =>
          throwError(() =>
            err instanceof HttpErrorResponse ? httpError(err.status, err.statusText) : err,
          ),
        ),
      );
  }
}

/** An HTTP failure in words a user can act on. */
export function httpError(status: number, statusText?: string): FileViewerError {
  const message =
    status === 0
      ? "Couldn't reach the server — check your connection."
      : status === 401 || status === 403
        ? "You don't have access to this file."
        : status === 404 || status === 410
          ? 'The file was not found.'
          : status >= 500
            ? `The server couldn't send the file (${status}).`
            : `The file couldn't be loaded (${status}${statusText ? ' ' + statusText : ''}).`;
  return new FileViewerError(message, status);
}

/** `fetch()` for `blob:` URLs (HttpClient can't read them), abortable. */
function fromFetch$(url: string): Observable<SourceEvent> {
  return new Observable<SourceEvent>((subscriber) => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw httpError(res.status, res.statusText);
        return res.blob();
      })
      .then((blob) => {
        subscriber.next({ type: 'blob', blob });
        subscriber.complete();
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          subscriber.error(
            err instanceof FileViewerError
              ? err
              : new FileViewerError('The file link has expired.'),
          );
        }
      });
    return () => controller.abort();
  });
}

/** Reads a stream chunk by chunk with progress; unsubscribing cancels the stream. */
export function readStream$(
  stream: ReadableStream<Uint8Array>,
  total?: number,
  type = '',
): Observable<SourceEvent> {
  return new Observable<SourceEvent>((subscriber) => {
    const reader = stream.getReader();
    let cancelled = false;
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (cancelled) return;
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          subscriber.next({ type: 'progress', loaded, total });
        }
        subscriber.next({ type: 'blob', blob: new Blob(chunks as BlobPart[], { type }) });
        subscriber.complete();
      } catch (err) {
        if (!cancelled) {
          subscriber.error(
            err instanceof FileViewerError ? err : new FileViewerError('The file stream failed.'),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      reader.cancel().catch(() => undefined);
    };
  });
}
