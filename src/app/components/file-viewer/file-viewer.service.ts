import { DOCUMENT, inject, Injectable } from '@angular/core';
import { MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { NotificationService } from '../../services/notification';
import { ViewService } from '../../services/view';
import { FILE_VIEWER_CONFIG } from './file-viewer-config.token';
import { FileViewerDialogComponent, FileViewerDialogData } from './file-viewer-dialog.component';
import {
  FileViewerError,
  FileViewerParameter,
  ViewerAttachmentInput,
} from './file-viewer.interface';
import { saveBlob } from './loader/file-actions.helpers';
import { FileLoaderService } from './loader/file-loader.service';
import { isViewerAttachment } from './loader/file-source.helpers';

let nextId = 0;

/**
 * Opens files in the viewer dialog, keeping the apps' call names:
 *
 *  - `viewAttachment(field.attachment)` — one file (a `BaseAttachment`-shaped DTO, a URL, base64,
 *    a Blob, an Observable…)
 *  - `viewAttachments(rows, i)` — several, opened at `i`, with previous / next
 *  - `open({ attachment, title, actionButtons, toolbar… })` — the full `FileViewerParameter`
 *  - `download(attachment)` — resolve and save without opening anything (row actions)
 */
@Injectable({ providedIn: 'root' })
export class FileViewerService {
  private readonly view = inject(ViewService);
  private readonly loader = inject(FileLoaderService);
  private readonly config = inject(FILE_VIEWER_CONFIG);
  private readonly notify = inject(NotificationService);
  private readonly document = inject(DOCUMENT);

  open(
    input: FileViewerParameter | ViewerAttachmentInput | readonly ViewerAttachmentInput[],
    dialog: MatDialogConfig = {},
  ): MatDialogRef<FileViewerDialogComponent> {
    const params = toParameter(input);
    const titleId = `file-viewer-dialog-title-${nextId++}`;
    const size = {
      width: dialog.width ?? this.config.dialog.width,
      height: dialog.height ?? this.config.dialog.height,
    };
    const panelClass = ['file-viewer-dialog', ...[dialog.panelClass ?? []].flat()];

    return this.view.openDialog<FileViewerDialogData>({
      component: FileViewerDialogComponent,
      autoFocus: 'dialog',
      restoreFocus: true,
      maxWidth: this.config.dialog.maxWidth,
      maxHeight: '100vh',
      ...dialog,
      width: size.width,
      height: size.height,
      panelClass,
      ariaLabelledBy: titleId,
      data: { ...params, titleId, size },
    }) as MatDialogRef<FileViewerDialogComponent>;
  }

  /** The apps' `viewAttachment(...)`: one file in the viewer dialog. */
  viewAttachment(
    attachment: ViewerAttachmentInput,
    title?: string,
  ): MatDialogRef<FileViewerDialogComponent> {
    return this.open({ attachment, title });
  }

  /** Several files, opened at `index`, with previous / next. */
  viewAttachments(
    attachments: readonly ViewerAttachmentInput[],
    index = 0,
    title?: string,
  ): MatDialogRef<FileViewerDialogComponent> {
    return this.open({ attachments, index, title });
  }

  /** Fetches / decodes the file and saves it — no viewer. A toast says so when it fails. */
  async download(attachment: ViewerAttachmentInput): Promise<boolean> {
    try {
      const file = await this.loader.resolve(attachment, {
        convert: false,
        external: false,
        direct: false,
      });
      if (!file.blob) throw new FileViewerError('There is no file to download.');
      saveBlob(this.document, file.blob, file.name);
      return true;
    } catch (err) {
      this.notify.error(
        err instanceof FileViewerError ? err.message : "The file couldn't be downloaded.",
      );
      return false;
    }
  }
}

function toParameter(
  input: FileViewerParameter | ViewerAttachmentInput | readonly ViewerAttachmentInput[],
): FileViewerParameter {
  if (Array.isArray(input)) return { attachments: input };
  if (isParameter(input)) return input;
  return { attachment: input as ViewerAttachmentInput };
}

/** `{ attachment }` / `{ attachments }` — but never an attachment itself */
function isParameter(input: unknown): input is FileViewerParameter {
  return (
    typeof input === 'object' &&
    input !== null &&
    ('attachment' in input || 'attachments' in input) &&
    !isViewerAttachment(input)
  );
}
