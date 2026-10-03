import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FileViewerComponent } from './file-viewer.component';
import { FileViewerParameter } from './file-viewer.interface';

/** What `FileViewerService.open()` hands the dialog. */
export interface FileViewerDialogData extends FileViewerParameter {
  /** the viewer's heading id — the dialog's `aria-labelledby` */
  titleId: string;
  /** the size to return to after full screen */
  size: { width?: string; height?: string };
}

const MAXIMIZED = 'file-viewer-dialog-maximized';

/**
 * The dialog `FileViewerService` opens: the viewer edge to edge, its toolbar doubling as the
 * dialog's title bar (heading = `aria-labelledby`, close button). Full screen takes the whole page
 * full screen and stretches the dialog over it — taking just the viewer full screen would strand
 * its menus and tooltips outside, in the overlay container it lives in.
 */
@Component({
  selector: 'file-viewer-dialog',
  imports: [FileViewerComponent],
  template: `
    <file-viewer
      #viewer
      class="h-full"
      [params]="data"
      [titleId]="data.titleId"
      [closable]="true"
      fullscreenTarget="document"
      (closed)="dialogRef.close()"
      (fullscreenChange)="onFullscreen($event)"
    />
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileViewerDialogComponent {
  protected readonly data = inject<FileViewerDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<FileViewerDialogComponent>>(MatDialogRef);
  private readonly viewer = viewChild.required(FileViewerComponent);
  private readonly viewerElement = viewChild.required('viewer', { read: ElementRef<HTMLElement> });

  constructor() {
    // the dialog opens with focus on its container — outside the viewer — so Ctrl+F, +/-, ←/→
    // pressed before clicking in reach the viewer through the dialog's own key stream
    this.dialogRef
      .keydownEvents()
      .pipe(takeUntilDestroyed())
      .subscribe((event) => {
        const inside = this.viewerElement().nativeElement.contains(event.target as Node);
        if (!inside) this.viewer().handleKeydown(event);
      });
  }

  protected onFullscreen(active: boolean): void {
    if (active) {
      this.dialogRef.addPanelClass(MAXIMIZED);
      this.dialogRef.updateSize('100vw', '100vh');
    } else {
      this.dialogRef.removePanelClass(MAXIMIZED);
      this.dialogRef.updateSize(this.data.size.width, this.data.size.height);
    }
  }
}
