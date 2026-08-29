import { DOCUMENT } from '@angular/common';
import { Directive, inject, input, output } from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';

/**
 * A window-splitter drag handle for the gutters between resizable `contents-view` panes —
 * the axis-aware, keyboard-accessible sibling of `data-grid`'s `ColumnResizeDirective`.
 *
 * Like that one it is stateless about what it resizes: it reports a signed pixel delta from the
 * drag origin on `resize`, and the consumer captures the starting track sizes on `resizeStart`,
 * applies the delta, and owns all clamping and persistence.
 *
 * Adds over `ColumnResizeDirective`:
 *  - `axis`: `'x'` gutters resize columns (ArrowLeft/Right, `clientX`, `aria-orientation="vertical"`);
 *    `'y'` gutters resize rows (ArrowUp/Down, `clientY`, `aria-orientation="horizontal"`).
 *  - keyboard: arrow keys emit a `keyStep`-px delta through the same `resizeStart`/`resize`/
 *    `resizeEnd` sequence, so the whole feature is operable without a pointer (WCAG 2.1.1).
 *  - RTL: an `x`-axis delta is negated when the ambient direction is `rtl`.
 *
 * Host wires the ARIA window-splitter pattern (`role="separator"`, `tabindex="0"`,
 * `aria-orientation`, `aria-valuenow/min/max`); the consumer supplies `ariaLabel` and `valueNow`.
 */
@Directive({
  selector: '[panelResize]',
  host: {
    class: 'cv-gutter touch-none select-none',
    role: 'separator',
    tabindex: '0',
    '[attr.aria-orientation]': "axis() === 'x' ? 'vertical' : 'horizontal'",
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-valuenow]': 'valueNow() ?? null',
    '[attr.aria-valuemin]': 'valueNow() == null ? null : 0',
    '[attr.aria-valuemax]': 'valueNow() == null ? null : 100',
    '(pointerdown)': 'onPointerDown($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class PanelResizeDirective {
  /** `'x'` → resizes the column split; `'y'` → resizes a row boundary */
  readonly axis = input.required<'x' | 'y'>();
  /** accessible name for the handle */
  readonly ariaLabel = input('Resize panels');
  /** integer 0–100: the first pane of the pair's share, for `aria-valuenow` */
  readonly valueNow = input<number | undefined>(undefined);
  /** pixels moved per arrow-key press */
  readonly keyStep = input(24);

  readonly resizeStart = output<void>();
  /** signed pixel delta from the drag origin along this gutter's axis */
  readonly resize = output<number>();
  readonly resizeEnd = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly dir = inject(Directionality, { optional: true });
  private origin = 0;

  private get rtl(): boolean {
    return this.axis() === 'x' && this.dir?.value === 'rtl';
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const raw = this.axis() === 'x' ? event.clientX - this.origin : event.clientY - this.origin;
    this.resize.emit(this.rtl ? -raw : raw);
  };

  private readonly onPointerUp = (): void => {
    this.document.removeEventListener('pointermove', this.onPointerMove);
    this.document.removeEventListener('pointerup', this.onPointerUp);
    this.resizeEnd.emit();
  };

  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.origin = this.axis() === 'x' ? event.clientX : event.clientY;
    this.resizeStart.emit();
    this.document.addEventListener('pointermove', this.onPointerMove);
    this.document.addEventListener('pointerup', this.onPointerUp, { once: true });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const step = this.keyStep();
    const deltas: Record<string, number> =
      this.axis() === 'x'
        ? { ArrowLeft: -step, ArrowRight: step }
        : { ArrowUp: -step, ArrowDown: step };
    let delta = deltas[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    if (this.rtl) delta = -delta;
    this.resizeStart.emit();
    this.resize.emit(delta);
    this.resizeEnd.emit();
  }
}
