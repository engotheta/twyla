import {
  extensionFromName,
  kindFromHints,
  normalizeExtension,
  normalizeMime,
  resolveKind,
  sniffKind,
} from './file-kind.helpers';

const bytes = (...values: (number | string)[]): Uint8Array =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

const PDF = bytes('%PDF-1.7\n');
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 'JFIF');
const ZIP = (entry: string) =>
  bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, '[Content_Types].xml', entry);
const OLE2 = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0);

describe('file-kind helpers', () => {
  it("normalizes extensions however they're written — the apps' 'pdf' vs '.pdf' split", () => {
    expect(normalizeExtension('.PDF')).toBe('pdf');
    expect(normalizeExtension(' pdf ')).toBe('pdf');
    expect(normalizeExtension('application/pdf')).toBe('pdf'); // a MIME type passed by mistake
    expect(normalizeExtension(undefined)).toBe('');
  });

  it('normalizes MIME types, bare subtypes included, and drops generic ones', () => {
    expect(normalizeMime('Application/PDF; charset=binary')).toBe('application/pdf');
    expect(normalizeMime('png')).toBe('image/png'); // GASCO's mediaType: 'png'
    expect(normalizeMime('application/octet-stream')).toBe('');
  });

  it('reads extensions from names and URLs, ignoring query and hash', () => {
    expect(extensionFromName('report.final.XLSX')).toBe('xlsx');
    expect(extensionFromName('https://x.test/files/a.pdf?token=1#p=2')).toBe('pdf');
    expect(extensionFromName('https://x.test/download?id=7')).toBe('');
    expect(extensionFromName('.env')).toBe('');
  });

  it('maps hints to kinds', () => {
    expect(kindFromHints({ extension: 'docx' })?.kind).toBe('docx');
    expect(kindFromHints({ extension: 'xls' })?.kind).toBe('office');
    expect(kindFromHints({ mime: 'text/csv' })).toEqual({
      kind: 'csv',
      extension: 'csv',
      mime: 'text/csv',
    });
    expect(kindFromHints({ mime: 'application/vnd.api+json' })?.kind).toBe('text');
    expect(kindFromHints({ mime: 'image/tiff' })?.kind).toBe('unsupported');
    expect(kindFromHints({})).toBeUndefined();
  });

  it('identifies files from their first bytes', () => {
    expect(sniffKind(PDF)?.extension).toBe('pdf');
    expect(sniffKind(PNG)?.extension).toBe('png');
    expect(sniffKind(JPG)?.extension).toBe('jpg');
    expect(sniffKind(ZIP('word/document.xml'))?.kind).toBe('docx');
    expect(sniffKind(ZIP('xl/workbook.xml'))?.kind).toBe('sheet');
    expect(sniffKind(ZIP('ppt/presentation.xml'))?.extension).toBe('pptx');
    expect(
      sniffKind(bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">'))
        ?.extension,
    ).toBe('svg');
    expect(sniffKind(bytes('name,age\nada,36\n'))?.kind).toBe('text');
    expect(sniffKind(bytes(0, 1, 2, 3, 0, 0, 7))).toBeUndefined();
  });

  it('lets a definite signature beat a wrong label', () => {
    expect(resolveKind({ extension: 'txt', mime: 'text/plain' }, PDF).kind).toBe('pdf');
    expect(resolveKind({ extension: 'pdf' }, PNG)).toEqual({
      kind: 'image',
      extension: 'png',
      mime: 'image/png',
    });
  });

  it('keeps the label when the bytes agree, or are only a container', () => {
    expect(resolveKind({ extension: 'jpeg', mime: 'image/jpeg' }, JPG).extension).toBe('jpeg');
    expect(resolveKind({ extension: 'xlsx' }, ZIP('docProps/app.xml')).kind).toBe('sheet');
    expect(resolveKind({ extension: 'xls' }, OLE2)).toEqual(
      expect.objectContaining({ kind: 'office', extension: 'xls' }),
    );
    expect(resolveKind({}, OLE2).kind).toBe('office');
  });

  it("refuses to show binary bytes labelled as text, and falls back to sniffing when there's no label", () => {
    expect(resolveKind({ extension: 'csv' }, bytes(0, 0, 0, 1, 2)).kind).toBe('unsupported');
    expect(resolveKind({}, bytes('hello'))).toEqual({
      kind: 'text',
      extension: 'txt',
      mime: 'text/plain',
    });
    expect(resolveKind({ extension: 'csv' }, bytes('a;b\n1;2')).kind).toBe('csv');
  });
});
