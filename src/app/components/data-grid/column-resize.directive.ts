import { DOCUMENT } from '@angular/common';
import { Directive, inject, output } from '@angular/core';

/**
 * A drag handle: reports pointer-drag deltas (px) without knowing anything about columns/widths
 * — the consumer tracks the starting width on `resizeStart` and applies `resize`'s delta itself
 * (clamping to the column's minWidth/maxWidth is the consumer's job).
 */
@Directive({
  selector: '[columnResize]',
  host: {
    class: 'touch-none select-none',
    '(pointerdown)': 'onPointerDown($event)',
  },
})
export class ColumnResizeDirective {
  readonly resizeStart = output<void>();
  readonly resize = output<number>();
  readonly resizeEnd = output<void>();

  private readonly document = inject(DOCUMENT);
  private startX = 0;

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.resize.emit(event.clientX - this.startX);
  };

  private readonly onPointerUp = (): void => {
    this.document.removeEventListener('pointermove', this.onPointerMove);
    this.document.removeEventListener('pointerup', this.onPointerUp);
    this.resizeEnd.emit();
  };

  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.startX = event.clientX;
    this.resizeStart.emit();
    this.document.addEventListener('pointermove', this.onPointerMove);
    this.document.addEventListener('pointerup', this.onPointerUp, { once: true });
  }
}
