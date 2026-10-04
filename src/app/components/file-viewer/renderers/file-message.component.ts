import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { injectMessages } from '@services/i18n/message-bundle';
import { FILE_VIEWER_MESSAGES } from '../file-viewer.messages';

/**
 * The card shown instead of a preview: "preview not available", a load error, an empty viewer.
 * Offers what can still be done with the file — retry, download, open it in a new tab, or show it
 * through Office Online when the app allows that.
 */
@Component({
  selector: 'file-viewer-message',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="flex max-w-md flex-col items-center gap-3 p-6 text-center">
      <span
        class="grid size-16 place-items-center rounded-full"
        [class]="tone() === 'error' ? 'bg-red-50 text-red-700' : 'bg-black/5 text-black/70'"
        aria-hidden="true"
      >
        <mat-icon class="!size-8 !text-[2rem]">{{ icon() }}</mat-icon>
      </span>
      <h3 class="m-0 text-base font-medium">{{ heading() }}</h3>
      @if (message()) {
        <p class="m-0 text-sm text-black/70" [attr.role]="tone() === 'error' ? 'alert' : null">
          {{ message() }}
        </p>
      }
      @if (details()) {
        <p class="m-0 break-all text-xs text-black/60">{{ details() }}</p>
      }
      <div class="mt-1 flex flex-wrap justify-center gap-2">
        @if (canRetry()) {
          <button type="button" matButton="outlined" (click)="retry.emit()">
            <mat-icon aria-hidden="true">refresh</mat-icon> {{ t().actions.tryAgain }}
          </button>
        }
        @if (canOffice()) {
          <button type="button" matButton="outlined" (click)="office.emit()">
            <mat-icon aria-hidden="true">public</mat-icon> {{ t().actions.officeOnline }}
          </button>
        }
        @if (canOpen()) {
          <button type="button" matButton="outlined" (click)="open.emit()">
            <mat-icon aria-hidden="true">open_in_new</mat-icon> {{ t().actions.openInNewTab }}
          </button>
        }
        @if (canDownload()) {
          <button type="button" matButton="filled" (click)="download.emit()">
            <mat-icon aria-hidden="true">download</mat-icon> {{ t().actions.download }}
          </button>
        }
      </div>
    </div>
  `,
  host: { class: 'flex size-full items-center justify-center overflow-auto' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileMessageComponent {
  protected readonly t = injectMessages(FILE_VIEWER_MESSAGES);

  readonly icon = input('description');
  readonly heading = input.required<string>();
  readonly message = input<string>();
  /** name · type · size */
  readonly details = input<string>();
  readonly tone = input<'info' | 'error'>('info');
  readonly canRetry = input(false);
  readonly canDownload = input(false);
  readonly canOpen = input(false);
  readonly canOffice = input(false);

  readonly retry = output<void>();
  readonly download = output<void>();
  readonly open = output<void>();
  readonly office = output<void>();
}
