import { Subject } from 'rxjs';
import { ConfirmDialog } from '@services/view/confirm-dialog/confirm-dialog.interface';
import type { DynamicValue } from '@utils/dynamic-value.helpers';

export type ButtonType = 'button' | 'fab' | 'mini-fab' | 'icon' | 'mini-icon';

/** how a labelled button (`type: 'button'`) is drawn — Material's appearances */
export type ButtonAppearance = 'outlined' | 'text' | 'filled' | 'tonal' | 'elevated';

export type IconType = 'material' | 'SVG' | 'src' | 'base64' | 'url';

export type IconPosition = 'before' | 'after';

// defined beside `resolveDynamicValue$` in utils; re-exported here, where most code meets it
export type { DynamicValue };

export interface ActionButton<D = any> {
  data?: D;
  type?: ButtonType;
  /** for `type: 'button'` (the default type): default `'outlined'` */
  appearance?: ButtonAppearance;
  slug?: string;
  click?: (data?: D) => void;
  loading?: DynamicValue<boolean, D>;
  /**
   * Child buttons: the items of a menu this button opens — arrow keys, type-ahead and Esc as in
   * any menu, and a child with `buttons` of its own opens a submenu. `menuConfig` gives the menu
   * a heading, and `{ divider: true }` among the children splits them into groups.
   */
  buttons?: ActionButton<D>[];
  permissions?: string[];

  label?: DynamicValue<string, D>;
  labelConfig?: DynamicValue<LabelConfig<D>, D>;
  /**
   * The accessible name, where the label can't be it: a label that is hidden at some widths, a
   * button that is only an avatar. (An icon-only button needs none: its tooltip, else its
   * label, names it.)
   */
  ariaLabel?: DynamicValue<string, D>;

  class?: DynamicValue<string, D>;
  /** the class of the menu panel holding the child `buttons` (`menuConfig.class` is the same) */
  childrenHolderClass?: DynamicValue<string, D>;

  icon?: DynamicValue<string, D>;
  iconConfig?: DynamicValue<IconConfig<D>, D>;
  /** a round picture ahead of the label — or initials, where there is none to show */
  avatar?: DynamicValue<ButtonAvatar, D>;

  tooltip?: DynamicValue<string, D>;
  tooltipConfig?: DynamicValue<TooltipConfig<D>, D>;

  disabled?: DynamicValue<boolean, D>;
  visible?: DynamicValue<boolean, D>;

  /**
   * Where the button goes in the app: a router URL, or the commands of a `routerLink`. In a menu
   * the item is a real link — it can be opened in a new tab — and `click`, if there is one, runs
   * as it is followed; a confirmation or a file picker has no place on a link. A button outside
   * a menu goes there when clicked, after its `click` and any confirmation.
   */
  link?: DynamicValue<string | readonly unknown[], D>;

  /**
   * Makes this entry a divider rather than a button. Among a button's children: a line across
   * the menu, between the items above and below it — and with a `label`, the heading of the
   * group below. In a row of buttons: a thin rule between two of them. A divider with nothing
   * to divide (at either end, beside another, next to a group whose items are all hidden) is
   * left out. Of the other props only `label`, `visible` and `permissions` apply.
   */
  divider?: boolean;

  /** the menu the child `buttons` open in: a heading on top of it, its class, where it opens */
  menuConfig?: DynamicValue<MenuConfig<D>, D>;

  // If set, a confirmation dialog will be shown before executing the click action.
  confirmMessage?: DynamicValue<string, D>;
  confirmConfig?: DynamicValue<ConfirmDialog, D>;

  //these also tells if btn is file input button
  fileChange?: (fileChangeEvent: FileChangeEvent) => void;
  fileConfig?: DynamicValue<FileConfig, D>;
}

export interface TooltipConfig<D = any> {
  tooltip?: DynamicValue<string, D>;
  position?: DynamicValue<'above' | 'below' | 'left' | 'right', D>;
  class?: DynamicValue<string, D>;
}

export interface LabelConfig<D = any> {
  label?: DynamicValue<string, D>;
  class?: DynamicValue<string, D>;
  maxLength?: number; // If set, the label will be truncated to this length and an ellipsis will be added.
}

export interface ActionButtonsParameter<D = any> {
  data?: D;
  animation?: unknown;
  buttons?: DynamicValue<ActionButton<D>[], D>;
}

export interface IconConfig<D = any> {
  icon?: string;
  type?: IconType;
  class?: DynamicValue<string, D>;
  position?: IconPosition;
}

/** A person's (or a thing's) picture on a button. */
export interface ButtonAvatar {
  /** the image; without one — or when it fails to load — the initials of `name` are shown */
  src?: string;
  /** whose it is: the first letters of its first two words are the initials */
  name?: string;
  /** classes for the circle, merged over its own (`size-8`, …) */
  class?: string;
}

/** The menu a button's child `buttons` open in. */
export interface MenuConfig<D = any> {
  /** a heading on top of the menu, above a divider — it also names the menu to a screen reader */
  title?: DynamicValue<string, D>;
  /** a second, smaller line under the title */
  subtitle?: DynamicValue<string, D>;
  /** the menu panel's class — as `childrenHolderClass`, and merged after it */
  class?: DynamicValue<string, D>;
  /** which way the menu opens from the button: `'after'` (default) grows towards the end of the
   *  line, `'before'` towards its start — for a button at the end edge of the page */
  xPosition?: 'before' | 'after';
}

export interface FileConfig {
  extensions?: string[];
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  change?: (fileChangeEvent: FileChangeEvent) => void;
  updateLabel?: boolean; // If true, the label of the button will be updated with the name of the selected file(s).
  removeFile$?: Subject<any>; // Emits when a selected file should be removed.
}

export interface FileChangeEvent {
  event: InputEvent;
  file: File;
  fileName: string;
  extension: string;
}
