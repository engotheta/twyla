import { FieldLayout, DataField, Field } from './field/field.interface';
import { FieldGroup, FieldsGroupsMap, FieldsSort } from './field/field-group.interface';

export interface FieldsProperties {
  [key: string]: Partial<Field>;
}

// inputs
export interface DetailsParameter<TEntity = Record<string, unknown>> {
  header?: HeaderConfig;
  animation?: string;
  sortby?: FieldsSort | FieldsSort[];
  sortOrder?: DataField[];
  layout?: FieldLayout;

  entity?: TEntity;
  visibleFields?: DataField[];
  fieldGroups?: FieldGroup[];
  fieldsGroupsMap?: FieldsGroupsMap;

  hiddenFields?: string[];
  showSensitive?: boolean;
  showUndefined?: boolean;
  fieldsProperties?: FieldsProperties;
  fieldsStrings?: string[];

  autoMapValues?: boolean;
  undefinedValue?: string;
  viewInnerObjects?: boolean;

  fieldConfig?: FieldConfig;
  tableConfig?: TableConfig;
  arrayConfig?: ArrayConfig;
  groupConfig?: FieldGroupConfig;
}

export interface ModifierProps {
  childrenKey?: string;
  inherit?: boolean;
  defaults?: { [key: string]: any };

  key?: string;
  label?: string;
  lastDotAsName?: boolean;
}

export interface TableConfig {
  viewDetailsClicks?: number;
}

export interface HeaderConfig {
  show?: boolean;
  class?: string;
  title?: string;
  titleClass?: string;
}

export interface ArrayConfig {
  visible?: boolean;
  showEmpty?: boolean;
  expanded?: boolean;
  showHeaders?: boolean;
  indexClass?: string;
  useTableThres?: number;
}

export interface FieldGroupConfig {
  containerClass?: string;
  class?: string;
  labelsClass?: string;
  showLabels?: boolean;
}

export interface FieldConfig {
  class?: string;
  innerClass?: string;
  iconsClass?: string;
  labelsClass?: string;
  valuesClass?: string;
  showColon?: boolean;
  showUnderlines?: boolean;
  dividerClass?: string;
}
