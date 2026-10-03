import { of } from 'rxjs';
import {
  attachmentMeta,
  classifyString,
  decodeBase64,
  filenameFromContentDisposition,
  formatBytes,
  isAllowedUrl,
  isViewerAttachment,
  parseDataUrl,
  pickSource,
  withExtension,
} from './file-source.helpers';

const LONG_BASE64 = btoa('%PDF-1.7 '.repeat(20));

describe('file-source helpers', () => {
  it('tells string sources apart', () => {
    expect(classifyString('data:image/png;base64,iVBOR')).toBe('dataUrl');
    expect(classifyString('blob:https://app.test/1234')).toBe('blobUrl');
    expect(classifyString('https://x.test/a.pdf')).toBe('url');
    expect(classifyString('files/123')).toBe('url'); // short, base64-looking path
    expect(classifyString('uploads/report.pdf')).toBe('url');
    expect(classifyString(LONG_BASE64)).toBe('base64');
    expect(classifyString(`${LONG_BASE64.slice(0, 40)}\n${LONG_BASE64.slice(40)}`)).toBe('base64');
  });

  it('only lets http(s), blob: and relative URLs through', () => {
    expect(isAllowedUrl('https://x.test/a.pdf')).toBe(true);
    expect(isAllowedUrl('/api/files/1')).toBe(true);
    expect(isAllowedUrl('blob:https://app.test/1')).toBe(true);
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedUrl(' JavaScript:alert(1)')).toBe(false);
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
  });

  it('decodes base64 with whitespace, url-safe characters and missing padding', () => {
    const text = (b: Uint8Array) => String.fromCharCode(...b);
    expect(text(decodeBase64('aGVs\nbG8='))).toBe('hello');
    expect(text(decodeBase64('aGVsbG8'))).toBe('hello');
    expect([...decodeBase64('-_8')]).toEqual([0xfb, 0xff]);
  });

  it('parses data URLs, base64 or percent-encoded', () => {
    const png = parseDataUrl('data:image/png;name=a.png;base64,aGk=');
    expect(png.mime).toBe('image/png');
    expect(String.fromCharCode(...png.bytes)).toBe('hi');
    const svg = parseDataUrl('data:image/svg+xml,%3Csvg%3E');
    expect(new TextDecoder().decode(svg.bytes)).toBe('<svg>');
  });

  it('reads Content-Disposition file names, RFC 5987 first', () => {
    expect(
      filenameFromContentDisposition(
        `attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf; filename="resume.pdf"`,
      ),
    ).toBe('résumé.pdf');
    expect(filenameFromContentDisposition('attachment; filename="a \\"b\\".txt"')).toBe(
      'a "b".txt',
    );
    expect(filenameFromContentDisposition('inline; filename=plain.csv')).toBe('plain.csv');
    expect(filenameFromContentDisposition('inline')).toBeUndefined();
  });

  it("takes the apps' BaseAttachment / AttachmentDtoInput shape as is", () => {
    const dto = {
      attachmentTitle: 'Contract',
      dataBinary: LONG_BASE64,
      mediaType: 'pdf',
      mediaSize: 1234,
    };
    expect(isViewerAttachment(dto)).toBe(true);
    expect(pickSource(dto)).toEqual({ type: 'base64', value: LONG_BASE64 });
    expect(attachmentMeta(dto)).toEqual({
      name: 'Contract',
      extension: undefined,
      mime: 'application/pdf',
      size: 1234,
    });
    expect(attachmentMeta({ extension: '.PDF', filePath: 'docs/2024/x.bin' })).toEqual(
      expect.objectContaining({ name: 'x.bin', extension: 'pdf' }),
    );
  });

  it('picks one source by precedence and never mistakes a source for an attachment', () => {
    const blob = new Blob(['x']);
    expect(pickSource({ blob, url: 'https://x.test/a', data: 'zz' }).type).toBe('blob');
    expect(pickSource({ url: 'https://x.test/a', filePath: 'p' })).toEqual({
      type: 'url',
      value: 'https://x.test/a',
    });
    expect(pickSource({ filePath: 'p' })).toEqual({ type: 'path', value: 'p' });
    expect(pickSource({ fileName: 'empty.pdf' })).toEqual({ type: 'none' });
    expect(isViewerAttachment(blob)).toBe(false);
    expect(isViewerAttachment(of({ data: 'x' }))).toBe(false);
    expect(isViewerAttachment(Promise.resolve({ data: 'x' }))).toBe(false);
  });

  it('adds an extension only when the name lacks it', () => {
    expect(withExtension('report', 'pdf')).toBe('report.pdf');
    expect(withExtension('photo.jpeg', 'jpg')).toBe('photo.jpeg');
    expect(withExtension('Contract', '')).toBe('Contract');
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
    expect(formatBytes(undefined)).toBe('');
  });
});
