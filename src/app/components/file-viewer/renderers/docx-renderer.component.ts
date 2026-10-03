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
  viewChild,
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ResolvedFile } from '../file-viewer.interface';
import { printHtml } from '../loader/file-actions.helpers';
import { ViewerController } from '../viewer-controller';

/** room kept around the pages when fitting their width */
const GUTTER_PX = 48;

/** styles inside the shadow root: pages as sheets of paper on a grey desk, our colours not Word's */
const SHADOW_CSS = `
  :host { display: block; }
  .docx-wrapper { background: transparent !important; padding: 24px !important; display: flex; flex-direction: column; align-items: center; }
  .docx-wrapper > section.docx { box-shadow: 0 1px 3px rgb(0 0 0 / .2), 0 4px 12px rgb(0 0 0 / .08) !important; margin-bottom: 24px !important; }
  a[href] { color: #1d4ed8; }
`;

/**
 * A .docx rendered by `docx-preview` into a shadow root, so neither Tailwind's reset nor the
 * document's own styles leak across. Hardened: embedded HTML chunks (`altChunk`) are never rendered,
 * links that aren't http(s) / mailto are disarmed, and in-document links scroll inside the viewer
 * instead of changing the app's URL. Images are inlined as data URLs, so nothing leaks object URLs.
 */
@Component({
  selector: 'file-viewer-docx',
  imports: [MatProgressSpinnerModule],
  template: `
    <div
      #scroller
      class="relative size-full overflow-auto bg-[#e5e7eb] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      tabindex="0"
      role="region"
      data-viewer-scroll
      [attr.aria-label]="label() + ' — Word document'"
    >
      <div #host [style.zoom]="scale()"></div>
      @if (busy()) {
        <div class="absolute inset-0 grid place-items-center" role="status">
          <mat-progress-spinner mode="indeterminate" diameter="40" aria-label="Opening document" />
        </div>
      }
    </div>
  `,
  host: { class: 'block size-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocxRendererComponent {
  readonly file = input.required<ResolvedFile>();
  readonly label = input('');
  readonly failed = output<string>();

  private readonly controller = inject(ViewerController);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  protected readonly busy = signal(true);
  private readonly frameWidth = signal(0);
  private readonly pageWidth = signal(0);
  private shadow?: ShadowRoot;

  protected readonly scale = computed(() => {
    const zoom = this.controller.zoom();
    if (typeof zoom === 'number') return zoom;
    if (zoom === 'actual' || !this.pageWidth() || !this.frameWidth()) return 1;
    const fit = (this.frameWidth() - GUTTER_PX) / this.pageWidth();
    return zoom === 'fit-width' ? fit : Math.min(1, fit);
  });

  constructor() {
    const unregister = this.controller.register({
      capabilities: { zoom: true, fitWidth: true, print: true },
      print: () => this.print(),
    });
    this.destroyRef.onDestroy(unregister);
    effect(() => this.controller.scale.set(this.scale()));

    afterNextRender(() => {
      const scroller = this.scroller().nativeElement;
      const observer = new ResizeObserver(([entry]) =>
        this.frameWidth.set(entry.contentRect.width),
      );
      observer.observe(scroller);
      this.destroyRef.onDestroy(() => observer.disconnect());
      void this.render();
    });
  }

  private async render(): Promise<void> {
    const blob = this.file().blob;
    if (!blob) {
      this.failed.emit('There is no document to show.');
      return;
    }
    try {
      const { renderAsync } = await import('docx-preview');
      const shadow = (this.shadow = this.host().nativeElement.attachShadow({ mode: 'open' }));
      const base = this.document.createElement('style');
      base.textContent = SHADOW_CSS;
      const styles = this.document.createElement('div');
      const body = this.document.createElement('div');
      shadow.append(base, styles, body);

      await renderAsync(blob, body, styles, {
        className: 'docx',
        inWrapper: true,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        useBase64URL: true,
        renderAltChunks: false,
        renderComments: false,
        renderChanges: false,
        experimental: false,
      });
      disarmLinks(body, shadow);
      this.pageWidth.set(body.querySelector<HTMLElement>('section.docx')?.offsetWidth ?? 0);
      this.busy.set(false);
    } catch {
      this.busy.set(false);
      this.failed.emit(
        'This Word document could not be opened — it may be damaged or in an older format.',
      );
    }
  }

  private print(): Promise<boolean> {
    if (!this.shadow) return Promise.resolve(false);
    const css = [...this.shadow.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    const body = this.shadow.querySelector('.docx-wrapper')?.outerHTML ?? '';
    return printHtml(
      this.document,
      this.file().name,
      body,
      `${css}\n.docx-wrapper{padding:0!important;display:block}.docx-wrapper>section.docx{box-shadow:none!important;margin:0 auto!important;break-after:page}`,
    );
  }
}

/** http(s) / mailto open in a new tab; `#bookmark` scrolls within the viewer; anything else is disarmed. */
function disarmLinks(body: HTMLElement, root: ShadowRoot): void {
  for (const link of body.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = (link.getAttribute('href') ?? '').trim();
    if (href.startsWith('#')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = root.getElementById(decodeURIComponent(href.slice(1)));
        target?.scrollIntoView({ block: 'start' });
      });
    } else if (/^(https?:|mailto:)/i.test(href)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
    } else {
      link.removeAttribute('href');
    }
  }
}
