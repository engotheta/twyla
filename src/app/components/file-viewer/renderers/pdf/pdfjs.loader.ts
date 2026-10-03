export type PdfJs = typeof import('pdfjs-dist');
export type PdfJsViewer = typeof import('pdfjs-dist/web/pdf_viewer.mjs');

export interface PdfJsModules {
  pdfjs: PdfJs;
  viewer: PdfJsViewer;
  /** absolute base URL of the copied pdf.js assets (worker, cmaps, fonts, wasm, css) */
  assets: string;
  /** the polyfilled build was loaded — this browser lacks what the modern build needs */
  legacy: boolean;
}

let loading: Promise<PdfJsModules> | undefined;

/**
 * Loads pdf.js once per app, on first use — nothing of it is in the initial bundle:
 *  1. `pdfjs-dist` itself, exposed as `globalThis.pdfjsLib` (its viewer components read it from there);
 *  2. the viewer components (`PDFViewer`, `EventBus`, `PDFFindController`, `PDFLinkService`);
 *  3. the worker (`pdf.worker.min.mjs`) and `pdf_viewer.css`, which `angular.json` copies to
 *     `assetsUrl` — the css is awaited so pages never lay out unstyled.
 *
 * pdf.js's modern build targets only the newest browsers (it calls `Map#getOrInsertComputed`,
 * `Math.sumPrecise`, `RegExp.escape`… directly), so a browser a few releases behind gets its
 * legacy build instead — the same API with core-js polyfills, worker included. A failed load is
 * forgotten, so the next viewer retries.
 */
export function loadPdfJs(doc: Document, assetsUrl: string): Promise<PdfJsModules> {
  loading ??= (async (): Promise<PdfJsModules> => {
    const assets = new URL(assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`, doc.baseURI).href;
    const legacy = !supportsModernBuild();
    const [pdfjs, viewerModule] = legacy
      ? [
          import('pdfjs-dist/legacy/build/pdf.mjs'),
          () => import('pdfjs-dist/legacy/web/pdf_viewer.mjs'),
        ]
      : [import('pdfjs-dist'), () => import('pdfjs-dist/web/pdf_viewer.mjs')];
    const lib = (await pdfjs) as PdfJs;
    (globalThis as { pdfjsLib?: PdfJs }).pdfjsLib = lib;
    // versioned, so a browser never pairs this API with a cached worker / css of another release
    // (pdf.js refuses to run when the two versions differ); the legacy worker is polyfilled too
    const v = `?v=${encodeURIComponent(lib.version)}`;
    lib.GlobalWorkerOptions.workerSrc = `${assets}${legacy ? 'legacy/' : ''}pdf.worker.min.mjs${v}`;
    const [viewer] = await Promise.all([
      viewerModule() as Promise<PdfJsViewer>,
      // identical in both builds
      loadStylesheet(doc, `${assets}pdf_viewer.css${v}`),
    ]);
    return { pdfjs: lib, viewer, assets, legacy };
  })();
  loading.catch(() => (loading = undefined));
  return loading;
}

/** The newest built-ins pdf.js's modern build calls without a fallback (checked for 6.3). */
export function supportsModernBuild(): boolean {
  const has = (owner: unknown, key: string) =>
    typeof (owner as Record<string, unknown> | undefined)?.[key] === 'function';
  return (
    has(Map.prototype, 'getOrInsertComputed') &&
    has(WeakMap.prototype, 'getOrInsertComputed') &&
    has(Math, 'sumPrecise') &&
    has(Promise, 'try') &&
    has(Promise, 'withResolvers') &&
    has(RegExp, 'escape') &&
    has(Uint8Array, 'fromBase64') &&
    typeof (globalThis as { Float16Array?: unknown }).Float16Array === 'function'
  );
}

function loadStylesheet(doc: Document, href: string): Promise<void> {
  const existing = doc.head.querySelector<HTMLLinkElement>(`link[data-pdfjs-css]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset['pdfjsCss'] = '';
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(new Error(`pdf.js stylesheet missing at ${href}`));
    };
    doc.head.appendChild(link);
  });
}
