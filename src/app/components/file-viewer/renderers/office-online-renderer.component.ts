import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ResolvedFile } from '../file-viewer.interface';
import { FileLoaderService } from '../loader/file-loader.service';
import { ViewerController } from '../viewer-controller';

/**
 * Microsoft's Office Online viewer in an iframe — only when the app opted in and the file has a
 * public URL (Microsoft's servers fetch it). Says so above the frame: the file leaves the app.
 */
@Component({
  selector: 'file-viewer-office-online',
  imports: [MatIconModule],
  template: `
    <p
      class="m-0 flex items-center gap-2 border-b border-black/10 bg-amber-50 px-3 py-1.5 text-xs text-amber-950"
    >
      <mat-icon class="!size-4 !text-base" aria-hidden="true">public</mat-icon>
      Shown with Microsoft Office Online — Microsoft fetches the file from its public link.
    </p>
    @if (src(); as url) {
      <iframe
        class="min-h-0 w-full flex-1 border-0 bg-white"
        [src]="url"
        [title]="label() + ' — Microsoft Office Online preview'"
        referrerpolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
      ></iframe>
    }
  `,
  host: { class: 'flex size-full flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficeOnlineRendererComponent {
  readonly file = input.required<ResolvedFile>();
  readonly label = input('');

  private readonly loader = inject(FileLoaderService);
  private readonly sanitizer = inject(DomSanitizer);

  /** built only by `officeOnlineUrl` — an https viewer URL plus the encoded public file URL */
  protected readonly src = computed<SafeResourceUrl | undefined>(() => {
    const url = this.loader.officeOnlineUrl(this.file());
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : undefined;
  });

  constructor() {
    const unregister = inject(ViewerController).register({ capabilities: {} });
    inject(DestroyRef).onDestroy(unregister);
  }
}
