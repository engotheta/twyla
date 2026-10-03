// file-viewer barrel — import everything from '.../file-viewer'

export * from './file-viewer.interface';
export * from './file-viewer-config.token';
export * from './file-viewer.component';
export * from './file-viewer-dialog.component';
export * from './file-viewer.service';
export * from './viewer-controller';
export * from './loader/file-loader.service';
export {
  formatBytes,
  isViewerAttachment,
  attachmentMeta,
  classifyString,
} from './loader/file-source.helpers';
export { resolveKind, normalizeExtension, normalizeMime } from './loader/file-kind.helpers';
