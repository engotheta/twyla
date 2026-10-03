import { LiveAnnouncer } from '@angular/cdk/a11y';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { ZoomValue } from './file-viewer.interface';

/** What the active renderer supports — the toolbar shows only these controls. */
export interface RendererCapabilities {
  zoom?: boolean;
  /** offers the Fit width preset (documents) besides Fit / 100% */
  fitWidth?: boolean;
  rotate?: boolean;
  pages?: boolean;
  search?: boolean;
  thumbnails?: boolean;
  print?: boolean;
}

/** A renderer's registration: its capabilities plus the commands only it can carry out. */
export interface RendererHandle {
  capabilities: RendererCapabilities;
  /** resolves false when the browser refused to print */
  print?: () => Promise<boolean>;
}

export interface FindRequest {
  query: string;
  caseSensitive: boolean;
  entireWord: boolean;
  /** '' starts a new search, 'again' moves to the next / previous match */
  type: '' | 'again';
  findPrevious: boolean;
}

export interface FindResult {
  state: 'idle' | 'pending' | 'found' | 'not-found' | 'wrapped';
  current: number;
  total: number;
}

/** Zoom steps the +/- buttons and keys move through. */
export const ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
];
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

const IDLE_FIND: FindResult = { state: 'idle', current: 0, total: 0 };

/**
 * The state one viewer's toolbar and its active renderer share — provided by `FileViewerComponent`,
 * so every viewer (inline or in a dialog) gets its own. The toolbar writes requests (zoom, rotation,
 * page, find); the renderer applies them and reports back what it actually did (effective scale,
 * page count, current page, matches).
 */
@Injectable()
export class ViewerController {
  private readonly announcer = inject(LiveAnnouncer);

  /** requested zoom — a fit mode or a factor */
  readonly zoom = signal<ZoomValue>('fit');
  /** the factor the renderer ended up at (what "Fit" came to), for the % display and +/- steps */
  readonly scale = signal(1);
  readonly rotation = signal(0);
  /** 1-based; the renderer keeps it in sync with scrolling */
  readonly page = signal(1);
  readonly pageCount = signal(0);
  readonly thumbnailsOpen = signal(false);
  readonly findOpen = signal(false);
  readonly findResult = signal<FindResult>(IDLE_FIND);
  readonly findRequests = new Subject<FindRequest>();
  readonly findClosed = new Subject<void>();

  private readonly handle = signal<RendererHandle | undefined>(undefined);
  readonly capabilities = computed<RendererCapabilities>(() => this.handle()?.capabilities ?? {});

  /** A renderer announces itself; the returned function unregisters it (call it on destroy). */
  register(handle: RendererHandle): () => void {
    this.handle.set(handle);
    return () => {
      if (this.handle() === handle) this.handle.set(undefined);
    };
  }

  /** Back to defaults for a new file. */
  reset(zoom: ZoomValue, page = 1): void {
    this.zoom.set(zoom);
    this.scale.set(1);
    this.rotation.set(0);
    this.page.set(Math.max(1, page));
    this.pageCount.set(0);
    this.findOpen.set(false);
    this.findResult.set(IDLE_FIND);
  }

  zoomIn(): void {
    const current = this.scale();
    this.setZoom(ZOOM_STEPS.find((step) => step > current + 0.001) ?? MAX_ZOOM);
  }

  zoomOut(): void {
    const current = this.scale();
    this.setZoom([...ZOOM_STEPS].reverse().find((step) => step < current - 0.001) ?? MIN_ZOOM);
  }

  setZoom(zoom: ZoomValue): void {
    const value = typeof zoom === 'number' ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) : zoom;
    this.zoom.set(value);
    if (typeof value === 'number') this.announce(`Zoom ${Math.round(value * 100)}%`);
    else this.announce(ZOOM_LABELS[value]);
  }

  rotate(delta = 90): void {
    this.rotation.update((r) => (((r + delta) % 360) + 360) % 360);
    this.announce(`Rotated to ${this.rotation()} degrees`);
  }

  goToPage(page: number): void {
    const count = this.pageCount();
    if (!count) return;
    this.page.set(Math.min(count, Math.max(1, Math.round(page))));
  }

  toggleThumbnails(): void {
    this.thumbnailsOpen.update((open) => !open);
  }

  openFind(): void {
    this.findOpen.set(true);
  }

  closeFind(): void {
    this.findOpen.set(false);
    this.findResult.set(IDLE_FIND);
    this.findClosed.next();
  }

  find(request: FindRequest): void {
    if (!request.query) {
      this.findResult.set(IDLE_FIND);
      this.findClosed.next();
      return;
    }
    this.findResult.update((r) => ({ ...r, state: 'pending' }));
    this.findRequests.next(request);
  }

  print(): Promise<boolean> {
    return this.handle()?.print?.() ?? Promise.resolve(false);
  }

  /** Polite screen-reader message. */
  announce(message: string): void {
    void this.announcer.announce(message, 'polite');
  }
}

export const ZOOM_LABELS: Record<Exclude<ZoomValue, number>, string> = {
  fit: 'Fit to view',
  'fit-width': 'Fit width',
  actual: 'Actual size',
};
