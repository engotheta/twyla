import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { FieldData } from '../field.interface';
import { getLabelField } from '../field-labels.helpers';
import { getBase64Object } from '../../util/base-64/base-64.helpers';
import { FileViewerService } from '../../../file-viewer/file-viewer.service';

const ATTACHMENT_ICONS: Record<string, string> = {
  pdf: 'picture_as_pdf',
  word: 'description',
  excel: 'grid_on',
};

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

const VIEW_BUTTON =
  'inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-start text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const THUMB_BUTTON =
  'block cursor-zoom-in rounded border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface MediaInfo {
  uri: string;
  extension?: string;
  isImage: boolean;
  isPdf: boolean;
}

@Component({
  selector: 'field-value',
  templateUrl: './field-value.component.html',
  styleUrl: './field-value.component.scss',
  imports: [DatePipe, JsonPipe, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldValueComponent {
  readonly field = input.required<FieldData>();
  readonly undefinedValue = input('—');

  private readonly fileViewer = inject(FileViewerService);
  protected readonly viewButton = VIEW_BUTTON;
  protected readonly thumbButton = THUMB_BUTTON;

  protected readonly date = computed(() => {
    if (this.field().type !== 'date') return null;

    const value = this.field().value;
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

  protected readonly commentText = computed(() => {
    const value = this.field().value;
    return getLabelField(value)?.value ?? value;
  });

  protected readonly attachmentIcon = computed(
    () => ATTACHMENT_ICONS[this.field().labelIcon as string] ?? 'attach_file',
  );

  /** 0–100 — a number, or a numeric string with a trailing `%` (e.g. `"45%"`, via `parseFloat`) */
  protected readonly percentage = computed(() => {
    const raw = this.field().value;
    const value = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
  });

  protected readonly media = computed<MediaInfo | null>(() => {
    const { type, value } = this.field();
    if (!['image', 'pdf', 'base64'].includes(type ?? '') || typeof value !== 'string') return null;

    const { extension, uri } = getBase64Object(value);

    return {
      uri,
      extension,
      isImage: IMAGE_EXTENSIONS.includes(extension ?? ''),
      isPdf: extension === 'pdf',
    };
  });

  protected readonly isArray = Array.isArray;

  /** Opens the field's file in the viewer: a URL / path (`attachment`) or base64 (`pdf`, `image`, `base64`). */
  protected view(): void {
    const { type, value, label } = this.field();
    if (typeof value !== 'string' || !value) return;
    const title = label ?? undefined;
    this.fileViewer.viewAttachment(
      type === 'attachment'
        ? { src: value, attachmentTitle: title }
        : { data: value, attachmentTitle: title },
      title,
    );
  }

  protected displayItem(item: unknown): string {
    return typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item);
  }
}
