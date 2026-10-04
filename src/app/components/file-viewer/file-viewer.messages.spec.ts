import { FileViewerError } from './file-viewer.interface';
import { failureMessage, FILE_VIEWER_EN, fileErrorMessage } from './file-viewer.messages';
import { FILE_VIEWER_SW } from './file-viewer.messages.sw';
import { httpError } from './loader/file-loader.service';

describe('file viewer messages', () => {
  it("says the viewer's own errors in the language asked for", () => {
    expect(fileErrorMessage(httpError(404), FILE_VIEWER_SW.errors)).toBe('Faili halikupatikana.');
    expect(fileErrorMessage(httpError(0), FILE_VIEWER_SW.errors)).toBe(
      'Imeshindikana kuifikia seva — angalia muunganisho wako.',
    );
    // the ones that quote the response keep its status
    expect(fileErrorMessage(httpError(503), FILE_VIEWER_SW.errors)).toBe(
      'Seva imeshindwa kutuma faili (503).',
    );
    expect(fileErrorMessage(httpError(418, "I'm a teapot"), FILE_VIEWER_EN.errors)).toBe(
      "The file couldn't be loaded (418 I'm a teapot).",
    );
  });

  it('keeps the English on the error itself, for logs and for apps that read `message`', () => {
    expect(httpError(403).message).toBe("You don't have access to this file.");
    expect(httpError(403).code).toBe('forbidden');
    expect(httpError(503).message).toBe("The server couldn't send the file (503).");
  });

  it("leaves an app's own error as it was written", () => {
    const error = new FileViewerError('Your storage quota is used up.', 507);
    expect(fileErrorMessage(error, FILE_VIEWER_SW.errors)).toBe('Your storage quota is used up.');
  });

  it('puts a failure into words: text as written, or a pick from the messages', () => {
    expect(failureMessage('Nope.', FILE_VIEWER_SW)).toBe('Nope.');
    expect(failureMessage((text) => text.pdf.damaged, FILE_VIEWER_EN)).toBe(
      'This PDF is damaged or not a PDF at all.',
    );
    expect(failureMessage((text) => text.pdf.damaged, FILE_VIEWER_SW)).toBe(
      'PDF hii imeharibika au si PDF hata kidogo.',
    );
  });
});
