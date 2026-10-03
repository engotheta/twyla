import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileViewerComponent } from './file-viewer.component';
import { ResolvedFile, ViewerAttachmentInput } from './file-viewer.interface';

const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0x61]);

describe('FileViewerComponent', () => {
  let fixture: ComponentFixture<FileViewerComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  const loaded: ResolvedFile[] = [];
  const failed: string[] = [];

  /** loads resolve through promises (Blob.arrayBuffer) and lazy chunks — let them all land */
  async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  async function mount(inputs: Record<string, unknown>): Promise<void> {
    fixture = TestBed.createComponent(FileViewerComponent);
    el = fixture.nativeElement;
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.componentInstance.loaded.subscribe((f) => loaded.push(f));
    fixture.componentInstance.failed.subscribe((m) => failed.push(m));
    await settle();
  }

  const heading = () => el.querySelector('file-viewer-toolbar h2')?.textContent?.trim();
  const button = (label: string) =>
    el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const buttonByText = (text: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes(text),
    );

  beforeEach(async () => {
    loaded.length = 0;
    failed.length = 0;
    // jsdom has no object URLs
    URL.createObjectURL = vi.fn(() => 'blob:test/1');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      imports: [FileViewerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    // the renderers sit in @defer blocks
    await TestBed.compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('shows a text file with its name, type and size, and emits `loaded`', async () => {
    await mount({ attachment: { blob: new Blob(['hello world']), fileName: 'note.txt' } });
    expect(heading()).toBe('note.txt');
    expect(el.querySelector('file-viewer-toolbar p')?.textContent).toContain('TXT · 11 B');
    expect(el.querySelector('file-viewer-text pre:last-of-type')?.textContent).toContain(
      'hello world',
    );
    expect(loaded.map((f) => f.kind)).toEqual(['text']);
    expect(el.querySelector('file-viewer-text [role=region]')?.getAttribute('tabindex')).toBe('0');
  });

  it('offers Download for a file it cannot preview, saving it under its name', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await mount({ attachment: { blob: new Blob([ZIP]), fileName: 'archive.zip' } });
    expect(el.textContent).toContain('Preview not available');
    buttonByText('Download')!.click();
    await settle();
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('archive.zip');
  });

  it('describes a failed load and retries it', async () => {
    await mount({ attachment: { url: 'https://x.test/notes.txt' } });
    http
      .expectOne('https://x.test/notes.txt')
      .flush(new Blob(), { status: 404, statusText: 'Not Found' });
    await settle();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('The file was not found.');
    expect(failed).toEqual(['The file was not found.']);

    buttonByText('Try again')!.click();
    await settle();
    http.expectOne('https://x.test/notes.txt').flush(new Blob(['second time lucky']));
    await settle();
    expect(el.querySelector('file-viewer-text')?.textContent).toContain('second time lucky');
  });

  it('steps through several files with the toolbar and the arrow keys, two-way bound to `index`', async () => {
    const files: ViewerAttachmentInput[] = [
      { blob: new Blob(['one']), fileName: 'one.txt' },
      { blob: new Blob(['two']), fileName: 'two.txt' },
    ];
    await mount({ attachments: files });
    expect(button('File 1 of 2, choose a file')).toBeTruthy();

    button('Next file')!.click();
    await settle();
    expect(heading()).toBe('two.txt');
    expect(fixture.componentInstance.index()).toBe(1);

    button('Next file')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await settle();
    expect(heading()).toBe('one.txt'); // wraps around
  });

  it("hides what the consumer turned off and what the renderer can't do", async () => {
    await mount({
      attachment: { blob: new Blob(['x']), fileName: 'x.txt' },
      toolbar: { download: false },
    });
    expect(button('Download')).toBeNull();
    expect(button('Zoom in')).toBeTruthy(); // text zooms…
    expect(button('Rotate clockwise')).toBeNull(); // …but doesn't rotate
    expect(button('Close viewer')).toBeNull(); // only when closable
  });

  it('labels its heading for a dialog and shows an empty state with no file', async () => {
    await mount({ titleId: 'viewer-title' });
    expect(el.querySelector('h2')?.id).toBe('viewer-title');
    expect(el.textContent).toContain('No file to show');
  });
});
