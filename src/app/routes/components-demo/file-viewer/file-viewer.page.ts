import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@layout/page-header';
import { FileViewerDemoComponent } from './file-viewer-demo.component';

@Component({
  selector: 'file-viewer-page',
  imports: [PageHeaderComponent, FileViewerDemoComponent],
  template: `
    <page-header
      subtitle="Images, PDF, Word, Excel, CSV, text, audio and video — from any source"
    />
    <file-viewer-demo class="min-h-0 flex-1" />
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileViewerPage {}
