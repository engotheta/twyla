/** How long a download's temporary object URL lives — long enough for the browser to start saving. */
const DOWNLOAD_URL_TTL_MS = 30_000;
/** A print frame is kept this long after `print()` (the PDF plugin prints asynchronously). */
const PRINT_FRAME_TTL_MS = 60_000;

/** Saves `blob` as `name` through a temporary `<a download>`. */
export function saveBlob(doc: Document, blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.style.display = 'none';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_TTL_MS);
}

/** Opens a (blob:, same-origin) URL in a new tab, where the browser shows it with its own viewer. */
export function openInNewTab(doc: Document, url: string): void {
  doc.defaultView?.open(url, '_blank', 'noopener');
}

const frames = new WeakMap<Document, HTMLIFrameElement>();

/** A fresh, invisible-but-rendered iframe (a `display: none` frame won't print in Chrome). */
function printFrame(doc: Document): HTMLIFrameElement {
  frames.get(doc)?.remove();
  const frame = doc.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.title = 'Print';
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  frames.set(doc, frame);
  return frame;
}

function printWhenLoaded(frame: HTMLIFrameElement): Promise<boolean> {
  return new Promise((resolve) => {
    frame.addEventListener(
      'load',
      () =>
        // a beat for the PDF plugin / images to settle before the dialog snapshots the page
        setTimeout(() => {
          try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            resolve(true);
          } catch {
            resolve(false);
          } finally {
            setTimeout(() => frame.remove(), PRINT_FRAME_TTL_MS);
          }
        }, 250),
      { once: true },
    );
  });
}

/**
 * Prints a same-origin URL (a `blob:` PDF) through a hidden iframe and the browser's own viewer.
 * Resolves false when the browser refused (the caller can fall back to opening a new tab).
 */
export function printUrl(doc: Document, url: string): Promise<boolean> {
  const frame = printFrame(doc);
  frame.src = url;
  const printed = printWhenLoaded(frame);
  doc.body.appendChild(frame);
  return printed;
}

/**
 * Prints markup the viewer rendered itself (a table, a Word document, an image). The frame is
 * sandboxed — no scripts run in it; `allow-modals` is what lets `print()` open the dialog.
 */
export function printHtml(doc: Document, title: string, body: string, css = ''): Promise<boolean> {
  const frame = printFrame(doc);
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>@page{margin:12mm}html,body{margin:0;font-family:system-ui,sans-serif;color:#000;background:#fff}${css}</style>
</head><body>${body}</body></html>`;
  const printed = printWhenLoaded(frame);
  doc.body.appendChild(frame);
  return printed;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
