import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ResolvedFile } from '../file-viewer.interface';
import { escapeHtml, printHtml } from '../loader/file-actions.helpers';
import { MAX_ZOOM, MIN_ZOOM, ViewerController } from '../viewer-controller';

const PAN_STEP_PX = 48;
const WHEEL_ZOOM_SPEED = 0.0025;

interface Point {
  x: number;
  y: number;
}

/**
 * An image with zoom (buttons, Ctrl/⌘ + wheel, trackpad / touch pinch, double-click), pan (drag,
 * wheel, arrow keys once zoomed past the frame) and 90° rotation. A plain `<img>` — SVGs included,
 * so their scripts never run; `NgOptimizedImage` can't take blob/data URLs.
 */
@Component({
  selector: 'file-viewer-image',
  template: `
    <div
      #stage
      class="relative size-full touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      tabindex="0"
      role="group"
      aria-roledescription="image viewer"
      [attr.aria-label]="label()"
      [class.cursor-grab]="pannable() && !dragging()"
      [class.cursor-grabbing]="dragging()"
      (wheel)="onWheel($event)"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (dblclick)="onDoubleClick($event)"
      (keydown)="onKeydown($event)"
    >
      @if (url(); as src) {
        <img
          [src]="src"
          [alt]="label()"
          draggable="false"
          class="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
          [class.invisible]="!natural().w"
          [style.width.px]="natural().w || null"
          [style.height.px]="natural().h || null"
          [style.transform]="transform()"
          (load)="onLoad($event)"
          (error)="failed.emit('This image could not be displayed.')"
        />
      }
    </div>
  `,
  host: { class: 'block size-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageRendererComponent {
  readonly file = input.required<ResolvedFile>();
  readonly url = input<string>();
  /** alt text and the stage's accessible name */
  readonly label = input('');
  readonly failed = output<string>();

  private readonly controller = inject(ViewerController);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');

  protected readonly natural = signal({ w: 0, h: 0 });
  private readonly frame = signal({ w: 0, h: 0 });
  private readonly pan = signal<Point>({ x: 0, y: 0 });
  protected readonly dragging = signal(false);

  private readonly pointers = new Map<number, Point>();
  private pinch?: { distance: number; scale: number };

  /** the image's box once rotated */
  private readonly rotated = computed(() => {
    const { w, h } = this.natural();
    return this.controller.rotation() % 180 ? { w: h, h: w } : { w, h };
  });

  private readonly scale = computed(() => {
    const zoom = this.controller.zoom();
    if (typeof zoom === 'number') return zoom;
    const { w, h } = this.rotated();
    const frame = this.frame();
    if (!w || !h || !frame.w || !frame.h) return 1;
    if (zoom === 'actual') return 1;
    if (zoom === 'fit-width') return frame.w / w;
    return Math.min(1, frame.w / w, frame.h / h); // fit — never blown up past 100%
  });

  /** how far the image may move each way before its edge leaves the frame's */
  private readonly panLimit = computed(() => {
    const { w, h } = this.rotated();
    const s = this.scale();
    const frame = this.frame();
    return { x: Math.max(0, (w * s - frame.w) / 2), y: Math.max(0, (h * s - frame.h) / 2) };
  });

  private readonly clampedPan = computed(() => {
    const { x, y } = this.pan();
    const limit = this.panLimit();
    return { x: clamp(x, -limit.x, limit.x), y: clamp(y, -limit.y, limit.y) };
  });

  protected readonly pannable = computed(() => {
    const limit = this.panLimit();
    return limit.x > 0.5 || limit.y > 0.5;
  });

  protected readonly transform = computed(() => {
    const { x, y } = this.clampedPan();
    return `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${this.controller.rotation()}deg) scale(${this.scale()})`;
  });

  constructor() {
    const unregister = this.controller.register({
      capabilities: { zoom: true, rotate: true, print: true },
      print: () => this.print(),
    });
    this.destroyRef.onDestroy(unregister);

    effect(() => this.controller.scale.set(this.scale()));
    // a new image, or back to a fit mode: recentre
    effect(() => {
      this.url();
      if (typeof this.controller.zoom() !== 'number') untracked(() => this.pan.set({ x: 0, y: 0 }));
    });

    afterNextRender(() => {
      const stage = this.stage().nativeElement;
      const observer = new ResizeObserver(([entry]) =>
        this.frame.set({ w: entry.contentRect.width, h: entry.contentRect.height }),
      );
      observer.observe(stage);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected onLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.natural.set({ w: img.naturalWidth || 300, h: img.naturalHeight || 150 });
  }

  protected onWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.zoomAt(
        this.scale() * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED),
        event.clientX,
        event.clientY,
      );
    } else if (this.pannable()) {
      event.preventDefault();
      this.panBy(-event.deltaX, -event.deltaY);
    }
  }

  protected onDoubleClick(event: MouseEvent): void {
    const fit = this.controller.zoom();
    const target =
      typeof fit !== 'number' && this.scale() < 0.999 ? 1 : typeof fit !== 'number' ? 2 : undefined;
    if (target === undefined) {
      this.controller.setZoom('fit');
      return;
    }
    this.zoomAt(target, event.clientX, event.clientY);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.pannable() || event.altKey || event.ctrlKey || event.metaKey) return;
    const step: Record<string, Point> = {
      ArrowLeft: { x: PAN_STEP_PX, y: 0 },
      ArrowRight: { x: -PAN_STEP_PX, y: 0 },
      ArrowUp: { x: 0, y: PAN_STEP_PX },
      ArrowDown: { x: 0, y: -PAN_STEP_PX },
    };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault(); // also tells the viewer not to switch files
    this.panBy(delta.x, delta.y);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.stage().nativeElement.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      this.pinch = { distance: this.pointerDistance(), scale: this.scale() };
      this.dragging.set(false);
    } else {
      this.dragging.set(this.pannable());
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const point = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, point);

    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const distance = this.pointerDistance();
      if (this.pinch.distance > 0) {
        this.zoomAt(
          (this.pinch.scale * distance) / this.pinch.distance,
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
        );
      }
    } else if (this.dragging()) {
      this.panBy(point.x - previous.x, point.y - previous.y);
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinch = undefined;
    if (!this.pointers.size) this.dragging.set(false);
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /** zoom to `next`, keeping the image point under (clientX, clientY) where it is */
  private zoomAt(next: number, clientX: number, clientY: number): void {
    const scale = this.scale();
    const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const rect = this.stage().nativeElement.getBoundingClientRect();
    const px = clientX - rect.left - rect.width / 2;
    const py = clientY - rect.top - rect.height / 2;
    const { x, y } = this.clampedPan();
    // wheel / pinch zoom is continuous — set it quietly instead of announcing every tick
    this.controller.zoom.set(target);
    this.pan.set({ x: px - ((px - x) * target) / scale, y: py - ((py - y) * target) / scale });
  }

  private panBy(dx: number, dy: number): void {
    const { x, y } = this.clampedPan();
    this.pan.set({ x: x + dx, y: y + dy });
  }

  private print(): Promise<boolean> {
    const url = this.url();
    if (!url) return Promise.resolve(false);
    const turned = this.controller.rotation() % 180 !== 0;
    const size = turned ? 'max-width:100vh;max-height:100vw' : 'max-width:100%;max-height:100vh';
    return printHtml(
      this.document,
      this.file().name,
      `<img src="${escapeHtml(url)}" alt="${escapeHtml(this.label())}" style="display:block;margin:auto;${size};transform:rotate(${this.controller.rotation()}deg)">`,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
