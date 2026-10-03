import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FILE_VIEWER_CONFIG } from '../file-viewer-config.token';
import { ResolvedFile } from '../file-viewer.interface';
import { escapeHtml, printHtml } from '../loader/file-actions.helpers';
import { formatBytes } from '../loader/file-source.helpers';
import { readText } from '../loader/text-decode.helpers';
import { ViewerController } from '../viewer-controller';

const BASE_FONT_PX = 13;
/** line numbers are drawn only up to this many lines (and only when lines don't wrap) */
const MAX_NUMBERED_LINES = 20_000;
const TOGGLE =
  'inline-flex h-7 items-center gap-1 rounded-full border border-black/15 px-2.5 text-xs aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary';

/**
 * Plain text, code, JSON, XML, Markdown, logs — always as text (HTML / XML / SVG source is never
 * rendered). Large files show their first `maxTextBytes`. JSON gets a pretty / raw toggle.
 */
@Component({
  selector: 'file-viewer-text',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="flex h-full min-h-0 flex-col">
      <div class="flex flex-wrap items-center gap-2 border-b border-black/10 px-3 py-1.5">
        <button
          type="button"
          [class]="toggle"
          [attr.aria-pressed]="wrap()"
          (click)="wrap.set(!wrap())"
        >
          <mat-icon class="!size-4 !text-base" aria-hidden="true">wrap_text</mat-icon> Wrap lines
        </button>
        @if (isJson()) {
          <button
            type="button"
            [class]="toggle"
            [attr.aria-pressed]="pretty()"
            (click)="pretty.set(!pretty())"
          >
            <mat-icon class="!size-4 !text-base" aria-hidden="true">data_object</mat-icon> Format
            JSON
          </button>
        }
        @if (truncated()) {
          <span class="text-xs text-black/70">
            Showing the first {{ limit }} of {{ size() }} — download the file to see all of it.
          </span>
        }
      </div>

      <div
        class="min-h-0 flex-1 overflow-auto bg-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        tabindex="0"
        role="region"
        data-viewer-scroll
        [attr.aria-label]="label() + ' contents'"
      >
        @if (loading()) {
          <p class="p-4 text-sm text-black/70">Reading file…</p>
        } @else {
          <div class="flex min-w-fit font-mono leading-relaxed" [style.font-size.px]="fontSize()">
            @if (lineNumbers(); as numbers) {
              <pre
                class="m-0 select-none border-e border-black/10 bg-black/[.03] px-3 py-3 text-end text-black/55"
                aria-hidden="true"
                >{{ numbers }}</pre>
            }
            <pre
              class="m-0 min-w-0 flex-1 px-4 py-3 text-black"
              [class.whitespace-pre-wrap]="wrap()"
              [class.break-words]="wrap()"
              [class.whitespace-pre]="!wrap()"
              >{{ display() }}</pre>
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'block size-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextRendererComponent {
  readonly file = input.required<ResolvedFile>();
  readonly label = input('');
  readonly failed = output<string>();

  private readonly controller = inject(ViewerController);
  private readonly config = inject(FILE_VIEWER_CONFIG);
  private readonly document = inject(DOCUMENT);

  protected readonly toggle = TOGGLE;
  protected readonly limit = formatBytes(this.config.maxTextBytes);
  protected readonly loading = signal(true);
  private readonly text = signal('');
  protected readonly truncated = signal(false);
  protected readonly wrap = signal(true);
  protected readonly pretty = signal(true);

  protected readonly size = computed(() => formatBytes(this.file().size));
  protected readonly isJson = computed(() => {
    const { extension, mime } = this.file();
    return extension === 'json' || extension === 'geojson' || /json/.test(mime);
  });

  private readonly formatted = computed(() => {
    if (!this.isJson() || this.truncated()) return undefined;
    try {
      return JSON.stringify(JSON.parse(this.text()), null, 2);
    } catch {
      return undefined; // not valid JSON — show it as is
    }
  });

  protected readonly display = computed(() =>
    this.pretty() ? (this.formatted() ?? this.text()) : this.text(),
  );

  protected readonly lineNumbers = computed(() => {
    if (this.wrap()) return '';
    const count = this.display().split('\n').length;
    if (count > MAX_NUMBERED_LINES) return '';
    return Array.from({ length: count }, (_, i) => i + 1).join('\n');
  });

  protected readonly fontSize = computed(() => {
    const zoom = this.controller.zoom();
    return BASE_FONT_PX * (typeof zoom === 'number' ? zoom : 1);
  });

  constructor() {
    const unregister = this.controller.register({
      capabilities: { zoom: true, print: true },
      print: () => this.print(),
    });
    inject(DestroyRef).onDestroy(unregister);

    effect(() => this.controller.scale.set(this.fontSize() / BASE_FONT_PX));

    effect((onCleanup) => {
      const blob = this.file().blob;
      let stale = false;
      onCleanup(() => (stale = true));
      this.loading.set(true);
      if (!blob) {
        this.failed.emit('There is no text to show.');
        return;
      }
      readText(blob, this.config.maxTextBytes)
        .then(({ text, truncated }) => {
          if (stale) return;
          this.text.set(text);
          this.truncated.set(truncated);
          this.loading.set(false);
        })
        .catch(() => !stale && this.failed.emit('This file could not be read as text.'));
    });
  }

  private print(): Promise<boolean> {
    return printHtml(
      this.document,
      this.file().name,
      `<pre style="white-space:pre-wrap;word-break:break-word;font:11px/1.5 ui-monospace,monospace">${escapeHtml(this.display())}</pre>`,
    );
  }
}
