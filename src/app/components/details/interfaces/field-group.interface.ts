import { ActionButton } from '@components/action-buttons/action-button.interface';
import { ArrayConfig, FieldConfig, FieldGroupConfig, FieldsProperties } from './details.interface';
import { DataField, FieldData, FieldLayout } from './field.interface';

// Three mutually-exclusive strategies, chosen by what inputs are provided, in this priority order:

// | Priority | Trigger               | Method                     | Behavior                        |
// | -------- | --------------------- | -------------------------- | ------------------------------- |
// | 1        | `fieldsGroupsMap` set | `getGroupsFromMap`         | Explicit key→group mapping      |
// | 1 (alt)  | `fieldGroups` set     | `getGroupsFromFieldGroups` | Explicit group definitions      |
// | 2        | neither               | `defaultGroups`         | Two buckets: non-arrays, arrays |

// After group assignment, empty groups are dropped unless `showEmptyGroups` is true.
// note: **`defaultGroups`** is the simplest fallback: one group of all non-array fields,
// one group of arrays (only added if any array is present and passes the `showEmptyArrays` visibility check).

export interface FieldsSort {
  sortby: 'key' | 'label' | 'value';
  direction?: 'ASC' | 'DESC';
}

//user input field group
export interface FieldGroup {
  class?: string;
  slug?: string;
  icon?: string;

  actionButtons?: ActionButton[];

  // a list of keys or fields, if a key is not found in the object, it will be ignored
  // if at least one key is found, the group will be shown, otherwise it will be hidden
  // if "..." is found as one of the keys, all fields not existing in
  //  any other group will be added to this group
  fields?: DataField[];

  fieldsClass?: string;
  fieldsContainerClass?: string;

  headerClass?: string;
  showHeader?: boolean;

  label?: string;
  labelClass?: string;
  labelsClass?: string;

  showGroupsInTabs?: boolean;

  // - Optional icon watermark (`bg-icon-mark`) if `group.icon && showBgIconMark`.
  showBgIconMark?: boolean;

  groups?: FieldGroup[] | FieldsGroupsMap;
  groupsClass?: string;
  groupsContainerClass?: string;
}

export interface FieldsGroupsMap {
  [label: string]: DataField[] | FieldsGroupsMap;
}

// evaluated field group
export interface FieldGroupData extends FieldGroup {
  object?: any;
  hasArray?: boolean;
  groups?: FieldGroupData[];

  keys?: string[];
  fieldsStrings?: string[];

  // evaluated props from FieldGroup interface
}

export interface FieldsParameter {
  sortby?: FieldsSort | FieldsSort[];
  visibleFields?: DataField[];
  sortedFields?: DataField[];

  // strickly for getting fieldsProps / fieldsStrings from a detail object
  fieldGroups?: FieldGroup[];
  fieldGroupsMap?: FieldsGroupsMap;

  hiddenFields?: string[];
  fieldsStrings?: string[];
  fieldsProperties?: FieldsProperties;

  autoMapValues?: boolean;
  showUndefined?: boolean;
  undefinedValue?: string;
  useTableThres?: number;

  defaults?: { [key: string]: any };
}

// props that can be extracted from a field group string
export const GROUP_PROPS = [
  'class',
  'slug',
  'icon',

  'fields type(stringArray)',
  'fieldsContainerClass',
  'fieldsClass',

  'headerClass',
  'showHeader type(boolean)',

  'label',
  'labelClass',
  'labelsClass',

  'showGroupsInTabs type(boolean)',
  'groupsClass',
  'groupsContainerClass',
];

// ── the field-group component's own parameter and row view model ──

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
