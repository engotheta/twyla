import { FieldConfig, FieldGroupConfig, ArrayConfig } from '../../detail.interface';
import { FieldGroupData } from '../field-group.interface';
import { FieldData, FieldLayout } from '../field.interface';

/** Accepts either a full parameter object, or the individual `FieldGroupComponent` inputs below. */
export interface FieldGroupParameter<D = unknown> {
  group?: FieldGroupData;
  layout?: FieldLayout;
  fieldConfig?: FieldConfig;
  groupConfig?: FieldGroupConfig;
  arrayConfig?: ArrayConfig;
  showBgIconMark?: boolean;
  showGroupsInTabs?: boolean;
  isArrayItem?: boolean;
  /** Only meaningful when `isArrayItem` — starts the card expanded instead of collapsed. */
  expanded?: boolean;
  data?: D;
  animation?: string;
}

export interface FieldRowViewModel {
  class?: string;
  outerClass?: string;
  innerClass?: string;
  labelClass?: string;
  valueClass?: string;
  icon?: string;
  iconClass?: string;
  labelIcon?: string;
  valueIcon?: string;
  tooltip?: string;
  tooltipPosition: 'above' | 'below' | 'left' | 'right';
  tooltipClass?: string;
}

export interface FieldRow {
  field: FieldData;
  vm: FieldRowViewModel;
}

export const DEFAULT_VIEW_MODEL: FieldRowViewModel = { tooltipPosition: 'below' };
