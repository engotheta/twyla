import { TestBed } from '@angular/core/testing';
import { FieldValueComponent } from '../details/field/field-value/field-value.component';
import { GenericFormComponent } from '../generic-form';
import { FieldType } from '../generic-form/interfaces/field-type.interface';
import { FormParameter } from '../generic-form/interfaces/form-parameter.interface';
import { FileViewerService } from './file-viewer.service';

/** The places that open the viewer instead of a raw link / nothing at all. */
describe('file viewer integration', () => {
  const viewer = { viewAttachment: vi.fn(), viewAttachments: vi.fn() };
  const settle = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  beforeEach(() => {
    viewer.viewAttachment.mockReset();
    viewer.viewAttachments.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: FileViewerService, useValue: viewer }],
    });
  });

  it('details: a base64 PDF field opens the viewer instead of a new tab', async () => {
    const base64 = btoa('%PDF-1.7 '.repeat(20));
    const fixture = TestBed.createComponent(FieldValueComponent);
    fixture.componentRef.setInput('field', { type: 'pdf', value: base64, label: 'Contract' });
    await settle(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a')).toBeNull();
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('View PDF'))!.click();
    expect(viewer.viewAttachment).toHaveBeenCalledWith(
      { data: base64, attachmentTitle: 'Contract' },
      'Contract',
    );
  });

  it('details: an attachment URL field opens the viewer with the URL as its source', async () => {
    const fixture = TestBed.createComponent(FieldValueComponent);
    fixture.componentRef.setInput('field', {
      type: 'attachment',
      value: 'https://x.test/a.pdf',
      label: 'Permit',
    });
    await settle(fixture);
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    expect(viewer.viewAttachment).toHaveBeenCalledWith(
      { src: 'https://x.test/a.pdf', attachmentTitle: 'Permit' },
      'Permit',
    );
  });

  it('form: a picked file gets a Preview button that opens it', async () => {
    const params: FormParameter<Record<string, unknown>> = {
      fields: [{ type: FieldType.attachment, key: 'permit', label: 'Permit' }],
    };
    const fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', params);
    await settle(fixture);

    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
    const file = new File(['%PDF-1.7'], 'permit.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle(fixture);

    el.querySelector<HTMLButtonElement>('button[aria-label="Preview permit.pdf"]')!.click();
    expect(viewer.viewAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ file, fileName: 'permit.pdf' }),
      'permit.pdf',
    );
  });
});
