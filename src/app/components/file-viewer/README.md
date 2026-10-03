# File viewer

Use it to show a file from almost any source, inline or in a dialog. It supports:

- images
- PDF
- Word (`.docx`)
- Excel (`.xlsx`)
- CSV / TSV
- text, code, JSON, XML
- audio and video

You can pass several files; the viewer then offers previous / next and a file menu.

```ts
// dialog — the apps' call name
inject(FileViewerService).viewAttachment(field.attachment);
inject(FileViewerService).viewAttachments(rows, 2); // gallery, opened at the third file
inject(FileViewerService).open({ attachment, title: 'Signed copy', toolbar: { download: false } });
inject(FileViewerService).download(attachment); // no viewer — resolve and save
```

```html
<!-- inline -->
<file-viewer [attachment]="attachment" />
<file-viewer [attachments]="files" [(index)]="current" [actionButtons]="actions" />
```

## Sources

Every place that takes a file accepts `ViewerAttachmentInput`. Its field names match the apps'
`BaseAttachment` / `AttachmentDtoInput`, so existing DTOs can be passed in unchanged.

| Give it | As |
| --- | --- |
| URL (absolute, relative to `baseUrl`, `blob:`) | `{ url }`, or a plain string |
| raw base64 | `{ data }` / `{ dataBinary }`, or a plain string |
| data URL | `{ dataUrl }` / `{ data }`, or a plain string |
| `Blob` / `File` / `ArrayBuffer` | `{ blob }` / `{ file }`, or the value itself |
| `ReadableStream` / `Response` | `{ src: stream, size }` — `size` gives the progress bar a total |
| `Observable` / `Promise` (of any of these, of `HttpEvent`s, or of a DTO) | `{ src }`, or the value itself |
| lazy loader (runs only when the file is shown) | `() => Observable \| Promise` |
| an app storage path | `{ filePath }`, resolved by `FILE_VIEWER_CONFIG.resolvePath` |

How the viewer handles these sources:

- **Plain strings:** told apart by their shape. A string starting `data:` is a data URL, `blob:` is a blob URL, a string containing `.`, `:`, `?` and similar characters is a URL, and anything else is base64.
- **URLs:** fetched through `HttpClient`, so the app's auth interceptors apply. Only http(s), `blob:` and relative URLs are accepted; `javascript:` and other schemes are refused.
- **Name, extension and MIME type:** the order of trust is:
  1. `fileName` / `name` / the File's own name
  2. the server's `Content-Disposition`
  3. `attachmentTitle`
  4. the URL's last segment

  `'pdf'` and `'.pdf'` mean the same thing.
- **Kind:** decided from those hints and then checked against the file's first bytes. A PDF served as `text/plain` still shows as a PDF.

## What shows how

| Kind | Rendered by | Toolbar |
| --- | --- | --- |
| image | `<img>`. SVG is only ever shown as an image, so its scripts never run. | zoom (wheel / pinch / double-click), pan, rotate, print |
| pdf | pdf.js `PDFViewer` (lazy; its polyfilled legacy build on browsers that lack the newest built-ins; the browser's own PDF viewer if pdf.js still can't open the file). Pages render as they scroll into view. Text is selectable and readable by screen readers. Links work. | zoom, fit, rotate, pages, find (Ctrl+F), thumbnails, print. Encrypted files ask for their password. |
| docx | `docx-preview` (lazy), inside a shadow root. Embedded HTML is never rendered and unsafe links are disarmed. | zoom, fit width, print |
| xlsx / csv | `exceljs` (lazy) / the built-in CSV parser → one table component. Merges, widths, number and date formats, a tab per sheet; rows are added as you scroll. | zoom, print |
| text | `<pre>`, at most `maxTextBytes`. JSON has a pretty / raw toggle. | zoom (font size), print |
| audio / video | the browser's player. URLs are streamed rather than downloaded first. | — |
| doc, xls, ppt, pptx… | the app's `convert` hook if there is one, then Office Online if enabled, otherwise a "Preview not available" card with Download | — |

Every viewer also has Download, Open in new tab and Fullscreen. Keyboard shortcuts:

- `+` / `-` / `0`: zoom in, zoom out, reset
- `R`: rotate
- ← / →: previous / next file

## Configuration

```ts
provideFileViewerConfig(() => {
  const api = inject(FileApi);
  return {
    resolvePath: (path) => api.streamFile(path), // EWURA; GASCO: fetch(READ_ATTACHMENT, { filePath })
    convert: ({ extension }, a) =>
      extension === 'docx' ? { url: api.getStreamDocxAsPdfUrl(a.filePath!) } : null,
    officeOnline: { enabled: false }, // opt-in: Microsoft fetches the file from its public URL
    baseUrl: environment.apiUrl,
  };
});
```

| Setting | Default | Notes |
| --- | --- | --- |
| `resolvePath` | — | Turns a `filePath` into a source. Without it, the path is fetched as a URL. |
| `convert` | — | Runs before anything is downloaded, for kinds with no in-browser renderer. Download still gives the original file. |
| `officeOnline` | off | `enabled`, `viewerUrl` (must be https), `publicUrl(attachment)`, `extensions`. A file opts out with `externalViewer: false`. |
| `baseUrl`, `withCredentials`, `headers` | `''`, `false` | Apply to URL sources. |
| `pdfAssetsUrl` | `'pdfjs/'` | Where the pdf.js assets are served from (see below). |
| `maxTextBytes`, `sheetPageSize`, `maxSheetCells` | 2 MB, 200, 2 000 000 | |
| `dialog` | `96vw` × `92vh`, max 1280px | |

## Porting into an app

1. Add the dependencies: `npm i pdfjs-dist docx-preview jszip`. `exceljs` is already in GASCO and EWURA.
2. Add these to `angular.json` → `build.options.assets`. They are the pdf.js worker, fonts, cmaps, wasm and CSS, and they are only fetched when a PDF is opened:
   ```json
   { "glob": "pdf.worker.min.mjs", "input": "node_modules/pdfjs-dist/build", "output": "pdfjs/" },
   { "glob": "pdf.worker.min.mjs", "input": "node_modules/pdfjs-dist/legacy/build", "output": "pdfjs/legacy/" },
   { "glob": "pdf_viewer.css", "input": "node_modules/pdfjs-dist/web", "output": "pdfjs/" },
   { "glob": "**/*", "input": "node_modules/pdfjs-dist/web/images", "output": "pdfjs/images" },
   { "glob": "**/*", "input": "node_modules/pdfjs-dist/cmaps", "output": "pdfjs/cmaps" },
   { "glob": "**/*", "input": "node_modules/pdfjs-dist/standard_fonts", "output": "pdfjs/standard_fonts" },
   { "glob": "**/*", "input": "node_modules/pdfjs-dist/wasm", "output": "pdfjs/wasm" },
   { "glob": "**/*.icc", "input": "node_modules/pdfjs-dist/iccs", "output": "pdfjs/iccs" }
   ```
   Also add `"allowedCommonJsDependencies": ["jszip"]`. The `legacy/` worker is for browsers a few
   releases behind: pdf.js 6's modern build calls brand-new built-ins (`Map#getOrInsertComputed`,
   `Math.sumPrecise`…), so `pdfjs.loader.ts` feature-detects and loads the polyfilled legacy build
   there. Restart `ng serve` after changing assets — it only reads them at startup.
3. `@use` `_file-viewer.scss` from the global styles. It contains the dialog panel, toolbar density and pdf.js page styling.
4. Replace the old dialog calls:

   | Before | After |
   | --- | --- |
   | `vs.openDialog({ component: ViewAttachmentComponent, data: { attachment, title } })` | `fileViewer.open({ attachment, title })` |
   | `<view-attachment [attachment]="a" [actionButtons]="b" />` | `<file-viewer [attachment]="a" [actionButtons]="b" />` |
   | `openImagePreview(vs, { filePath, base64 })` / `openDocumentView(vs, { documents })` | `viewAttachment({ filePath })` / `viewAttachments(documents)` |
   | `window.open(fileApi.getStreamUrl(path))` | `viewAttachment({ filePath: path })` — goes through the auth interceptors |

   Two things are dropped:
   - `edit` / "Change File": this belongs to the form's attachment field, which now has a Preview button.
   - The routed `extended-pdf-viewer/iframe/:uid` page: no longer needed.
