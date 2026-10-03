import { FocusTrap, FocusTrapFactory } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { catchError, map, Observable, of, startWith, switchMap } from 'rxjs';
import { ActionButton } from '../action-buttons/action-button.interface';
import { syncOverlayContainer } from '../../services/view/fullscreen-overlay.util';
import { NotificationService } from '../../services/notification';
import {
  FileKind,
  FileViewerError,
  FileViewerParameter,
  FileViewerToolbarItem,
  ResolvedFile,
  ViewerAttachmentInput,
  ZoomValue,
} from './file-viewer.interface';
import { openInNewTab, saveBlob } from './loader/file-actions.helpers';
import { FileLoaderService } from './loader/file-loader.service';
import {
  attachmentMeta,
  basename,
  classifyString,
  formatBytes,
  isViewerAttachment,
} from './loader/file-source.helpers';
import { DocxRendererComponent } from './renderers/docx-renderer.component';
import { FileMessageComponent } from './renderers/file-message.component';
import { ImageRendererComponent } from './renderers/image-renderer.component';
import { MediaRendererComponent } from './renderers/media-renderer.component';
import { OfficeOnlineRendererComponent } from './renderers/office-online-renderer.component';
import { PdfRendererComponent } from './renderers/pdf/pdf-renderer.component';
import { SheetRendererComponent } from './renderers/sheet/sheet-renderer.component';
import { TextRendererComponent } from './renderers/text-renderer.component';
import { ViewerController } from './viewer-controller';
import { ViewerFindBarComponent } from './viewer-find-bar.component';
import { ViewerToolbarComponent } from './viewer-toolbar.component';

type ViewState =
  | { status: 'empty' }
  | { status: 'loading'; loaded: number; total?: number }
  | { status: 'ready'; file: ResolvedFile }
  | { status: 'error'; message: string; file?: ResolvedFile };

const KIND_ICONS: Record<FileKind, string> = {
  image: 'image',
  pdf: 'picture_as_pdf',
  docx: 'description',
  sheet: 'table_chart',
  csv: 'table_chart',
  text: 'article',
  audio: 'audio_file',
  video: 'video_file',
  office: 'description',
  unsupported: 'insert_drive_file',
};

const DEFAULT_ZOOM: Partial<Record<FileKind, ZoomValue>> = {
  pdf: 'fit-width',
  docx: 'fit-width',
  sheet: 1,
  csv: 1,
  text: 1,
};

/** resolved files kept while the viewer lives, so stepping back through a gallery is instant */
const CACHE_SIZE = 3;

/** keyboard shortcuts stay out of the way of these — they use the keys themselves */
const OWN_KEYS =
  'input, textarea, select, [contenteditable], video, audio, [role="tablist"], [data-viewer-scroll]';

let nextId = 0;

/**
 * Shows a file — image, PDF, Word, Excel, CSV, text, audio, video — from almost any source (URL,
 * base64, data URL, Blob/File, stream, Observable, Promise, app path); several files get
 * previous / next. Inline as `<file-viewer [attachment]="…" />`, or in a dialog through
 * `FileViewerService.viewAttachment()`.
 *
 * Accepts either a full `params` object (`FileViewerParameter`, a superset of the apps'
 * `AttachmentParameter`) or the individual inputs; individual inputs win.
 */
@Component({
  selector: 'file-viewer',
  imports: [
    NgTemplateOutlet,
    MatProgressBarModule,
    ViewerToolbarComponent,
    ViewerFindBarComponent,
    FileMessageComponent,
    ImageRendererComponent,
    PdfRendererComponent,
    DocxRendererComponent,
    SheetRendererComponent,
    TextRendererComponent,
    MediaRendererComponent,
    OfficeOnlineRendererComponent,
  ],
  templateUrl: './file-viewer.component.html',
  providers: [ViewerController],
  host: {
    class: 'file-viewer flex min-h-0 flex-col overflow-hidden bg-[var(--mat-sys-surface,#fff)]',
    'data-overlay-host': '',
    '(keydown)': 'handleKeydown($event)',
    '(document:fullscreenchange)': 'onFullscreenChange()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileViewerComponent {
  readonly params = input<FileViewerParameter | null>();
  readonly attachment = input<ViewerAttachmentInput | null>();
  readonly attachments = input<readonly ViewerAttachmentInput[] | null>();
  /** which of `attachments` is shown — two-way: `[(index)]` */
  readonly index = model(0);
  readonly title = input<string>();
  readonly showTitle = input<boolean | undefined>(undefined);
  /** shows a close button that emits `closed` (the dialog sets it) */
  readonly closable = input(false, { transform: booleanAttribute });
  readonly toolbar = input<Partial<Record<FileViewerToolbarItem, boolean>>>();
  readonly actionButtons = input<ActionButton<ResolvedFile>[]>();
  /** id of the title heading — a dialog points `aria-labelledby` at it */
  readonly titleId = input(`file-viewer-title-${nextId++}`);
  /** what goes full screen: the viewer itself, or (in a dialog) the whole page */
  readonly fullscreenTarget = input<'host' | 'document'>('host');

  readonly loaded = output<ResolvedFile>();
  readonly failed = output<string>();
  readonly closed = output<void>();
  readonly fullscreenChange = output<boolean>();

  protected readonly controller = inject(ViewerController);
  private readonly loader = inject(FileLoaderService);
  private readonly notify = inject(NotificationService);
  private readonly document = inject(DOCUMENT);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly overlayContainer = inject(OverlayContainer);
  private readonly focusTrapFactory = inject(FocusTrapFactory);

  // ---- inputs, resolved -------------------------------------------------------------------------

  protected readonly items = computed<readonly ViewerAttachmentInput[]>(() => {
    const list = this.attachments() ?? this.params()?.attachments;
    if (list?.length) return list;
    const one = this.attachment() ?? this.params()?.attachment;
    return one === null || one === undefined ? [] : [one];
  });

  /** the shown file's position — follows `index` and `params.index`, and is set by navigation */
  private readonly selected = linkedSignal<{ p: number | undefined; i: number }, number>({
    source: () => ({ p: this.params()?.index, i: this.index() }),
    computation: (source, previous) =>
      previous && (source.p === previous.source.p || source.p === undefined)
        ? source.i
        : (source.p ?? source.i),
  });
  protected readonly position = computed(() => {
    const count = this.items().length;
    return count ? Math.min(count - 1, Math.max(0, this.selected())) : 0;
  });
  private readonly current = computed(() => this.items()[this.position()]);

  protected readonly showTitle_ = computed(
    () => this.showTitle() ?? this.params()?.showTitle ?? true,
  );
  protected readonly toolbar_ = computed(() => this.toolbar() ?? this.params()?.toolbar ?? {});
  protected readonly actionButtons_ = computed(
    () => this.actionButtons() ?? this.params()?.actionButtons ?? [],
  );
  protected readonly closable_ = computed(
    () => this.closable() && this.params()?.showCloseBtn !== false,
  );
  protected readonly names = computed(() =>
    this.items().map((item, i) => inputName(item) ?? `File ${i + 1}`),
  );

  // ---- loading ----------------------------------------------------------------------------------

  private readonly reload = signal(0);
  private readonly cache = new Map<ViewerAttachmentInput, ResolvedFile>();

  private readonly state = toSignal(
    toObservable(computed(() => ({ input: this.current(), tick: this.reload() }))).pipe(
      switchMap(({ input }) => this.load$(input)),
    ),
    { initialValue: { status: 'loading', loaded: 0 } as ViewState },
  );

  /** a renderer that couldn't show the file it got (damaged PDF, unplayable video…) */
  private readonly renderError = signal<string | undefined>(undefined);
  /** the user asked for Office Online from the "not available" / error card */
  private readonly useOfficeOnline = signal(false);

  protected readonly view = computed<ViewState>(() => {
    const state = this.state();
    const error = this.renderError();
    if (state.status === 'ready' && error && !this.useOfficeOnline()) {
      return { status: 'error', message: error, file: state.file };
    }
    return state;
  });

  /** the file in hand — shown, or behind an error card */
  protected readonly file = computed<ResolvedFile | undefined>(() => {
    const view = this.view();
    const file = view.status === 'ready' || view.status === 'error' ? view.file : undefined;
    return file && this.useOfficeOnline() ? { ...file, external: true } : file;
  });
  /** the ready file, keyed: a new file re-creates its renderer instead of patching the old one */
  protected readonly shown = computed(() => {
    const file = this.file();
    return this.view().status === 'ready' && file ? [{ file, key: this.renderKey(file) }] : [];
  });
  private readonly renderKeys = new WeakMap<ResolvedFile, number>();
  private nextRenderKey = 0;

  private readonly objectUrl = signal<string | undefined>(undefined);
  /** what renderers / new tab / print load: an object URL for the bytes, else the direct URL */
  protected readonly url = computed(() => this.objectUrl() ?? this.file()?.directUrl);

  protected readonly heading = computed(() => {
    const file = this.file();
    return (
      this.title() ??
      this.params()?.title ??
      file?.original?.name ??
      file?.name ??
      this.names()[this.position()] ??
      'File'
    );
  });
  protected readonly details = computed(() => {
    const file = this.file();
    if (!file) return '';
    const type = (file.original ?? file).extension.toUpperCase() || file.mime || 'File';
    const parts = [type, formatBytes((file.original ?? file).size)];
    if (file.converted) parts.push(`shown as ${file.extension.toUpperCase()}`);
    if (file.external) parts.push('via Office Online');
    return parts.filter(Boolean).join(' · ');
  });
  protected readonly icon = computed(
    () => KIND_ICONS[(this.file()?.original ?? this.file())?.kind ?? 'unsupported'],
  );
  protected readonly percent = computed(() => {
    const view = this.view();
    return view.status === 'loading' && view.total
      ? Math.min(100, (view.loaded / view.total) * 100)
      : undefined;
  });
  protected readonly progressText = computed(() => {
    const view = this.view();
    if (view.status !== 'loading' || !view.loaded) return '';
    return view.total
      ? `${formatBytes(view.loaded)} of ${formatBytes(view.total)}`
      : formatBytes(view.loaded);
  });
  protected readonly officeEligible = computed(() => {
    const file = this.file();
    return !!file && !file.external && !!this.loader.officeOnlineUrl(file.original ?? file);
  });
  protected readonly unavailableMessage = computed(() => {
    const file = this.file();
    if (!file) return '';
    const ext = file.extension.toUpperCase();
    return file.kind === 'office'
      ? `There's no in-browser preview for ${ext || 'this kind of'} files. Download it to open it in its app.`
      : `${ext ? ext + ' files' : 'This kind of file'} can't be previewed. Download it to open it.`;
  });

  protected readonly initialPage = signal(1);
  protected readonly isFullscreen = signal(false);
  protected readonly fullscreenSupported = !!this.document.fullscreenEnabled;
  private fullscreenElement?: Element;
  private fullscreenTrap?: FocusTrap;
  private firstFile = true;

  constructor() {
    // object URL for the bytes, revoked as soon as the file changes or the viewer goes
    effect((onCleanup) => {
      const blob = this.file()?.blob;
      if (!blob) {
        this.objectUrl.set(undefined);
        return;
      }
      const url = URL.createObjectURL(blob);
      this.objectUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });

    // a new file: fresh zoom / rotation / page, no stale render error
    effect(() => {
      const state = this.state();
      const file = state.status === 'ready' ? state.file : undefined;
      untracked(() => {
        this.renderError.set(undefined);
        this.useOfficeOnline.set(false);
        if (!file) return;
        const params = this.params();
        const page = this.firstFile ? (params?.initialPage ?? 1) : 1;
        this.initialPage.set(page);
        this.controller.reset(params?.initialZoom ?? DEFAULT_ZOOM[file.kind] ?? 'fit', page);
        this.firstFile = false;
        this.loaded.emit(file);
        this.controller.announce(
          this.items().length > 1
            ? `File ${this.position() + 1} of ${this.items().length}: ${file.name}`
            : `Opened ${file.name}`,
        );
      });
    });

    effect(() => {
      const view = this.view();
      if (view.status === 'error') untracked(() => this.failed.emit(view.message));
    });

    inject(DestroyRef).onDestroy(() => {
      this.fullscreenTrap?.destroy();
      if (this.fullscreenElement && this.document.fullscreenElement === this.fullscreenElement) {
        void this.document.exitFullscreen();
      }
    });
  }

  private load$(input: ViewerAttachmentInput | undefined): Observable<ViewState> {
    if (input === undefined || input === null) return of({ status: 'empty' });
    const cached = this.cache.get(input);
    if (cached) return of({ status: 'ready', file: cached });
    return this.loader.load$(input).pipe(
      map((event): ViewState => {
        if (event.type === 'progress')
          return { status: 'loading', loaded: event.loaded, total: event.total };
        this.remember(input, event.file);
        return { status: 'ready', file: event.file };
      }),
      startWith<ViewState>({ status: 'loading', loaded: 0 }),
      catchError((err: unknown) =>
        of<ViewState>({
          status: 'error',
          message: err instanceof FileViewerError ? err.message : 'This file could not be loaded.',
          file: err instanceof FileViewerError ? err.file : undefined,
        }),
      ),
    );
  }

  private renderKey(file: ResolvedFile): number {
    let key = this.renderKeys.get(file);
    if (key === undefined) this.renderKeys.set(file, (key = this.nextRenderKey++));
    return key;
  }

  private remember(input: ViewerAttachmentInput, file: ResolvedFile): void {
    this.cache.delete(input);
    this.cache.set(input, file);
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
  }

  // ---- actions ----------------------------------------------------------------------------------

  protected navigate(index: number): void {
    this.selected.set(index);
    this.index.set(index);
  }

  protected retry(): void {
    const input = this.current();
    if (input !== undefined) this.cache.delete(input);
    this.renderError.set(undefined);
    this.reload.update((n) => n + 1);
  }

  protected renderFailed(message: string): void {
    this.renderError.set(message);
  }

  protected showOfficeOnline(): void {
    this.renderError.set(undefined);
    this.useOfficeOnline.set(true);
  }

  protected async download(): Promise<void> {
    const shown = this.file();
    if (!shown) return;
    // a converted file downloads as uploaded; one viewed by URL alone is fetched first
    const file = shown.original ?? shown;
    try {
      const blob =
        file.blob ??
        (await this.loader.resolve(file.source, { convert: false, external: false, direct: false }))
          .blob;
      if (!blob) throw new Error('no bytes');
      saveBlob(this.document, blob, file.name);
    } catch (err) {
      this.notify.error(
        err instanceof FileViewerError ? err.message : `Couldn't download ${file.name}.`,
      );
    }
  }

  protected openInNewTab(): void {
    const file = this.file();
    const url = file?.external ? file.publicUrl : this.url();
    if (url) openInNewTab(this.document, url);
  }

  protected async print(): Promise<void> {
    const printed = await this.controller.print();
    if (!printed)
      this.notify.warn(
        "The browser didn't open the print dialog — try opening the file in a new tab.",
      );
  }

  protected focusFindToggle(): void {
    this.host.querySelector<HTMLElement>('[data-viewer-find-toggle]')?.focus();
  }

  protected close(): void {
    this.closed.emit();
  }

  // ---- full screen ------------------------------------------------------------------------------

  protected toggleFullscreen(): void {
    if (this.isFullscreen()) {
      void this.document.exitFullscreen();
      return;
    }
    const target =
      this.fullscreenTarget() === 'document' ? this.document.documentElement : this.host;
    this.fullscreenElement = target;
    target.requestFullscreen().catch(() => (this.fullscreenElement = undefined));
  }

  /** mirrors the browser's state — left via our button or Esc; overlays (menus, tooltips) move in */
  protected onFullscreenChange(): void {
    syncOverlayContainer(this.document, this.overlayContainer.getContainerElement());
    const active =
      !!this.fullscreenElement && this.document.fullscreenElement === this.fullscreenElement;
    if (!active) this.fullscreenElement = undefined;
    if (active === this.isFullscreen()) return;
    this.isFullscreen.set(active);
    this.fullscreenTrap?.destroy();
    this.fullscreenTrap =
      active && this.fullscreenTarget() === 'host'
        ? this.focusTrapFactory.create(this.host)
        : undefined;
    this.fullscreenChange.emit(active);
  }

  // ---- keyboard ---------------------------------------------------------------------------------

  /** The viewer's shortcuts. Bound on the host; a wrapper whose focus sits outside the viewer (the
   *  dialog container) forwards its keys here too. */
  handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const mod = event.ctrlKey || event.metaKey;
    const searchable = this.controller.capabilities().search && this.toolbar_().search !== false;

    if (mod && !event.altKey && event.key.toLowerCase() === 'f' && searchable) {
      event.preventDefault();
      this.controller.openFind();
      return;
    }
    if (mod || event.altKey || target.closest('input, textarea, select, [contenteditable]')) return;
    if (this.handleKey(event.key, event.shiftKey, target)) event.preventDefault();
  }

  /** true when `key` did something here */
  private handleKey(key: string, shift: boolean, target: HTMLElement): boolean {
    const caps = this.controller.capabilities();
    const allowed = this.toolbar_();
    const zoom = !!caps.zoom && allowed.zoom !== false;
    switch (key) {
      case '+':
      case '=':
        if (zoom) this.controller.zoomIn();
        return zoom;
      case '-':
      case '_':
        if (zoom) this.controller.zoomOut();
        return zoom;
      case '0':
        if (zoom) this.controller.setZoom(DEFAULT_ZOOM[this.file()?.kind ?? 'image'] ?? 'fit');
        return zoom;
      case 'r':
      case 'R': {
        const rotate = !!caps.rotate && allowed.rotate !== false;
        if (rotate) this.controller.rotate(shift ? -90 : 90);
        return rotate;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        const count = this.items().length;
        if (count < 2 || allowed.navigation === false || target.closest(OWN_KEYS)) return false;
        this.navigate((this.position() + (key === 'ArrowRight' ? 1 : -1) + count) % count);
        return true;
      }
      default:
        return false;
    }
  }
}

/** A name for the file menu before the file is loaded. */
function inputName(input: ViewerAttachmentInput): string | undefined {
  if (isViewerAttachment(input)) return attachmentMeta(input).name;
  if (typeof File !== 'undefined' && input instanceof File) return input.name;
  if (typeof input === 'string' && classifyString(input) === 'url') return basename(input);
  return undefined;
}
