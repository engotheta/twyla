import { OverlayContainer } from '@angular/cdk/overlay';
import { effect, Injectable, Provider } from '@angular/core';
import { injectMessages } from '@services/i18n/message-bundle';
import { VIEW_MESSAGES } from './view.messages';

/**
 * CDK renders every overlay — menus, selects, date pickers, tooltips, dialogs — in one container
 * under `<body>`, outside each landmark of the page. AXE's `region` rule reports that for the
 * content of any open menu or select (dialogs are exempt). This container is itself a named
 * landmark, so whatever opens in it sits inside one.
 *
 * Add `provideOverlayLandmark()` to the app config. The element is the same one the full-screen
 * helpers move (`syncOverlayContainer`), so the landmark travels with it. Its name follows the
 * language.
 */
@Injectable()
export class LandmarkOverlayContainer extends OverlayContainer {
  private readonly t = injectMessages(VIEW_MESSAGES);

  constructor() {
    super();
    effect(() => this._containerElement?.setAttribute('aria-label', this.t().popups));
  }

  protected override _createContainer(): void {
    super._createContainer();
    this._containerElement?.setAttribute('role', 'region');
    this._containerElement?.setAttribute('aria-label', this.t().popups);
  }
}

/** Makes the CDK overlay container a named landmark — see `LandmarkOverlayContainer`. */
export function provideOverlayLandmark(): Provider[] {
  return [
    LandmarkOverlayContainer,
    { provide: OverlayContainer, useExisting: LandmarkOverlayContainer },
  ];
}
