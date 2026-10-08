import { Signal } from '@angular/core';
import { actionShortcut, toggleShortcut } from '@services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { DetailsMessages } from './details.messages';
import { DetailsParameter } from './interfaces/details.interface';
import { FieldLayout } from './interfaces/field.interface';

/** The details component's keyboard shortcuts. */
export const DETAILS_SCOPE: ShortcutScope = { id: 'details', key: 'd' };

/** what the shortcuts act on — `DetailsComponent` hands it over */
export interface DetailsShortcutTarget {
  /** the params in force: as given, with the overrides laid over */
  params: () => DetailsParameter<any>;
  overrides: () => Partial<DetailsParameter<any>>;
  /** lays a patch over the params for as long as the component is on screen */
  override: (patch: Partial<DetailsParameter<any>>) => void;
  reset: () => void;
  groupCount: () => number;
}

/**
 * How the entity is laid out — 1 to 4 pick a layout, as they do in e-Ardhi — and what of it is
 * shown. What is hidden on purpose stays hidden: `showSensitive` and `hiddenFields` have no
 * shortcut.
 */
export function detailsShortcuts(
  details: DetailsShortcutTarget,
  t: Signal<DetailsMessages>,
): Shortcut[] {
  const text = () => t().shortcuts;
  const params = details.params;

  const layout = (id: string, key: string, label: () => string, value: FieldLayout): Shortcut => ({
    id,
    key,
    label,
    on: () => (params().layout ?? 'list') === value,
    run: () => details.override({ layout: value }),
  });

  const flag = (
    id: string,
    key: string,
    label: () => string,
    param: 'showGroupsInTabs' | 'showUndefined' | 'showEmptyArrays' | 'showBgIconMark',
    available?: () => boolean,
  ): Shortcut =>
    toggleShortcut(
      id,
      key,
      label,
      () => params()[param] === true,
      (on) => details.override({ [param]: on }),
      { available },
    );

  return [
    layout('list', '1', () => text().list, 'list'),
    layout('inlineList', '2', () => text().inlineList, 'inline-list'),
    layout('table', '3', () => text().table, 'table'),
    layout('palettes', '4', () => text().palettes, 'palletes'),
    toggleShortcut(
      'expandLists',
      'e',
      () => text().expandLists,
      () => params().arrayConfig?.expanded === true,
      (expanded) => details.override({ arrayConfig: { ...params().arrayConfig, expanded } }),
    ),
    flag(
      'tabs',
      't',
      () => text().tabs,
      'showGroupsInTabs',
      () => details.groupCount() > 1,
    ),
    flag('undefinedValues', 'u', () => text().undefinedValues, 'showUndefined'),
    flag('emptyArrays', 'a', () => text().emptyArrays, 'showEmptyArrays'),
    flag('iconMarks', 'i', () => text().iconMarks, 'showBgIconMark'),
    actionShortcut('reset', '0', () => text().reset, details.reset, {
      available: () => Object.keys(details.overrides()).length > 0,
    }),
  ];
}
