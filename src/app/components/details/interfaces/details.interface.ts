import { Observable } from 'rxjs';
import { FieldLayout, DataField, Field } from './field.interface';
import { FieldGroup, FieldsGroupsMap, FieldsSort } from './field-group.interface';

export interface FieldsProperties {
  [key: string]: Partial<Field>;
}

// inputs
export interface DetailsParameter<TEntity = Record<string, unknown>> {
  header?: HeaderConfig;

  //a css animation class
  animation?: string;

  // if set, fields will be sorted by this order,
  // otherwise they will be sorted by the order in the object
  sortby?: FieldsSort | FieldsSort[];

  // if set, fields will be shown in this order
  sortedFields?: DataField[];

  // defaults to 'list'
  layout?: FieldLayout;

  entity?: TEntity;

  // function to fetch the entity, e.g. from an API — resolved asynchronously; while pending (or
  // when omitted), `entity` above (if provided) is used as a fallback value. Sets `loading`/
  // `error` on the rendering `DetailsComponent`.
  fetchFn?: () => Observable<TEntity> | Promise<TEntity> | TEntity;

  // if set, only these fields will be shown,
  // if ['key1', 'key2', ...] then these keys will be shown in that order plus the rest of the keys
  visibleFields?: DataField[];

  fieldGroups?: FieldGroup[];
  fieldsGroupsMap?: FieldsGroupsMap;

  // if true, the background icon will be shown in eachGroup if has icon,
  // from comp 'BgIconMarkComponent'
  showBgIconMark?: boolean;

  // if true, groups will be shown in tabs instead of a list
  showGroupsInTabs?: boolean;

  // fieldsProperties and fieldsStrings, and can be used to modify the field's properties
  fieldsProperties?: FieldsProperties;

  // keystring/path modifiers for fields, e.g. 'key1 type(string), key2 label(My Label)'
  fieldsStrings?: string[];

  autoMapValues?: boolean;

  // if true, the value will be clickable and will show the inner object in a modal,
  // if false, the value will be shown as a string
  viewInnerObjects?: boolean;

  // if set, this value will be used for undefined values instead of 'undefined' def: '--'
  undefinedValue?: string;

  hiddenFields?: string[];
  showSensitive?: boolean;
  showUndefined?: boolean;

  // default: false
  showEmptyArrays?: boolean;

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
  class?: string;
  groupClass?: string; // group container class // item class
  fieldsContainerClass?: string; // fields container class
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
  containerClass?: string;
}
