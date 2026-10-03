import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActionButtonsComponent } from '@components/action-buttons/action-buttons.component';
import { ActionButton } from '@components/action-buttons/action-button.interface';
import { FileViewerToolbarItem, ResolvedFile, ZoomValue } from '../file-viewer.interface';
import { ViewerController, ZOOM_LABELS } from '../viewer-controller';

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/**
 * The viewer's toolbar. File-level actions (download, print, navigation, fullscreen, close) come in
 * as inputs / go out as outputs; document controls (zoom, rotate, pages, search, thumbnails) talk
 * to the shared `ViewerController` and show only when the active renderer supports them. Narrow
 * viewers (container query) fold the secondary actions into a "More" menu.
 */
@Component({
  selector: 'file-viewer-toolbar',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    ActionButtonsComponent,
  ],
  templateUrl: './viewer-toolbar.component.html',
  host: { class: '@container block border-b border-black/10 bg-[var(--mat-sys-surface,#fff)]' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerToolbarComponent {
  readonly titleId = input.required<string>();
  readonly heading = input('');
  readonly showTitle = input(true);
  /** type · size */
  readonly details = input('');
  readonly icon = input('description');
  readonly file = input<ResolvedFile>();
  /** which items the consumer allows (all by default) */
  readonly items = input<Partial<Record<FileViewerToolbarItem, boolean>>>({});
  readonly index = input(0);
  readonly names = input<readonly string[]>([]);
  readonly canDownload = input(false);
  readonly canOpen = input(false);
  readonly fullscreen = input(false);
  readonly fullscreenSupported = input(true);
  readonly closable = input(false);
  readonly actionButtons = input<ActionButton<ResolvedFile>[]>([]);

  readonly download = output<void>();
  readonly print = output<void>();
  readonly openInNewTab = output<void>();
  readonly toggleFullscreen = output<void>();
  readonly closed = output<void>();
  readonly navigate = output<number>();

  protected readonly controller = inject(ViewerController);
  protected readonly zoomPresets = ZOOM_PRESETS;
  protected readonly zoomLabels = ZOOM_LABELS;

  private readonly caps = this.controller.capabilities;
  private allowed(item: FileViewerToolbarItem): boolean {
    return this.items()[item] !== false;
  }

  protected readonly show = computed(() => {
    const caps = this.caps();
    const ready = !!this.file();
    return {
      search: ready && !!caps.search && this.allowed('search'),
      thumbnails: ready && !!caps.thumbnails && this.allowed('thumbnails'),
      zoom: ready && !!caps.zoom && this.allowed('zoom'),
      fitWidth: !!caps.fitWidth,
      rotate: ready && !!caps.rotate && this.allowed('rotate'),
      pages: ready && !!caps.pages && this.allowed('pages') && this.controller.pageCount() > 0,
      navigation: this.names().length > 1 && this.allowed('navigation'),
      download: this.canDownload() && this.allowed('download'),
      print: ready && !!caps.print && this.allowed('print'),
      open: this.canOpen() && this.allowed('openInNewTab'),
      fullscreen: this.fullscreenSupported() && this.allowed('fullscreen'),
    };
  });

  protected readonly hasMore = computed(() => {
    const s = this.show();
    return s.print || s.open || s.fullscreen;
  });

  protected readonly zoomText = computed(() => `${Math.round(this.controller.scale() * 100)}%`);

  protected zoomTo(zoom: ZoomValue): void {
    this.controller.setZoom(zoom);
  }

  protected goToPage(input: HTMLInputElement): void {
    const page = Number(input.value);
    if (Number.isFinite(page)) this.controller.goToPage(page);
    input.value = String(this.controller.page());
  }

  protected step(delta: number): void {
    const count = this.names().length;
    this.navigate.emit((this.index() + delta + count) % count);
  }
}
