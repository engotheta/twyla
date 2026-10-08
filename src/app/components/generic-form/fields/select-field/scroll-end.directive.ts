import { DestroyRef, Directive, effect, ElementRef, inject, input, output } from '@angular/core';

/**
 * Put on an element at the end of a scrolling list, it emits `scrollEnd` each time that element
 * comes into view: the list was scrolled to its end. `scrollEndKey` re-arms it — bind what
 * changes when more has been added (a count), so an end that is still in view after a short
 * page asks again instead of waiting for a scroll that can't happen.
 */
@Directive({ selector: '[scrollEnd]' })
export class ScrollEndDirective {
  readonly scrollEndKey = input<unknown>();
  readonly scrollEnd = output<void>();

  constructor() {
    if (typeof IntersectionObserver === 'undefined') return;

    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) this.scrollEnd.emit();
    });

    // observing anew reports where the element stands now, in view or not
    effect(() => {
      this.scrollEndKey();
      observer.unobserve(element);
      observer.observe(element);
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
