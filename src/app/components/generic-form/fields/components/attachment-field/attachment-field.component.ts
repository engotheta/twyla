import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AbstractControl, FormArray } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FileViewerService } from '../../../../file-viewer/file-viewer.service';
import { ViewerAttachment } from '../../../../file-viewer/file-viewer.interface';
import { FormInstance } from '../../../form-engine.service';
import { AttachmentField, AttachmentMeta } from '../../control.fields';
import { controlStatus } from '../control-status.util';
import { firstErrorMessage } from '../field-errors.util';

@Component({
  selector: 'app-attachment-field',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = state();

    <div class="flex w-full flex-col gap-2">
      @if (f.showLabel !== false && f.label) {
        <span class="text-sm font-medium">{{ f.label }}</span>
      }

      <div
        class="flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-black/20 p-4 text-center"
        [class.opacity-50]="status().disabled"
        (dragover)="$event.preventDefault()"
        (drop)="onDrop($event)"
      >
        <mat-icon aria-hidden="true">cloud_upload</mat-icon>

        <button
          type="button"
          mat-stroked-button
          [disabled]="status().disabled"
          (click)="fileInput.click()"
        >
          Choose file{{ f.isList ? 's' : '' }}
        </button>

        <span class="text-xs text-black/60">
          or drag &amp; drop{{ f.accept?.length ? ' — ' + f.accept!.join(', ') : '' }}
        </span>

        <input
          #fileInput
          type="file"
          class="hidden"
          [attr.accept]="f.accept?.join(',') ?? null"
          [multiple]="f.isList === true"
          [disabled]="status().disabled"
          (change)="onFilesPicked($event)"
        />
      </div>

      @if (rejectedMessage(); as msg) {
        <span class="text-xs text-red-600">{{ msg }}</span>
      }

      @if (f.isList) {
        @for (item of attachmentList(); track $index) {
          <div class="flex items-center gap-2 rounded border border-black/10 p-2">
            <mat-icon aria-hidden="true">description</mat-icon>

            <div class="min-w-0 flex-1">
              <div class="truncate text-sm">{{ $any(item?.name) ?? 'File ' + ($index + 1) }}</div>

              @if (item?.size) {
                <div class="text-xs text-black/60">{{ formatSize(item!.size) }}</div>
              }

              @if (item?.status === 'uploading') {
                <mat-progress-bar mode="indeterminate" />
              }

              @if (item?.status === 'error') {
                <div class="text-xs text-red-600">{{ item?.error }}</div>
              }
            </div>

            <button
              type="button"
              mat-icon-button
              [attr.aria-label]="'Preview ' + ($any(item?.name) ?? 'file ' + ($index + 1))"
              (click)="preview($index)"
            >
              <mat-icon aria-hidden="true">visibility</mat-icon>
            </button>
            <button type="button" mat-icon-button aria-label="Remove file" (click)="clear($index)">
              <mat-icon aria-hidden="true">close</mat-icon>
            </button>
          </div>
        }
      } @else if (singleAttachment(); as item) {
        <div class="flex items-center gap-2 rounded border border-black/10 p-2">
          <mat-icon aria-hidden="true">description</mat-icon>

          <div class="min-w-0 flex-1">
            <div class="truncate text-sm">{{ item.name }}</div>
            <div class="text-xs text-black/60">{{ formatSize(item.size) }}</div>

            @if (item.status === 'uploading') {
              <mat-progress-bar mode="indeterminate" />
            }
            @if (item.status === 'error') {
              <div class="text-xs text-red-600">{{ item.error }}</div>
            }
          </div>

          <button
            type="button"
            mat-icon-button
            [attr.aria-label]="'Preview ' + item.name"
            (click)="preview()"
          >
            <mat-icon aria-hidden="true">visibility</mat-icon>
          </button>
          <button type="button" mat-icon-button aria-label="Remove file" (click)="clear()">
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        </div>
      }

      @if (f.hint && !errorMessage()) {
        <span class="text-xs text-black/60">{{ f.hint }}</span>
      }
      @if (errorMessage(); as message) {
        <span class="text-xs text-red-600">{{ message }}</span>
      }
    </div>
  `,
})
export class AttachmentFieldComponent {
  readonly field = input.required<AttachmentField>();
  readonly instance = input.required<FormInstance>();

  private readonly fileViewer = inject(FileViewerService);

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
  protected readonly control = computed(
    () => this.instance().control(this.field()) as AbstractControl,
  );
  protected readonly status = controlStatus(this.control);

  protected readonly rejectedMessage = signal<string | null>(null);

  protected readonly singleAttachment = computed(() => {
    const a = this.state().attachment;
    return a && !Array.isArray(a) ? a : null;
  });

  protected readonly attachmentList = computed(() => {
    const a = this.state().attachment;
    return Array.isArray(a) ? a : [];
  });

  protected readonly errorMessage = computed(() =>
    this.status().touched
      ? firstErrorMessage(this.status().errors, this.state().validations)
      : null,
  );

  protected onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFiles(input.files);
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.status().disabled) return;
    this.handleFiles(event.dataTransfer?.files ?? null);
  }

  private handleFiles(files: FileList | null): void {
    if (!files?.length) return;
    const f = this.state();
    this.rejectedMessage.set(null);
    const picked = f.isList ? Array.from(files) : Array.from(files).slice(0, 1);

    for (const file of picked) {
      if (f.maxSizeMb && file.size > f.maxSizeMb * 1024 * 1024) {
        this.rejectedMessage.set(`"${file.name}" exceeds the ${f.maxSizeMb}MB limit`);
        continue;
      }

      if (f.isList) {
        this.instance().addListItem(this.field().path!);
        const arr = this.instance().control(this.field()) as FormArray;
        void this.instance().selectAttachment(this.field(), file, arr.length - 1);
      }
      //
      else {
        void this.instance().selectAttachment(this.field(), file);
      }
    }
  }

  /** Opens the picked file(s) in the viewer — a list opens at `index`, with previous / next. */
  protected preview(index?: number): void {
    const f = this.state();
    const control = this.control();
    if (f.isList) {
      const values =
        control instanceof FormArray ? control.controls.map((c) => c.value as unknown) : [];
      const files = this.attachmentList().map((meta, i) => toViewerAttachment(meta, values[i]));
      this.fileViewer.viewAttachments(files, index ?? 0, f.label);
      return;
    }
    const meta = this.singleAttachment();
    this.fileViewer.viewAttachment(toViewerAttachment(meta, control.value), meta?.name);
  }

  protected clear(index?: number): void {
    if (index === undefined) this.instance().clearAttachment(this.field());
    else this.instance().removeListItem(this.field().path!, index);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/** The picked `File` when the control still holds it, else its stored value (base64 or URL). */
function toViewerAttachment(
  meta: AttachmentMeta | null | undefined,
  value: unknown,
): ViewerAttachment {
  const base: ViewerAttachment = { fileName: meta?.name, mimeType: meta?.type };
  if (meta?.file) return { ...base, file: meta.file };
  if (typeof value === 'string' && value) return { ...base, src: value };
  return base;
}
