import { combineLatest, map, Observable, switchMap } from 'rxjs';
import { ConfirmDialog } from '@services/view/confirm-dialog/confirm-dialog.interface';
import { resolveDynamicValue$ } from '@utils/dynamic-value.helpers';
import { mergeClasses } from '@utils/class-name.helpers';
import {
  ActionButton,
  ButtonAvatar,
  FileChangeEvent,
  FileConfig,
  IconPosition,
  IconType,
} from './action-button.interface';

// ─────────────────────────────────────────────
// What a button and a menu item share: an `ActionButton`'s dynamic props resolved into one
// view model, and what a click or a picked file does.
// ─────────────────────────────────────────────

/** An `ActionButton` with every `DynamicValue` prop resolved. */
export interface ActionButtonViewModel {
  label?: string;
  labelClass?: string;
  labelMaxLength?: number;
  ariaLabel?: string;
  avatar?: ButtonAvatar;
  link?: string | readonly unknown[];
  /** the menu of its children: a heading, which way it opens (its class is `childrenHolderClass`) */
  menuTitle?: string;
  menuSubtitle?: string;
  menuPosition: 'before' | 'after';
  icon?: string;
  iconType: IconType;
  iconClass?: string;
  iconPosition: IconPosition;
  tooltip?: string;
  tooltipPosition: 'above' | 'below' | 'left' | 'right';
  tooltipClass?: string;
  disabled: boolean;
  visible: boolean;
  loading: boolean;
  class?: string;
  childrenHolderClass?: string;
  fileConfig?: FileConfig;
  confirmMessage?: string;
  confirmConfig?: ConfirmDialog;
}

export const DEFAULT_VIEW_MODEL: ActionButtonViewModel = {
  menuPosition: 'after',
  iconType: 'material',
  iconPosition: 'before',
  tooltipPosition: 'below',
  disabled: false,
  visible: true,
  loading: false,
};

const DEFAULT_FILE_CONFIG: FileConfig = { multiple: false, updateLabel: true };

/** `button`'s view model, re-emitted whenever one of its observable props emits */
export function actionButtonViewModel$<D>(
  button: ActionButton<D>,
  data: D,
): Observable<ActionButtonViewModel> {
  return combineLatest({
    label: resolveLabel$(button, data),
    icon: resolveIcon$(button, data),
    tooltip: resolveTooltip$(button, data),
    menu: resolveMenu$(button, data),
    misc: resolveMisc$(button, data),
  }).pipe(
    map(({ label, icon, tooltip, menu, misc }) => ({
      ...label,
      ...icon,
      ...tooltip,
      ...misc,
      menuTitle: menu.title,
      menuSubtitle: menu.subtitle,
      menuPosition: menu.position,
      // the panel's class: `childrenHolderClass`, then the menu's own on top
      childrenHolderClass:
        mergeClasses(misc.childrenHolderClass ?? '', menu.panelClass ?? '') || undefined,
    })),
  );
}

function resolveLabel$<D>(button: ActionButton<D>, data: D) {
  return resolveDynamicValue$(button.labelConfig, data).pipe(
    switchMap((config) =>
      combineLatest({
        fromConfig: resolveDynamicValue$(config?.label, data),
        fallback: resolveDynamicValue$(button.label, data),
        labelClass: resolveDynamicValue$(config?.class, data),
      }).pipe(
        map(({ fromConfig, fallback, labelClass }) => ({
          label: fromConfig ?? fallback,
          labelClass,
          labelMaxLength: config?.maxLength,
        })),
      ),
    ),
  );
}

function resolveIcon$<D>(button: ActionButton<D>, data: D) {
  return resolveDynamicValue$(button.iconConfig, data).pipe(
    switchMap((config) =>
      combineLatest({
        fallback: resolveDynamicValue$(button.icon, data),
        iconClass: resolveDynamicValue$(config?.class, data),
      }).pipe(
        map(({ fallback, iconClass }) => ({
          icon: config?.icon ?? fallback,
          iconType: config?.type ?? 'material',
          iconClass,
          iconPosition: config?.position ?? 'before',
        })),
      ),
    ),
  );
}

function resolveTooltip$<D>(button: ActionButton<D>, data: D) {
  return resolveDynamicValue$(button.tooltipConfig, data).pipe(
    switchMap((config) =>
      combineLatest({
        fromConfig: resolveDynamicValue$(config?.tooltip, data),
        fallback: resolveDynamicValue$(button.tooltip, data),
        position: resolveDynamicValue$(config?.position, data),
        tooltipClass: resolveDynamicValue$(config?.class, data),
      }).pipe(
        map((x) => ({
          tooltip: x.fromConfig ?? x.fallback,
          tooltipPosition: x.position ?? 'below',
          tooltipClass: x.tooltipClass,
        })),
      ),
    ),
  );
}

function resolveMenu$<D>(button: ActionButton<D>, data: D) {
  return resolveDynamicValue$(button.menuConfig, data).pipe(
    switchMap((config) =>
      combineLatest({
        title: resolveDynamicValue$(config?.title, data),
        subtitle: resolveDynamicValue$(config?.subtitle, data),
        panelClass: resolveDynamicValue$(config?.class, data),
      }).pipe(map((menu) => ({ ...menu, position: config?.xPosition ?? ('after' as const) }))),
    ),
  );
}

function resolveMisc$<D>(button: ActionButton<D>, data: D) {
  return combineLatest({
    ariaLabel: resolveDynamicValue$(button.ariaLabel, data),
    avatar: resolveDynamicValue$(button.avatar, data),
    link: resolveDynamicValue$(button.link, data),
    disabled: resolveDynamicValue$(button.disabled, data),
    visible: resolveDynamicValue$(button.visible, data),
    loading: resolveDynamicValue$(button.loading, data),
    hostClass: resolveDynamicValue$(button.class, data),
    childrenHolderClass: resolveDynamicValue$(button.childrenHolderClass, data),
    fileConfig: resolveDynamicValue$(button.fileConfig, data),
    confirmMessage: resolveDynamicValue$(button.confirmMessage, data),
    confirmConfig: resolveDynamicValue$(button.confirmConfig, data),
  }).pipe(
    map((x) => ({
      ariaLabel: x.ariaLabel,
      avatar: x.avatar,
      link: x.link,
      disabled: x.disabled ?? false,
      visible: x.visible ?? true,
      loading: x.loading ?? false,
      class: x.hostClass,
      childrenHolderClass: x.childrenHolderClass,
      fileConfig: x.fileConfig ? { ...DEFAULT_FILE_CONFIG, ...x.fileConfig } : undefined,
      confirmMessage: x.confirmMessage,
      confirmConfig: x.confirmConfig,
    })),
  );
}

/** a button picks files, rather than running `click`, when it has file settings of its own */
export function isFileButton(button: ActionButton): boolean {
  return button.fileConfig !== undefined || button.fileChange !== undefined;
}

/** what the button shows: the picked files' names (a file button, unless `updateLabel: false`),
 *  else its label, cut to `labelMaxLength` */
export function displayLabel(
  button: ActionButton,
  vm: ActionButtonViewModel,
  fileNames: readonly string[],
): string {
  const updateLabel = vm.fileConfig?.updateLabel ?? true;
  if (isFileButton(button) && updateLabel && fileNames.length) return fileNames.join(', ');

  const { label, labelMaxLength } = vm;
  if (!label || !labelMaxLength || label.length <= labelMaxLength) return label ?? '';
  return `${label.slice(0, labelMaxLength)}…`;
}

/** `fileConfig.extensions` as a file input's `accept`: ['png', '.jpg'] → '.png,.jpg' */
export function acceptAttribute(extensions: string[] | undefined): string | null {
  if (!extensions?.length) return null;
  return extensions.map((e) => (e.startsWith('.') ? e : `.${e}`)).join(',');
}

/** hands each picked file to the button's `fileConfig.change` (else `fileChange`); returns
 *  their names */
export function reportFiles(
  button: ActionButton,
  fileConfig: FileConfig | undefined,
  files: FileList | File[],
  event: Event,
): string[] {
  const names: string[] = [];
  for (const file of Array.from(files)) {
    names.push(file.name);
    const change: FileChangeEvent = {
      event: event as InputEvent,
      file,
      fileName: file.name,
      extension: file.name.includes('.') ? (file.name.split('.').pop() ?? '') : '',
    };
    (fileConfig?.change ?? button.fileChange)?.(change);
  }
  return names;
}

/** One entry of a row or a menu of buttons, as `tidyDividers` needs to see it. */
export interface DividedEntry {
  /** the entry is a divider (`ActionButton.divider`), not a button */
  divider: boolean;
  visible: boolean;
  /** a divider with a label: the heading of the group below it */
  heading: boolean;
}

/**
 * The entries to show, with their dividers put in order: a divider is kept only when it has
 * something to divide — a visible button follows it, and one comes before it. So none at either
 * end, none doubled, none beside a group whose buttons are all hidden. A divider with a label is
 * its group's heading as well: it stays even at the top, there without its line (`line: false`).
 */
export function tidyDividers<T extends DividedEntry>(
  entries: readonly T[],
): { entry: T; line: boolean }[] {
  const visible = entries.filter((entry) => entry.visible);
  const kept: { entry: T; line: boolean }[] = [];
  visible.forEach((entry, index) => {
    if (!entry.divider) {
      kept.push({ entry, line: false });
      return;
    }
    const next = visible[index + 1];
    if (!next || next.divider) return; // nothing in the group it would open
    const first = kept.length === 0;
    if (first && !entry.heading) return; // nothing above it to divide from
    kept.push({ entry, line: !first });
  });
  return kept;
}

/** `'Ada Lovelace'` → `'AL'`: the first letters of the first two words, for an avatar with no
 *  picture to show */
export function initialsOf(name: string | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
