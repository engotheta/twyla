import { FocusableOption } from '@angular/cdk/a11y';
import { Directive, ElementRef, inject } from '@angular/core';

/** a tab toggle as `tab-nav`'s `FocusKeyManager` sees it */
@Directive({ selector: '[tabNavItem]' })
export class TabNavItemDirective implements FocusableOption {
  readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  focus(): void {
    this.element.focus();
  }
}
