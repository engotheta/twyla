import { booleanAttribute, Directive, effect, ElementRef, inject, input } from '@angular/core';
import { LoadingService } from './loading.service';

/**
 * Covers the host with the loading overlay while the bound value is true:
 * `<section [loadingOverlay]="saving()">`. Goes through `LoadingService`, so it shares the show
 * delay, `aria-busy` handling and reference counting with fetch-driven overlays on the same element.
 */
@Directive({
  selector: '[loadingOverlay]',
})
export class LoadingOverlayDirective {
  readonly loadingOverlay = input(false, { transform: booleanAttribute });

  constructor() {
    const loading = inject(LoadingService);
    const host: HTMLElement = inject(ElementRef).nativeElement;

    effect((onCleanup) => {
      if (this.loadingOverlay()) onCleanup(loading.show(host));
    });
  }
}
