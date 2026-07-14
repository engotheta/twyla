import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { FieldData } from '../field.interface';
import { getLabelField } from '../field-labels.helpers';
import { getBase64Object } from '../../util/base-64/base-64.helpers';

const ATTACHMENT_ICONS: Record<string, string> = {
  pdf: 'picture_as_pdf',
  word: 'description',
  excel: 'grid_on',
};

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

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

  protected readonly percentage = computed(() => {
    const value = Number(this.field().value);
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

  protected displayItem(item: unknown): string {
    return typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item);
  }
}
