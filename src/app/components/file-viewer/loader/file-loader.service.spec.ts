import {
  HttpEvent,
  HttpEventType,
  HttpHeaders,
  HttpResponse,
  provideHttpClient,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { from, lastValueFrom, of, toArray } from 'rxjs';
import { provideFileViewerConfig } from '../file-viewer-config.token';
import {
  FileLoadEvent,
  FileViewerError,
  ResolvedFile,
  ViewerAttachmentInput,
} from '../file-viewer.interface';
import { FileLoaderService } from './file-loader.service';

const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n' + 'x'.repeat(120));
const PDF_BASE64 = btoa(String.fromCharCode(...PDF_BYTES));
const pdfBlob = (type = '') => new Blob([PDF_BYTES], { type });

describe('FileLoaderService', () => {
  let loader: FileLoaderService;
  let http: HttpTestingController;
  const resolvePath = vi.fn();
  const convert = vi.fn();

  function setup(overrides: Parameters<typeof provideFileViewerConfig>[0] = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFileViewerConfig({
          baseUrl: 'https://api.test',
          resolvePath,
          convert,
          ...overrides,
        }),
      ],
    });
    loader = TestBed.inject(FileLoaderService);
    http = TestBed.inject(HttpTestingController);
  }

  const events = (input: ViewerAttachmentInput) =>
    lastValueFrom(loader.load$(input).pipe(toArray()));
  const file = async (input: ViewerAttachmentInput): Promise<ResolvedFile> => {
    const all = await events(input);
    const done = all.at(-1) as Extract<FileLoadEvent, { type: 'done' }>;
    expect(done.type).toBe('done');
    return done.file;
  };

  beforeEach(() => {
    resolvePath.mockReset();
    convert.mockReset();
  });
  afterEach(() => http?.verify());

  it('decodes raw base64 and settles the kind from the bytes, whatever the label says', async () => {
    setup();
    const f = await file({ data: PDF_BASE64, attachmentTitle: 'Contract', extension: 'png' });
    expect(f).toEqual(
      expect.objectContaining({
        kind: 'pdf',
        extension: 'pdf',
        mime: 'application/pdf',
        name: 'Contract.pdf',
      }),
    );
    expect(f.blob?.type).toBe('application/pdf'); // re-typed, so a blob: URL is served as a PDF
  });

  it('takes data URLs, Blobs, Files and ArrayBuffers', async () => {
    setup();
    expect((await file(`data:application/pdf;base64,${PDF_BASE64}`)).kind).toBe('pdf');
    expect((await file(new File([PDF_BYTES], 'a.pdf'))).name).toBe('a.pdf');
    expect((await file(PDF_BYTES.buffer)).kind).toBe('pdf');
    expect((await file({ blob: new Blob(['a;b\n1;2']), fileName: 'x.csv' })).kind).toBe('csv');
  });

  it('GETs URLs through HttpClient, against the base URL, with progress and header metadata', async () => {
    setup();
    const pending = events('reports/42/download');
    const req = http.expectOne('https://api.test/reports/42/download');
    expect(req.request.responseType).toBe('blob');
    req.event({ type: HttpEventType.DownloadProgress, loaded: 64, total: 128 });
    req.flush(pdfBlob(), {
      headers: new HttpHeaders({
        'content-disposition': 'attachment; filename="Q3 report.pdf"',
        'content-type': 'application/pdf',
      }),
    });
    const all = await pending;
    expect(all[0]).toEqual({ type: 'progress', loaded: 64, total: 128 });
    expect((all.at(-1) as Extract<FileLoadEvent, { type: 'done' }>).file.name).toBe(
      'Q3 report.pdf',
    );
  });

  it('turns HTTP failures into messages a user can act on', async () => {
    setup();
    const pending = events({ url: 'https://x.test/missing.pdf' });
    http
      .expectOne('https://x.test/missing.pdf')
      .flush(new Blob(), { status: 404, statusText: 'Not Found' });
    await expect(pending).rejects.toEqual(new FileViewerError('The file was not found.', 404));
  });

  it('refuses javascript: and other non-http schemes without a request', async () => {
    setup();
    await expect(events({ url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(FileViewerError);
    http.expectNone(() => true);
  });

  it("unwraps Observables of HttpEvents, Promises, loader functions and an API's attachment DTO", async () => {
    setup();
    const response = new HttpResponse({
      body: pdfBlob(),
      headers: new HttpHeaders({ 'content-type': 'application/pdf' }),
    });
    const stream: HttpEvent<Blob>[] = [
      { type: HttpEventType.Sent },
      { type: HttpEventType.DownloadProgress, loaded: 10, total: 20 },
      response,
    ];
    const fromEvents = await events(from(stream));
    expect(fromEvents.map((e) => e.type)).toEqual(['progress', 'done']);

    expect((await file(Promise.resolve(pdfBlob()))).kind).toBe('pdf');
    const lazy = vi.fn(() =>
      Promise.resolve({ data: PDF_BASE64, mediaType: 'pdf', attachmentTitle: 'From API' }),
    );
    const f = await file(lazy);
    expect(lazy).toHaveBeenCalledTimes(1);
    expect(f.name).toBe('From API.pdf');
  });

  it('reads streams chunk by chunk, reporting progress against the declared size', async () => {
    setup();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(PDF_BYTES.subarray(0, 50));
        controller.enqueue(PDF_BYTES.subarray(50));
        controller.close();
      },
    });
    const all = await events({ src: stream, size: PDF_BYTES.length, fileName: 'streamed.pdf' });
    expect(all.filter((e) => e.type === 'progress')).toEqual([
      { type: 'progress', loaded: 50, total: PDF_BYTES.length },
      { type: 'progress', loaded: PDF_BYTES.length, total: PDF_BYTES.length },
    ]);
  });

  it('hands filePath to the app resolver', async () => {
    setup();
    resolvePath.mockReturnValue(of(pdfBlob()));
    const f = await file({ filePath: 'docs/7', fileName: 'seven.pdf' });
    expect(resolvePath).toHaveBeenCalledWith(
      'docs/7',
      expect.objectContaining({ filePath: 'docs/7' }),
    );
    expect(f.kind).toBe('pdf');
  });

  it('streams audio / video straight from their URL instead of downloading them', async () => {
    setup();
    const f = await file({ url: 'media/clip.mp4' });
    expect(f).toEqual(
      expect.objectContaining({
        kind: 'video',
        directUrl: 'https://api.test/media/clip.mp4',
        blob: undefined,
      }),
    );
    http.expectNone('https://api.test/media/clip.mp4');
  });

  it('converts formats the browser cannot render, before downloading the original', async () => {
    setup();
    convert.mockReturnValue({ blob: pdfBlob(), extension: 'pdf' });
    const f = await file({ url: 'https://x.test/memo.doc' });
    expect(convert).toHaveBeenCalledWith(
      expect.objectContaining({ extension: 'doc', kind: 'office' }),
      expect.anything(),
    );
    expect(f).toEqual(expect.objectContaining({ kind: 'pdf', name: 'memo.pdf', converted: true }));
    expect(f.original?.name).toBe('memo.doc');
    http.expectNone('https://x.test/memo.doc');
  });

  it('uses Office Online only when the app opted in and the file has a public URL', async () => {
    setup({ officeOnline: { enabled: true } });
    convert.mockReturnValue(null);
    const f = await file({ url: 'https://x.test/deck.pptx' });
    expect(f.external).toBe(true);
    expect(loader.officeOnlineUrl(f)).toBe(
      'https://view.officeapps.live.com/op/embed.aspx?src=' +
        encodeURIComponent('https://x.test/deck.pptx'),
    );
    expect(loader.officeOnlineUrl({ ...f, source: { externalViewer: false } })).toBeUndefined();
  });

  it('never offers Office Online unless enabled, and falls back to downloading for the card', async () => {
    setup();
    const pending = events({ url: 'https://x.test/deck.pptx' });
    http
      .expectOne('https://x.test/deck.pptx')
      .flush(
        new Blob([new Uint8Array([0x50, 0x4b, 3, 4, ...new TextEncoder().encode('ppt/slides')])]),
      );
    const done = (await pending).at(-1) as Extract<FileLoadEvent, { type: 'done' }>;
    expect(done.file.kind).toBe('office');
    expect(loader.officeOnlineUrl(done.file)).toBeUndefined();
  });

  it('cancels the request when the subscriber leaves', () => {
    setup();
    const sub = loader.load$('https://x.test/big.pdf').subscribe();
    const req = http.expectOne('https://x.test/big.pdf');
    sub.unsubscribe();
    expect(req.cancelled).toBe(true);
  });
});
