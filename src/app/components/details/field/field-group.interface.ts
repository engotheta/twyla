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

  fields?: DataField[];
  fieldsClass?: string;

  headerClass?: string;
  showHeader?: boolean;

  label?: string;
  labelClass?: string;
  labelsClass?: string;

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

  'groupsClass',
  'groupsContainerClass',
];
