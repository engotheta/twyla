// alternate top-level render modes for the same data/config

export type GridRenderMode = 'table' | 'list' | 'cards';

export interface GridRenderModeConfig<RowType = any> {
  /** default ['table'] */
  modes?: GridRenderMode[];
  /** default first of `modes` */
  initialMode?: GridRenderMode;
  onModeChange?: (mode: GridRenderMode) => void;
  /** default true when modes.length > 1 */
  showModeToggle?: boolean;

  /** per-row template/component used when the current mode is 'cards' */
  cardTemplate?: any;
  /** per-row template/component used when the current mode is 'list' */
  listItemTemplate?: any;
}
