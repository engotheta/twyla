import { Signal } from '@angular/core';
import {
  actionShortcut,
  cycleShortcut,
  toggleShortcut,
} from '@services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { GridInstance } from './grid-engine.service';
import { GridMessages } from './grid.messages';
import { GridExportFormat } from './interfaces/grid-export.interface';
import { GridParameter, GridSelectionMode } from './interfaces/grid-parameter.interface';
import { GridRenderMode } from './interfaces/grid-render-mode.interface';

/** The data grid's keyboard shortcuts (SPEC.md §14). */
export const GRID_SCOPE: ShortcutScope = { id: 'data-grid', key: 'g' };

const SELECTION_MODES: readonly GridSelectionMode[] = ['none', 'single', 'multiple'];
const RENDER_MODES: readonly GridRenderMode[] = ['table', 'list', 'cards'];
const EXPORT_FORMATS: GridExportFormat[] = ['csv', 'excel', 'pdf'];

/** what the grid's shortcuts act on — `DataGridComponent` hands it over */
export interface GridShortcutTarget<RowType = any> {
  instance: () => GridInstance<RowType>;
  // as the grid shows them now: each is on, off, or left to the grid (`undefined` in the params)
  showToolbar: () => boolean;
  showSearch: () => boolean;
  showPaginator: () => boolean;
  /** a row was clicked, and there is a details component to show it in */
  canViewDetails: () => boolean;
  viewDetails: () => void;
}

/**
 * Each shortcut switches one feature of the grid by laying an override over its params
 * (`GridInstance.override`) — for as long as the grid is on screen, never saved. The last one
 * goes back to the grid as it was configured.
 */
export function gridShortcuts<RowType>(
  grid: GridShortcutTarget<RowType>,
  t: Signal<GridMessages>,
): Shortcut[] {
  const text = () => t().shortcuts;
  const params = () => grid.instance().params();
  const override = (patch: Partial<GridParameter<RowType>>) => grid.instance().override(patch);
  const overridden = (key: keyof GridParameter) => key in grid.instance().overrides();

  /** a feature that is on unless the params say `false` */
  const onByDefault = (
    id: string,
    key: string,
    label: () => string,
    param: 'unifiedSearch' | 'showTableControlsToggle' | 'addIndexColumn' | 'columnsResizable',
  ): Shortcut =>
    toggleShortcut(
      id,
      key,
      label,
      () => params()[param] !== false,
      (on) => override({ [param]: on }),
    );

  /** …and one that is off unless they say `true` */
  const offByDefault = (
    id: string,
    key: string,
    label: () => string,
    param: 'mergeCells' | 'canAddColumns',
  ): Shortcut =>
    toggleShortcut(
      id,
      key,
      label,
      () => params()[param] === true,
      (on) => override({ [param]: on }),
    );

  return [
    toggleShortcut(
      'toolbar',
      't',
      () => text().toolbar,
      grid.showToolbar,
      (on) => override({ showToolbar: on }),
    ),
    toggleShortcut(
      'search',
      's',
      () => text().search,
      grid.showSearch,
      (on) => override({ showSearch: on }),
    ),
    onByDefault('unifiedSearch', 'u', () => text().unifiedSearch, 'unifiedSearch'),
    // hiding the filters is an override of its own; showing them again is taking it away
    toggleShortcut(
      'filters',
      'f',
      () => text().filters,
      () => (params().gridFilters?.length ?? 0) > 0,
      (on) => override({ gridFilters: on ? undefined : [] }),
      { available: () => (params().gridFilters?.length ?? 0) > 0 || overridden('gridFilters') },
    ),
    toggleShortcut(
      'paginator',
      'p',
      () => text().paginator,
      grid.showPaginator,
      (on) => override({ showPaginator: on }),
    ),
    onByDefault('columnSettings', 'c', () => text().columnSettings, 'showTableControlsToggle'),
    onByDefault('indexColumn', 'i', () => text().indexColumn, 'addIndexColumn'),
    cycleShortcut(
      'selection',
      'b',
      () => text().selection,
      () => SELECTION_MODES,
      () => params().selectionMode ?? 'none',
      (selectionMode) => override({ selectionMode }),
      (mode) => text().selectionModes[mode],
    ),
    cycleShortcut(
      'view',
      'v',
      () => text().view,
      () => params().renderMode?.modes ?? RENDER_MODES,
      () => grid.instance().renderMode(),
      (mode) => grid.instance().setRenderMode(mode),
      (mode) => t().toolbar.modes[mode],
    ),
    offByDefault('mergeCells', 'm', () => text().mergeCells, 'mergeCells'),
    onByDefault('resizable', 'z', () => text().resizable, 'columnsResizable'),
    // on, it offers every format where the grid was given none of its own
    toggleShortcut(
      'export',
      'e',
      () => text().export,
      () => (params().export?.formats?.length ?? 0) > 0,
      (on) => {
        override({ export: undefined });
        const own = params().export;
        if (on === (own?.formats?.length ?? 0) > 0) return;
        override({ export: { ...own, formats: on ? EXPORT_FORMATS : [] } });
      },
    ),
    offByDefault('addColumns', 'a', () => text().addColumns, 'canAddColumns'),
    actionShortcut(
      'reload',
      'r',
      () => text().reload,
      () => grid.instance().refetch(),
    ),
    actionShortcut('rowDetails', 'x', () => text().rowDetails, grid.viewDetails, {
      available: grid.canViewDetails,
      dismiss: true,
    }),
    actionShortcut(
      'reset',
      '0',
      () => text().reset,
      () => grid.instance().resetOverrides(),
      { available: () => Object.keys(grid.instance().overrides()).length > 0 },
    ),
  ];
}
