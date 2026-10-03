import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ResolvedFile } from '../file-viewer.interface';
import { ViewerController } from '../viewer-controller';

/** Audio / video in the browser's own player — streamed straight from its URL when it has one. */
@Component({
  selector: 'file-viewer-media',
  imports: [MatIconModule],
  template: `
    @let f = file();
    @if (url(); as src) {
      @if (f.kind === 'video') {
        <video
          class="max-h-full max-w-full rounded bg-black"
          controls
          playsinline
          preload="metadata"
          [src]="src"
          [attr.aria-label]="label()"
          (error)="failed.emit(unplayable)"
        >
          @for (track of f.source.tracks ?? []; track track.src) {
            <track
              [src]="track.src"
              [attr.kind]="track.kind ?? 'captions'"
              [attr.srclang]="track.srclang"
              [attr.label]="track.label"
              [default]="track.default ?? false"
            />
          }
        </video>
      } @else {
        <div class="flex w-full max-w-xl flex-col items-center gap-4 p-6">
          <span
            class="grid size-24 place-items-center rounded-full bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <mat-icon class="!size-12 !text-5xl">graphic_eq</mat-icon>
          </span>
          <audio
            class="w-full"
            controls
            preload="metadata"
            [src]="src"
            [attr.aria-label]="label()"
            (error)="failed.emit(unplayable)"
          ></audio>
        </div>
      }
    }
  `,
  host: { class: 'flex size-full items-center justify-center p-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaRendererComponent {
  readonly file = input.required<ResolvedFile>();
  readonly url = input<string>();
  readonly label = input('');
  readonly failed = output<string>();

  protected readonly unplayable =
    "Your browser can't play this file — download it to play it elsewhere.";

  constructor() {
    const unregister = inject(ViewerController).register({ capabilities: {} });
    inject(DestroyRef).onDestroy(unregister);
  }
}
