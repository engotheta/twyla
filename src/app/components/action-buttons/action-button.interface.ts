import { Subject } from 'rxjs';
import { ConfirmDialog } from '@services/view/confirm-dialog/confirm-dialog.interface';
import type { DynamicValue } from '@utils/dynamic-value.helpers';

export type ButtonType = 'button' | 'fab' | 'mini-fab' | 'icon' | 'mini-icon';

export type IconType = 'material' | 'SVG' | 'src' | 'base64' | 'url';

export type IconPosition = 'before' | 'after';

// defined beside `resolveDynamicValue$` in utils; re-exported here, where most code meets it
export type { DynamicValue };

export interface ActionButton<D = any> {
  data?: D;
  type?: ButtonType;
  slug?: string;
  click?: (data?: D) => void;
  loading?: DynamicValue<boolean, D>;
  buttons?: ActionButton<D>[];
  permissions?: string[];

  label?: DynamicValue<string, D>;
  labelConfig?: DynamicValue<LabelConfig<D>, D>;

  class?: DynamicValue<string, D>;
  childrenHolderClass?: DynamicValue<string, D>;

  icon?: DynamicValue<string, D>;
  iconConfig?: DynamicValue<IconConfig<D>, D>;

  tooltip?: DynamicValue<string, D>;
  tooltipConfig?: DynamicValue<TooltipConfig<D>, D>;

  disabled?: DynamicValue<boolean, D>;
  visible?: DynamicValue<boolean, D>;

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
