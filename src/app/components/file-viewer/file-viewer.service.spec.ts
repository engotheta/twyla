import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FileViewerService } from './file-viewer.service';

describe('FileViewerService', () => {
  let service: FileViewerService;
  const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
    }
  };

  beforeEach(async () => {
    URL.createObjectURL = vi.fn(() => 'blob:test/1');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    await TestBed.compileComponents();
    service = TestBed.inject(FileViewerService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('viewAttachment opens the viewer in a dialog labelled by its heading, with a close button', async () => {
    const ref = service.viewAttachment({ blob: new Blob(['memo']), fileName: 'memo.txt' });
    await settle();
    const container = overlay().querySelector('mat-dialog-container')!;
    const titleId = container.getAttribute('aria-labelledby')!;
    expect(document.getElementById(titleId)?.textContent?.trim()).toBe('memo.txt');
    expect(container.closest('.cdk-overlay-pane')?.classList).toContain('file-viewer-dialog');

    overlay().querySelector<HTMLButtonElement>('button[aria-label="Close viewer"]')!.click();
    await firstValueFrom(ref.afterClosed());
    expect(overlay().querySelector('mat-dialog-container')).toBeNull();
  });

  it('viewAttachments opens a gallery at the given file; open() takes a FileViewerParameter', async () => {
    const files = [
      { blob: new Blob(['a']), fileName: 'a.txt' },
      { blob: new Blob(['b']), fileName: 'b.txt' },
    ];
    const gallery = service.viewAttachments(files, 1);
    await settle();
    expect(overlay().querySelector('file-viewer-toolbar h2')?.textContent?.trim()).toBe('b.txt');
    gallery.close();
    await firstValueFrom(gallery.afterClosed());

    const titled = service.open({
      attachment: files[0],
      title: 'Signed copy',
      toolbar: { download: false },
    });
    await settle();
    expect(overlay().querySelector('file-viewer-toolbar h2')?.textContent?.trim()).toBe(
      'Signed copy',
    );
    expect(overlay().querySelector('button[aria-label="Download"]')).toBeNull();
    titled.close();
    await firstValueFrom(titled.afterClosed());
  });

  it('downloads without opening anything', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const ok = await service.download({
      data: btoa('%PDF-1.7 '.repeat(12)),
      attachmentTitle: 'Invoice 7',
    });
    expect(ok).toBe(true);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('Invoice 7.pdf');
    expect(overlay()?.querySelector('mat-dialog-container') ?? null).toBeNull();
  });
});
