import { signal } from '@angular/core';
import { Shortcut } from '@services/shortcuts/shortcuts.interface';
import { FILE_VIEWER_EN } from './file-viewer.messages';
import { fileViewerShortcuts, FileViewerShortcutTarget } from './file-viewer.shortcuts';

describe('fileViewerShortcuts', () => {
  /** a viewer showing one image: it zooms and rotates, and has nothing to search or page */
  const image = (over: Partial<FileViewerShortcutTarget> = {}): FileViewerShortcutTarget => ({
    canZoom: () => true,
    canRotate: () => true,
    canSearch: () => false,
    canShowThumbnails: () => false,
    canFullscreen: () => true,
    canDownload: () => true,
    several: () => false,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: vi.fn(),
    rotate: vi.fn(),
    step: vi.fn(),
    find: vi.fn(),
    toggleFullscreen: vi.fn(),
    isFullscreen: () => false,
    download: vi.fn(),
    thumbnailsOpen: () => false,
    toggleThumbnails: vi.fn(),
    titleShown: () => true,
    showTitle: vi.fn(),
    ...over,
  });

  const build = (viewer: FileViewerShortcutTarget): Shortcut[] =>
    fileViewerShortcuts(viewer, signal(FILE_VIEWER_EN));
  const offered = (shortcuts: Shortcut[]) =>
    shortcuts.filter((one) => one.available?.() !== false).map((one) => one.id);

  it('offers what the file shown allows', () => {
    expect(offered(build(image()))).toEqual([
      'zoomIn',
      'zoomOut',
      'resetZoom',
      'rotate',
      'fullScreen',
      'download',
      'titleBar',
    ]);
  });

  it('adds stepping, finding and thumbnails where there is something to step, find or page', () => {
    const pdfs = image({
      several: () => true,
      canSearch: () => true,
      canShowThumbnails: () => true,
    });
    expect(offered(build(pdfs))).toEqual(
      expect.arrayContaining(['nextFile', 'previousFile', 'find', 'thumbnails']),
    );
  });

  it('runs the viewer’s own commands', () => {
    const viewer = image({ several: () => true });
    const shortcut = (id: string) => build(viewer).find((one) => one.id === id)!;

    shortcut('zoomIn').run();
    shortcut('rotate').run();
    shortcut('nextFile').run();
    shortcut('previousFile').run();
    shortcut('titleBar').run();

    expect(viewer.zoomIn).toHaveBeenCalled();
    expect(viewer.rotate).toHaveBeenCalled();
    expect(viewer.step).toHaveBeenNthCalledWith(1, 1);
    expect(viewer.step).toHaveBeenNthCalledWith(2, -1);
    // the title bar was showing: its switch turns it off
    expect(viewer.showTitle).toHaveBeenCalledWith(false);
  });

  it('closes the hint for find, which takes the focus to its own box', () => {
    const find = build(image({ canSearch: () => true })).find((one) => one.id === 'find')!;
    expect(find.dismiss).toBe(true);
  });

  it('uses the keys the viewer already answers to while it has focus', () => {
    const keys = Object.fromEntries(build(image()).map((one) => [one.id, one.key]));
    expect(keys).toMatchObject({ zoomIn: '+', zoomOut: '-', resetZoom: '0', rotate: 'r' });
  });
});
