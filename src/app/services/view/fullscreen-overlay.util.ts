/** Put this attribute on an element that goes full screen with overlays (menus, tooltips) inside it. */
export const OVERLAY_HOST_ATTRIBUTE = 'data-overlay-host';

/** contents-view's full-screen pane predates the attribute and is still recognised by its class */
const OVERLAY_HOST_SELECTOR = `[${OVERLAY_HOST_ATTRIBUTE}], .contents-view-item`;

/**
 * Keeps the CDK overlay container (dialogs, menus, tooltips, the notification stack) inside the
 * full-screen element: the browser makes everything outside the full-screen element inert, so an
 * overlay left under `<body>` would still paint on top (CDK shows it as a top-layer popover) yet
 * ignore every click and never take focus. Same move as CDK's `FullscreenOverlayContainer`, done
 * here so apps need no provider — but only into an overlay host (`data-overlay-host`): a foreign
 * full-screen element (a `<video>`) is left alone, and so is an element that lives inside the
 * overlay container itself (a viewer in a dialog), which it can't be moved into. Idempotent, so
 * every listener can run it on every change.
 */
export function syncOverlayContainer(doc: Document, container: HTMLElement): void {
  const fullscreen = doc.fullscreenElement;
  const parent = !fullscreen
    ? doc.body
    : fullscreen.matches(OVERLAY_HOST_SELECTOR) && !container.contains(fullscreen)
      ? fullscreen
      : null;
  if (parent && container.parentElement !== parent) parent.appendChild(container);
}
