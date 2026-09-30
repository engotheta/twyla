import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  Renderer2,
} from '@angular/core';
import { LoadingConfig } from './loading-config.token';
import { LoadingOverlayComponent } from './loading-overlay.component';

/** What a `LoadingOverlayRef` needs from `LoadingService` to mount and unmount its overlay. */
export interface LoadingOverlayContext {
  appRef: ApplicationRef;
  injector: EnvironmentInjector;
  renderer: Renderer2;
  config: LoadingConfig;
  /** Called once the overlay is gone, so the service can forget this ref. */
  disposed: (ref: LoadingOverlayRef) => void;
}

/**
 * Owns the overlay on ONE element. Callers `acquire()`/`release()` it (reference counted): the
 * overlay only appears after `config.delay`, so fast requests never flash a spinner, and once
 * shown it stays at least `config.minDuration`, so it never flickers. `aria-busy` follows the
 * count itself, not the (delayed) visuals.
 */
export class LoadingOverlayRef {
  private count = 0;
  private componentRef?: ComponentRef<LoadingOverlayComponent>;
  private shownAt = 0;
  private showTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  /** The inline `position` to put back, set only when a static element had to become `relative`. */
  private restorePosition?: string;

  constructor(
    readonly element: HTMLElement,
    private readonly context: LoadingOverlayContext,
  ) {}

  acquire(): void {
    this.count++;
    if (this.count > 1) return;

    this.context.renderer.setAttribute(this.element, 'aria-busy', 'true');
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.componentRef || this.showTimer) return;

    const { delay } = this.context.config;
    if (delay > 0) this.showTimer = setTimeout(() => this.attach(), delay);
    else this.attach();
  }

  release(): void {
    if (this.count === 0) return;
    this.count--;
    if (this.count > 0) return;

    this.context.renderer.removeAttribute(this.element, 'aria-busy');

    // still inside the show delay: it never appeared, so there is nothing to keep on screen
    if (!this.componentRef) return this.dispose();

    const remaining = this.context.config.minDuration - (Date.now() - this.shownAt);
    if (remaining > 0) this.hideTimer = setTimeout(() => this.dispose(), remaining);
    else this.dispose();
  }

  /** Removes the overlay right away, whatever the count. */
  dispose(): void {
    const { renderer, appRef } = this.context;
    clearTimeout(this.showTimer);
    clearTimeout(this.hideTimer);
    this.showTimer = this.hideTimer = undefined;
    this.count = 0;
    renderer.removeAttribute(this.element, 'aria-busy');

    if (this.componentRef) {
      appRef.detachView(this.componentRef.hostView);
      this.componentRef.destroy();
      this.componentRef = undefined;
    }

    if (this.restorePosition !== undefined) {
      if (this.restorePosition) renderer.setStyle(this.element, 'position', this.restorePosition);
      else renderer.removeStyle(this.element, 'position');
      this.restorePosition = undefined;
    }

    this.context.disposed(this);
  }

  private attach(): void {
    const { renderer, appRef, injector } = this.context;
    this.showTimer = undefined;

    // the overlay is `position: absolute`, so a static host must become its containing block
    const position = this.element.ownerDocument.defaultView?.getComputedStyle(this.element).position;
    if (!position || position === 'static') {
      this.restorePosition = this.element.style.position;
      renderer.setStyle(this.element, 'position', 'relative');
    }

    this.componentRef = createComponent(LoadingOverlayComponent, { environmentInjector: injector });
    appRef.attachView(this.componentRef.hostView);
    this.componentRef.changeDetectorRef.detectChanges();
    renderer.appendChild(this.element, this.componentRef.location.nativeElement);
    this.shownAt = Date.now();
  }
}
