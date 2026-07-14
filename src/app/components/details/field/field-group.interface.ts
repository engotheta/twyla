import { ActionButton } from '../../action-buttons/action-button.interface';
import { FieldsProperties } from '../detail.interface';
import { DataField } from './field.interface';

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
  // if "..." is found as one of the keys, all fields not existing in any other group will be added to this group
  fields?: DataField[];

  fieldsClass?: string;

  headerClass?: string;
  showHeader?: boolean;

  label?: string;
  labelClass?: string;
  labelsClass?: string;

  showGroupsInTabs?: boolean;
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
  hideUndefined?: boolean;
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
