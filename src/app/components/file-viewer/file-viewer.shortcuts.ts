import { Signal } from '@angular/core';
import { actionShortcut, toggleShortcut } from '@services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { FileViewerMessages } from './file-viewer.messages';

/** The file viewer's keyboard shortcuts, as the shortcuts hint and panel offer them. */
export const FILE_VIEWER_SCOPE: ShortcutScope = { id: 'file-viewer', key: 'v' };

/** what the shortcuts act on — `FileViewerComponent` hands it over */
export interface FileViewerShortcutTarget {
  /** what the file shown allows, and the toolbar was not told to hide */
  canZoom: () => boolean;
  canRotate: () => boolean;
  canSearch: () => boolean;
  canShowThumbnails: () => boolean;
  canFullscreen: () => boolean;
  canDownload: () => boolean;
  /** there are several files to step through */
  several: () => boolean;

  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  rotate: () => void;
  step: (by: 1 | -1) => void;
  find: () => void;
  toggleFullscreen: () => void;
  isFullscreen: () => boolean;
  download: () => void;
  thumbnailsOpen: () => boolean;
  toggleThumbnails: () => void;
  titleShown: () => boolean;
  showTitle: (shown: boolean) => void;
}

/**
 * The viewer's commands, reachable without first putting focus in it — beside the keys it
 * already answers to while it has focus (`+` `-` `0` `R` and the arrows, README.md), which stay
 * as they are — plus its title bar.
 */
export function fileViewerShortcuts(
  viewer: FileViewerShortcutTarget,
  t: Signal<FileViewerMessages>,
): Shortcut[] {
  const text = () => t().toolbar;

  return [
    actionShortcut('zoomIn', '+', () => text().zoomIn, viewer.zoomIn, {
      available: viewer.canZoom,
    }),
    actionShortcut('zoomOut', '-', () => text().zoomOut, viewer.zoomOut, {
      available: viewer.canZoom,
    }),
    actionShortcut('resetZoom', '0', () => t().shortcuts.resetZoom, viewer.resetZoom, {
      available: viewer.canZoom,
    }),
    actionShortcut('rotate', 'r', () => text().rotate, viewer.rotate, {
      available: viewer.canRotate,
    }),
    actionShortcut(
      'nextFile',
      'n',
      () => text().nextFile,
      () => viewer.step(1),
      {
        available: viewer.several,
      },
    ),
    actionShortcut(
      'previousFile',
      'p',
      () => text().previousFile,
      () => viewer.step(-1),
      {
        available: viewer.several,
      },
    ),
    actionShortcut('find', 'f', () => text().find, viewer.find, {
      available: viewer.canSearch,
      dismiss: true,
    }),
    toggleShortcut(
      'thumbnails',
      'h',
      () => text().thumbnails,
      viewer.thumbnailsOpen,
      viewer.toggleThumbnails,
      { available: viewer.canShowThumbnails },
    ),
    toggleShortcut(
      'fullScreen',
      's',
      () => text().fullScreen,
      viewer.isFullscreen,
      viewer.toggleFullscreen,
      { available: viewer.canFullscreen },
    ),
    actionShortcut('download', 'd', () => t().actions.download, viewer.download, {
      available: viewer.canDownload,
    }),
    toggleShortcut(
      'titleBar',
      't',
      () => t().shortcuts.titleBar,
      viewer.titleShown,
      viewer.showTitle,
    ),
  ];
}
