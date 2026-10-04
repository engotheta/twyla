/**
 * Whether scripted motion — a smooth scroll, an animated move — should be skipped: the person
 * asked the app for less (`data-motion="reduced"` on `<html>`, written by the settings service),
 * or their operating system did. CSS needs no such check: `styles/_preferences.scss` and the
 * `prefers-reduced-motion` media query cover animations and transitions.
 */
export function prefersReducedMotion(document: Document): boolean {
  if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
  return document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
