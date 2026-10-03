import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ViewerController } from '../../viewer-controller';

const THUMB_WIDTH_PX = 112;

/**
 * Page thumbnails beside a PDF. Each is drawn only when it scrolls into the rail (and redrawn after
 * a rotation), one at a time, so a 500-page file costs nothing until you scroll. Each thumbnail is
 * a button "Page n"; the current page is marked `aria-current` and kept in view.
 */
@Component({
  selector: 'file-viewer-pdf-thumbnails',
  template: `
    <nav class="size-full overflow-y-auto bg-[#f3f4f6] p-3" aria-label="Page thumbnails" #rail>
      <ol class="m-0 flex list-none flex-col items-center gap-3 p-0">
        @for (n of pages(); track n) {
          <li>
            <button
              type="button"
              class="thumb flex cursor-pointer flex-col items-center gap-1 rounded-md border-0 bg-transparent p-1 text-xs text-black/70 outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-primary"
              [attr.data-page]="n"
              [attr.aria-label]="'Page ' + n"
              [attr.aria-current]="n === controller.page() ? 'page' : null"
              (click)="controller.goToPage(n)"
            >
              <span
                class="block overflow-hidden rounded-sm bg-white shadow ring-primary"
                [class.ring-2]="n === controller.page()"
                [style.width.px]="thumbWidth"
                [style.height.px]="thumbHeight()"
              >
                <canvas class="block size-full" aria-hidden="true"></canvas>
              </span>
              <span aria-hidden="true">{{ n }}</span>
            </button>
          </li>
        }
      </ol>
    </nav>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfThumbnailsComponent {
  readonly pdf = input.required<PDFDocumentProxy>();

  protected readonly controller = inject(ViewerController);
  private readonly rail = viewChild.required<ElementRef<HTMLElement>>('rail');

  protected readonly thumbWidth = THUMB_WIDTH_PX;
  /** page 1's proportions, used for every placeholder until its own page is drawn */
  private readonly ratio = signal(1.414);
  protected readonly thumbHeight = computed(() => Math.round(THUMB_WIDTH_PX * this.ratio()));
  protected readonly pages = computed(() =>
    Array.from({ length: this.pdf().numPages }, (_, i) => i + 1),
  );

  private readonly drawn = new Set<number>();
  private readonly queue: number[] = [];
  private running?: RenderTask;
  private observer?: IntersectionObserver;
  private destroyed = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.observer?.disconnect();
      this.running?.cancel();
    });

    // rotation (or a new document) invalidates every thumbnail
    effect(() => {
      const pdf = this.pdf();
      const rotation = this.controller.rotation();
      untracked(() => {
        this.running?.cancel();
        this.drawn.clear();
        this.queue.length = 0;
        void pdf.getPage(1).then((page) => {
          const viewport = page.getViewport({ scale: 1, rotation: page.rotate + rotation });
          this.ratio.set(viewport.height / viewport.width);
        });
        this.observeAll();
      });
    });

    // keep the current page's thumbnail in view
    effect(() => {
      const page = this.controller.page();
      untracked(() =>
        this.rail()
          .nativeElement.querySelector(`[data-page="${page}"]`)
          ?.scrollIntoView({ block: 'nearest' }),
      );
    });

    afterNextRender(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset['page']);
            if (entry.isIntersecting && !this.drawn.has(page) && !this.queue.includes(page)) {
              this.queue.push(page);
            }
          }
          void this.drain();
        },
        { root: this.rail().nativeElement, rootMargin: '200px 0px' },
      );
      this.observeAll();
    });
  }

  private observeAll(): void {
    const observer = this.observer;
    if (!observer) return;
    observer.disconnect();
    // after the @for has rendered this document's buttons
    setTimeout(() => {
      for (const el of this.rail().nativeElement.querySelectorAll('.thumb')) observer.observe(el);
    });
  }

  private async drain(): Promise<void> {
    if (this.running || this.destroyed) return;
    const pageNumber = this.queue.shift();
    if (pageNumber === undefined) return;
    try {
      await this.draw(pageNumber);
    } catch {
      // cancelled (rotation / teardown) or a broken page — leave the placeholder
    } finally {
      this.running = undefined;
      void this.drain();
    }
  }

  private async draw(pageNumber: number): Promise<void> {
    const canvas = this.rail().nativeElement.querySelector<HTMLCanvasElement>(
      `[data-page="${pageNumber}"] canvas`,
    );
    if (!canvas) return;
    const page = await this.pdf().getPage(pageNumber);
    const rotation = page.rotate + this.controller.rotation();
    const base = page.getViewport({ scale: 1, rotation });
    const ratio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: (THUMB_WIDTH_PX / base.width) * ratio, rotation });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    // its own proportions — a landscape page in a portrait document
    canvas.parentElement!.style.height = `${Math.round((THUMB_WIDTH_PX * viewport.height) / viewport.width)}px`;
    this.running = page.render({ canvas, viewport });
    await this.running.promise;
    this.drawn.add(pageNumber);
    page.cleanup();
  }
}
