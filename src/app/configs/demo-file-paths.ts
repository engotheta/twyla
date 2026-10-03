// The file-viewer demo's "storage paths": `app.config.ts` resolves them to public URLs.

export const PUBLIC_PDF_URL =
  'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf';

/** `filePath`s the demo's `resolvePath` knows — standing in for an app's storage paths */
export const SAMPLE_PATHS: Record<string, string> = {
  'storage/reports/tracemonkey.pdf': PUBLIC_PDF_URL,
};
