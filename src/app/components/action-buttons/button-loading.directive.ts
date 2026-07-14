import {
  booleanAttribute,
  ComponentRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  Renderer2,
  ViewContainerRef,
} from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

/** Overlays a `mat-progress-spinner` on the host button and hides its content while loading. */
@Directive({
  selector: '[buttonLoading]',
  host: {
    class: 'relative',
    '[class.pointer-events-none]': 'buttonLoading()',
    '[attr.aria-busy]': 'buttonLoading() || null',
  },
})
export class ButtonLoadingDirective {
  buttonLoading = input(false, { transform: booleanAttribute });
  readonly buttonLoadingDiameter = input(18);

  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly renderer = inject(Renderer2);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private spinnerRef?: ComponentRef<MatProgressSpinner>;

  constructor() {
    effect(() => {
      if (this.buttonLoading()) this.showSpinner();
      else this.hideSpinner();
    });
  }

  private showSpinner(): void {
    this.setContentHidden(true);

    if (this.spinnerRef) return;

    this.spinnerRef = this.viewContainerRef.createComponent(MatProgressSpinner);
    this.spinnerRef.setInput('diameter', this.buttonLoadingDiameter());
    this.spinnerRef.setInput('mode', 'indeterminate');

    const spinnerElement = this.spinnerRef.location.nativeElement as HTMLElement;
    this.renderer.setStyle(spinnerElement, 'position', 'absolute');
    this.renderer.setStyle(spinnerElement, 'inset', '0');
    this.renderer.setStyle(spinnerElement, 'margin', 'auto');

    // Match the button's own foreground color so the spinner stays visible on any
    // button variant/background instead of the theme's fixed primary color.
    // Renderer2.setStyle doesn't reliably set custom properties, so use the DOM API.
    spinnerElement.style.setProperty(
      '--mat-progress-spinner-active-indicator-color',
      'currentColor',
    );

    this.renderer.appendChild(this.host, spinnerElement);
  }

  private hideSpinner(): void {
    this.setContentHidden(false);
    this.spinnerRef?.destroy();
    this.spinnerRef = undefined;
  }

  private setContentHidden(hidden: boolean): void {
    this.host.childNodes.forEach((node: ChildNode) => {
      if (node instanceof HTMLElement && node !== this.spinnerRef?.location.nativeElement) {
        this.renderer.setStyle(node, 'visibility', hidden ? 'hidden' : '');
      }
    });
  }
}
