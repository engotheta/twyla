import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
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
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import type { EventBus, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
import { FILE_VIEWER_CONFIG } from '../../file-viewer-config.token';
import { ResolvedFile, ZoomValue } from '../../file-viewer.interface';
import { openInNewTab, printUrl } from '../../loader/file-actions.helpers';
import { readBlob } from '../../loader/text-decode.helpers';
import { ViewerController } from '../../viewer-controller';
import { PdfThumbnailsComponent } from './pdf-thumbnails.component';
import { loadPdfJs } from './pdfjs.loader';

/** pdf.js `FindState` */
const FIND_STATES = ['found', 'not-found', 'wrapped', 'pending'] as const;
/** pdf.js `PasswordResponses.INCORRECT_PASSWORD` */
const INCORRECT_PASSWORD = 2;
const WHEEL_STEP_THRESHOLD = 40;

interface PasswordPrompt {
  incorrect: boolean;
  submit: (password: string) => void;
}

/**
 * A PDF through pdf.js's own viewer engine (`PDFViewer`) under the viewer's toolbar: pages render
 * as they scroll into view, a text layer makes text selectable and readable by screen readers, links
 * work (external ones in a new tab, `noopener`), and `PDFFindController` searches and highlights.
 * No scripting, no form editing. Encrypted files ask for their password. Everything pdf.js holds
 * (worker, document, page caches) is torn down with the component.
 */
@Component({
  selector: 'file-viewer-pdf',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, PdfThumbnailsComponent],
  template: `
    <div class="flex size-full min-h-0">
      @if (controller.thumbnailsOpen() && pdf(); as doc) {
        <file-viewer-pdf-thumbnails class="w-40 shrink-0 border-e border-black/10" [pdf]="doc" />
      }
      <div class="relative min-w-0 flex-1 bg-[#e5e7eb]">
        @if (native(); as fallback) {
          <div class="absolute inset-0 flex flex-col">
            <p
              class="m-0 flex items-center gap-2 border-b border-black/10 bg-amber-50 px-3 py-1.5 text-xs text-amber-950"
            >
              <mat-icon class="!size-4 shrink-0 !text-base" aria-hidden="true">info</mat-icon>
              <span
                >Shown with your browser's PDF viewer — the built-in viewer couldn't open it ({{
                  fallback.reason
                }}).</span
              >
            </p>
            <iframe
              class="min-h-0 w-full flex-1 border-0 bg-white"
              [src]="fallback.url"
              [title]="label() + ' — PDF'"
            ></iframe>
          </div>
        }
        <div
          #container
          [class.invisible]="!!native()"
          class="absolute inset-0 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          tabindex="0"
          role="region"
          data-viewer-scroll
          [attr.aria-label]="label() + ' — PDF document'"
          (wheel)="onWheel($event)"
        >
          <div #viewer class="pdfViewer"></div>
        </div>

        @if (password(); as prompt) {
          <form
            class="absolute inset-0 grid place-items-center bg-white/95 p-4"
            (submit)="$event.preventDefault(); submitPassword(prompt, passwordInput.value)"
          >
            <div class="flex w-full max-w-sm flex-col gap-3">
              <label class="text-sm font-medium" for="pdf-password-{{ uid }}">
                “{{ label() }}” is password-protected. Enter its password to open it.
              </label>
              <input
                #passwordInput
                id="pdf-password-{{ uid }}"
                type="password"
                autocomplete="off"
                class="h-10 rounded border border-black/30 px-3 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                [attr.aria-invalid]="prompt.incorrect || null"
                [attr.aria-describedby]="prompt.incorrect ? 'pdf-password-error-' + uid : null"
              />
              @if (prompt.incorrect) {
                <p id="pdf-password-error-{{ uid }}" class="m-0 text-sm text-red-700" role="alert">
                  Incorrect password — try again.
                </p>
              }
              <button type="submit" matButton="filled" class="self-start">Open</button>
            </div>
          </form>
        }

        @if (busy()) {
          <div class="absolute inset-0 grid place-items-center" role="status">
            <mat-progress-spinner mode="indeterminate" diameter="40" aria-label="Opening PDF" />
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'block size-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfRendererComponent {
  readonly file = input.required<ResolvedFile>();
  /** object URL (or the direct URL) — used for printing / opening */
  readonly url = input<string>();
  readonly label = input('');
  readonly initialPage = input(1);
  readonly failed = output<string>();
  readonly opened = output<number>();

  protected readonly controller = inject(ViewerController);
  private readonly config = inject(FILE_VIEWER_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly viewerElement = viewChild.required<ElementRef<HTMLDivElement>>('viewer');
  private readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');

  protected readonly uid = nextId++;
  protected readonly busy = signal(true);
  protected readonly password = signal<PasswordPrompt | undefined>(undefined);
  /** the open document — the thumbnails read it */
  protected readonly pdf = signal<PDFDocumentProxy | undefined>(undefined);
  /** pdf.js failed: the browser's own viewer shows the file instead */
  protected readonly native = signal<{ url: SafeResourceUrl; reason: string } | undefined>(
    undefined,
  );

  private viewer?: PDFViewer;
  private eventBus?: EventBus;
  private task?: PDFDocumentLoadingTask;
  private wheelDelta = 0;
  private destroyed = false;
  private unregister: () => void;

  constructor() {
    this.unregister = this.controller.register({
      capabilities: {
        zoom: true,
        fitWidth: true,
        rotate: true,
        pages: true,
        search: true,
        thumbnails: true,
        print: true,
      },
      print: () => this.print(),
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.unregister();
      this.teardown();
    });

    afterNextRender(() => void this.init());

    // toolbar → pdf.js
    effect(() => {
      const zoom = this.controller.zoom();
      if (this.viewer?.pagesCount) this.viewer.currentScaleValue = scaleValue(zoom);
    });
    effect(() => {
      const rotation = this.controller.rotation();
      if (this.viewer?.pagesCount) this.viewer.pagesRotation = rotation;
    });
    effect(() => {
      const page = this.controller.page();
      if (this.viewer?.pagesCount && this.viewer.currentPageNumber !== page) {
        this.viewer.currentPageNumber = page;
      }
    });
    effect(() => {
      if (this.password())
        untracked(() => setTimeout(() => this.passwordInput()?.nativeElement.focus()));
    });

    const finds = this.controller.findRequests.subscribe((request) =>
      this.eventBus?.dispatch('find', {
        source: this,
        type: request.type,
        query: request.query,
        caseSensitive: request.caseSensitive,
        entireWord: request.entireWord,
        findPrevious: request.findPrevious,
        highlightAll: true,
        matchDiacritics: false,
      }),
    );
    const closes = this.controller.findClosed.subscribe(() =>
      this.eventBus?.dispatch('findbarclose', { source: this }),
    );
    this.destroyRef.onDestroy(() => {
      finds.unsubscribe();
      closes.unsubscribe();
    });
  }

  private async init(): Promise<void> {
    try {
      const {
        pdfjs,
        viewer: lib,
        assets,
      } = await loadPdfJs(this.document, this.config.pdfAssetsUrl);
      if (this.destroyed) return;

      const eventBus = new lib.EventBus();
      const linkService = new lib.PDFLinkService({
        eventBus,
        externalLinkTarget: lib.LinkTarget.BLANK,
        externalLinkRel: 'noopener noreferrer nofollow',
      });
      const findController = new lib.PDFFindController({ eventBus, linkService });
      const viewer = new lib.PDFViewer({
        container: this.container().nativeElement,
        viewer: this.viewerElement().nativeElement,
        eventBus,
        linkService,
        findController,
        textLayerMode: 1,
        annotationMode: pdfjs.AnnotationMode.ENABLE,
        imageResourcesPath: `${assets}images/`,
      });
      linkService.setViewer(viewer);
      this.viewer = viewer;
      this.eventBus = eventBus;
      this.listen(eventBus);

      const file = this.file();
      const data = file.blob ? new Uint8Array(await readBlob(file.blob)) : undefined;
      if (this.destroyed) return;
      this.task = pdfjs.getDocument({
        ...(data ? { data } : { url: file.directUrl }),
        cMapUrl: `${assets}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`,
        wasmUrl: `${assets}wasm/`,
        iccUrl: `${assets}iccs/`,
        enableXfa: false,
      });
      this.task.onPassword = (submit: (password: string) => void, reason: number) => {
        this.busy.set(false);
        this.password.set({ incorrect: reason === INCORRECT_PASSWORD, submit });
      };

      const pdf = await this.task.promise;
      if (this.destroyed) {
        void pdf.loadingTask.destroy();
        return;
      }
      this.password.set(undefined);
      viewer.setDocument(pdf);
      linkService.setDocument(pdf, null);
      this.pdf.set(pdf);
    } catch (error) {
      if (this.destroyed) return;
      this.busy.set(false);
      this.password.set(undefined);
      // the real cause, for whoever opens the console
      console.error(`[file-viewer] pdf.js could not open "${this.file().name}":`, error);
      if (isMissingAsset(error)) {
        console.error(
          `[file-viewer] pdf.js assets aren't served from "${this.config.pdfAssetsUrl}" — check the ` +
            'pdfjs-dist entries in angular.json "assets" (see the file-viewer README), and restart ' +
            '`ng serve` after changing them: it only reads assets at startup.',
        );
      }
      if (!this.fallBackToBrowser(error)) this.failed.emit(describe(error));
    }
  }

  /**
   * pdf.js couldn't open the file (an engine / worker failure, or a file it's stricter about than
   * the browser): show it in the browser's own PDF viewer instead, when there is one (desktop
   * Chrome, Edge, Firefox, Safari — `navigator.pdfViewerEnabled`) and the bytes are in a blob URL
   * the viewer made itself. Not for wrong passwords — that's the user's call, not a failure.
   */
  private fallBackToBrowser(error: unknown): boolean {
    const url = this.url();
    const name = (error as { name?: string } | null)?.name;
    const hasViewer = (this.document.defaultView?.navigator as { pdfViewerEnabled?: boolean })
      ?.pdfViewerEnabled;
    if (!url?.startsWith('blob:') || hasViewer === false || name === 'PasswordException')
      return false;

    this.teardown();
    this.unregister();
    this.unregister = this.controller.register({
      capabilities: { print: true },
      print: () => this.print(),
    });
    this.controller.pageCount.set(0);
    this.controller.thumbnailsOpen.set(false);
    // our own object URL for these bytes — never a caller-supplied string
    this.native.set({
      url: this.sanitizer.bypassSecurityTrustResourceUrl(url),
      reason: reasonOf(error),
    });
    return true;
  }

  private listen(eventBus: EventBus): void {
    eventBus.on('pagesinit', () => {
      const viewer = this.viewer!;
      viewer.currentScaleValue = scaleValue(this.controller.zoom());
      viewer.pagesRotation = this.controller.rotation();
      const count = viewer.pagesCount;
      this.controller.pageCount.set(count);
      const start = Math.min(count, Math.max(1, this.initialPage()));
      if (start > 1) viewer.currentPageNumber = start;
      this.controller.page.set(viewer.currentPageNumber);
      this.busy.set(false);
      this.opened.emit(count);
    });
    eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => {
      this.controller.page.set(pageNumber);
    });
    eventBus.on('scalechanging', ({ scale }: { scale: number }) =>
      this.controller.scale.set(scale),
    );
    eventBus.on(
      'updatefindmatchescount',
      ({ matchesCount }: { matchesCount: { current: number; total: number } }) =>
        this.controller.findResult.update((r) => ({
          ...r,
          current: matchesCount.current,
          total: matchesCount.total,
        })),
    );
    eventBus.on(
      'updatefindcontrolstate',
      ({
        state,
        matchesCount,
      }: {
        state: number;
        matchesCount?: { current: number; total: number };
      }) =>
        this.controller.findResult.set({
          state: FIND_STATES[state] ?? 'idle',
          current: matchesCount?.current ?? 0,
          total: matchesCount?.total ?? 0,
        }),
    );
  }

  /** Ctrl/⌘ + wheel (and trackpad pinch) zooms in steps instead of zooming the whole page */
  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.wheelDelta += event.deltaY;
    if (Math.abs(this.wheelDelta) < WHEEL_STEP_THRESHOLD) return;
    if (this.wheelDelta < 0) this.controller.zoomIn();
    else this.controller.zoomOut();
    this.wheelDelta = 0;
  }

  protected submitPassword(prompt: PasswordPrompt, password: string): void {
    this.busy.set(true);
    this.password.set(undefined);
    prompt.submit(password);
  }

  /** The browser's own PDF printing (hidden frame) — or a new tab where that's refused. */
  private async print(): Promise<boolean> {
    const url = this.url();
    if (!url) return false;
    const printed = await printUrl(this.document, url);
    if (!printed) openInNewTab(this.document, url);
    return printed;
  }

  /** destroying the loading task destroys its document and frees the worker */
  private teardown(): void {
    this.viewer?.setDocument(null as unknown as PDFDocumentProxy);
    this.viewer?.cleanup();
    void this.task?.destroy();
    this.viewer = undefined;
    this.eventBus = undefined;
  }
}

let nextId = 0;

function scaleValue(zoom: ZoomValue): string {
  if (typeof zoom === 'number') return String(zoom);
  return zoom === 'fit' ? 'page-fit' : zoom === 'fit-width' ? 'page-width' : 'page-actual';
}

function describe(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'InvalidPDFException') return 'This PDF is damaged or not a PDF at all.';
  if (name === 'PasswordException') return 'This PDF could not be unlocked.';
  if (name === 'ResponseException' || name === 'MissingPDFException')
    return 'The PDF could not be downloaded.';
  if (isMissingAsset(error)) return 'The PDF viewer could not start (its assets are missing).';
  return `This PDF could not be opened (${reasonOf(error)}).`;
}

/** the worker / css / a lazy chunk didn't load — a deployment problem, not the file's */
function isMissingAsset(error: unknown): boolean {
  return (
    error instanceof Error &&
    /stylesheet missing|fake worker failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      error.message,
    )
  );
}

/** `UnknownErrorException: Bad FCHECK in flate stream` — short enough for a message line */
function reasonOf(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? 'Error';
  const message = error instanceof Error ? error.message : String(error ?? '');
  const text = message ? `${name}: ${message}` : name;
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
