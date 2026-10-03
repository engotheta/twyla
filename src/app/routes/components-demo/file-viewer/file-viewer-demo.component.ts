import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActionButton } from '@components/action-buttons';
import {
  FileViewerComponent,
  FileViewerService,
  ResolvedFile,
  ViewerAttachmentInput,
} from '@components/file-viewer';
import {
  makeChartBase64,
  makeChartImage,
  makeCsv,
  makeDocx,
  makeJson,
  makePdf,
  makeSvgDataUrl,
  makeWav,
  makeWorkbook,
  makeZip,
  MISSING_URL,
  PUBLIC_DOC_URL,
  PUBLIC_IMAGE_URL,
  PUBLIC_PDF_URL,
  PUBLIC_PPTX_URL,
  PUBLIC_VIDEO_URL,
  throttledStream,
} from './sample-files';

interface Sample {
  label: string;
  /** which kind of source it demonstrates */
  source: string;
  attachment: ViewerAttachmentInput;
}

interface SampleGroup {
  name: string;
  samples: (Sample & { index: number })[];
}

const SAMPLE_BUTTON =
  'flex w-full cursor-pointer flex-col items-start rounded-md border-0 bg-transparent px-2 py-1.5 text-start hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-primary aria-[current=true]:bg-primary/10';

/**
 * Every source type and file kind the viewer handles, inline (left list → right viewer) and in the
 * dialog. Office Online and `filePath` resolution are configured in `app.config.ts`.
 */
@Component({
  selector: 'file-viewer-demo',
  imports: [FileViewerComponent, MatButtonModule, MatIconModule],
  template: `
    <section
      class="flex h-full min-h-0 flex-col gap-3 lg:flex-row"
      aria-labelledby="file-viewer-demo-title"
    >
      <div
        class="flex max-h-72 w-full shrink-0 flex-col gap-3 overflow-auto rounded-lg bg-white p-3 lg:max-h-none lg:w-80"
      >
        <h2 id="file-viewer-demo-title" class="m-0 text-base font-medium">File viewer</h2>
        <div class="flex flex-wrap gap-2">
          <button type="button" matButton="filled" (click)="openDialog()">Open in dialog</button>
          <button type="button" matButton="outlined" (click)="openGallery()">All in dialog</button>
          <button type="button" matButton="outlined" (click)="picker.click()">Local files…</button>
          <button type="button" matButton="outlined" (click)="download()">Download</button>
          <input
            #picker
            type="file"
            multiple
            class="hidden"
            tabindex="-1"
            aria-hidden="true"
            (change)="openLocal(picker)"
          />
        </div>
        <p class="m-0 text-xs text-black/70" role="status">{{ lastEvent() }}</p>

        @for (group of groups; track group.name) {
          <h3 class="m-0 mt-1 text-xs font-semibold uppercase tracking-wide text-black/70">
            {{ group.name }}
          </h3>
          <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
            @for (sample of group.samples; track sample.index) {
              <li>
                <button
                  type="button"
                  [class]="sampleButton"
                  [attr.aria-current]="sample.index === index() ? 'true' : null"
                  (click)="index.set(sample.index)"
                >
                  <span class="text-sm font-medium">{{ sample.label }}</span>
                  <span class="text-xs text-black/70">{{ sample.source }}</span>
                </button>
              </li>
            }
          </ul>
        }
      </div>

      <file-viewer
        class="min-h-[480px] flex-1 rounded-lg shadow"
        [attachments]="attachments"
        [(index)]="index"
        [actionButtons]="actions"
        (loaded)="lastEvent.set('Loaded ' + $event.name + ' (' + $event.kind + ')')"
        (failed)="lastEvent.set('Failed: ' + $event)"
      />
    </section>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileViewerDemoComponent {
  private readonly http = inject(HttpClient);
  private readonly fileViewer = inject(FileViewerService);

  protected readonly sampleButton = SAMPLE_BUTTON;
  protected readonly index = model(0);
  protected readonly lastEvent = signal('');

  private readonly base64Png = makeChartBase64();

  private readonly samples: Record<string, Sample[]> = {
    PDF: [
      {
        label: 'Research paper',
        source: 'Public URL via HttpClient',
        attachment: { url: PUBLIC_PDF_URL },
      },
      {
        label: 'Quarterly report',
        source: 'Lazy loader → generated Blob',
        attachment: { src: () => makePdf(), fileName: 'quarterly-report.pdf' },
      },
      {
        label: 'Confidential (password: studio)',
        source: 'Encrypted PDF',
        attachment: { src: () => makePdf('studio'), fileName: 'confidential.pdf' },
      },
      {
        label: 'Streamed report',
        source: 'Throttled ReadableStream',
        attachment: {
          src: () => makePdf().then((blob) => ({ src: throttledStream(blob), size: blob.size })),
          fileName: 'streamed-report.pdf',
        },
      },
      {
        label: 'Stored report',
        source: 'App filePath → resolvePath',
        attachment: { filePath: 'storage/reports/tracemonkey.pdf', fileName: 'tracemonkey.pdf' },
      },
      { label: 'Missing file', source: 'URL answering 404', attachment: { url: MISSING_URL } },
    ],
    Images: [
      {
        label: 'Chart',
        source: 'Raw base64',
        attachment: { data: this.base64Png, fileName: 'chart.png' },
      },
      {
        label: 'Large chart',
        source: 'Canvas Blob, 2000 × 1250',
        attachment: { src: () => makeChartImage(), fileName: 'throughput.png' },
      },
      {
        label: 'Circles',
        source: 'SVG data URL',
        attachment: { dataUrl: makeSvgDataUrl(), fileName: 'circles.svg' },
      },
      {
        label: 'Mountain photo',
        source: 'Observable<HttpEvent<Blob>>',
        attachment: {
          src: this.http.get(PUBLIC_IMAGE_URL, {
            responseType: 'blob',
            observe: 'events',
            reportProgress: true,
          }),
          fileName: 'mountain.jpg',
        },
      },
      {
        label: 'API attachment DTO',
        source: 'Promise of { data, mediaType, attachmentTitle }',
        attachment: () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: this.base64Png,
                  mediaType: 'png',
                  attachmentTitle: 'Delayed chart',
                }),
              800,
            ),
          ),
      },
    ],
    Office: [
      {
        label: 'Project charter',
        source: 'Word .docx',
        attachment: { src: () => makeDocx(), fileName: 'project-charter.docx' },
      },
      {
        label: 'Regional sales',
        source: 'Excel .xlsx, 2 sheets',
        attachment: { src: () => makeWorkbook(), fileName: 'regional-sales.xlsx' },
      },
      {
        label: 'Districts',
        source: 'CSV, “;” delimited',
        attachment: { blob: makeCsv(), fileName: 'districts.csv' },
      },
      {
        label: 'Slides',
        source: 'PowerPoint → Office Online',
        attachment: { url: PUBLIC_PPTX_URL, fileName: 'slides.pptx' },
      },
      {
        label: 'Legacy memo',
        source: 'Word 97 .doc → Office Online',
        attachment: { url: PUBLIC_DOC_URL },
      },
    ],
    'Text & media': [
      {
        label: 'Settings',
        source: 'JSON Blob',
        attachment: { blob: makeJson(), fileName: 'settings.json' },
      },
      { label: 'Tone', source: 'WAV Blob', attachment: { blob: makeWav(), fileName: 'tone.wav' } },
      {
        label: 'Flower',
        source: 'Video streamed from its URL',
        attachment: { url: PUBLIC_VIDEO_URL, fileName: 'flower.mp4' },
      },
      {
        label: 'Archive',
        source: 'ZIP — no preview',
        attachment: { src: () => makeZip(), fileName: 'archive.zip' },
      },
    ],
  };

  protected readonly groups: SampleGroup[] = (() => {
    let index = 0;
    return Object.entries(this.samples).map(([name, samples]) => ({
      name,
      samples: samples.map((sample) => ({ ...sample, index: index++ })),
    }));
  })();

  protected readonly attachments: ViewerAttachmentInput[] = this.groups.flatMap((g) =>
    g.samples.map((s) => s.attachment),
  );

  protected readonly actions: ActionButton<ResolvedFile>[] = [
    {
      type: 'icon',
      icon: 'content_copy',
      tooltip: 'Copy file name',
      label: 'Copy file name',
      click: (file) => {
        void navigator.clipboard?.writeText(file?.name ?? '');
        this.lastEvent.set(`Copied “${file?.name}”`);
      },
    },
  ];

  protected openDialog(): void {
    this.fileViewer.open({ attachments: this.attachments, index: this.index() });
  }

  protected openGallery(): void {
    this.fileViewer.viewAttachments(this.attachments, 0, undefined);
  }

  protected openLocal(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) this.fileViewer.viewAttachments(files);
  }

  protected async download(): Promise<void> {
    const ok = await this.fileViewer.download(this.attachments[this.index()]);
    this.lastEvent.set(ok ? 'Download started' : 'Download failed');
  }
}
