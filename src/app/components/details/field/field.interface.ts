import {
  ActionButton,
  DynamicValue,
  TooltipConfig,
} from '../../action-buttons/action-button.interface';
import { FieldGroupData } from './field-group.interface';

export type FieldLayout = 'table' | 'list' | 'inline-list' | 'palletes';

// Primitive JS types
export type FieldTypePrimitive =
  'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function';

// Rich / rendered content types
export type FieldTypeRich =
  'pdf' | 'date' | 'image' | 'base64' | 'comment' | 'percentage' | 'attachment' | 'hexColorCode';

// Array variants
export type FieldTypeArray =
  | 'array'
  | 'stringArray'
  | 'objectArray'
  | 'numberArray'
  | 'booleanArray'
  | 'commentArray'
  | 'attachmentArray';

export type FieldType = FieldTypePrimitive | FieldTypeRich | FieldTypeArray;

export type DataField = string | (Field & FamilyField);

/**
 * Applies a single Field's config to a set of sibling keys that share
 * the same shape (e.g. rendering several similarly-typed fields with one definition).
 */
export interface FamilyField extends Field {
  siblings?: string[];
}

/** Key/value extraction for array item rendering (see Field.itemMap). */
export type ItemKeyValueMap =
  { key?: string; value?: string } | ((item: any) => { key?: string; value?: string });

export interface Field {
  // Identity
  key: string;
  path?: string;
  type?: FieldType;
  order?: number;
  buttons?: ActionButton[];
  visible?: DynamicValue<boolean, any>;
  tooltip?: DynamicValue<string, any>;
  tooltipConfig?: DynamicValue<TooltipConfig, any>;

  // Display
  showColon?: boolean;
  showUnderline?: boolean;
  class?: DynamicValue<string, any>;
  innerClass?: DynamicValue<string, any>;
  outerClass?: DynamicValue<string, any>;

  // Label
  label?: string;
  showLabel?: boolean;
  labelClass?: DynamicValue<string, any>;
  labelIcon?: DynamicValue<string, any>;

  // Value
  value?: DynamicValue<any, any>; // only fn is allowed for value, otherwise evaluated
  valueClass?: DynamicValue<string, any>;
  valueIcon?: DynamicValue<string, any>;
  truncate?: number; // if set, value will be truncated to this length and an ellipsis will be added

  // Icon
  icon?: DynamicValue<string, any>;
  iconClass?: DynamicValue<string, any>;

  // Nested object/array rendering
  layout?: FieldLayout;
  labelKey?: string;
  visibleFields?: DataField[];
  sortedFields?: DataField[];

  // Object-specific
  spread?: boolean;
  expanded?: boolean;

  // Array-specific
  tabular?: boolean;
  itemMap?: ItemKeyValueMap;
  itemButtons?: ActionButton[];
}

//evaluated field
export interface FieldData extends Field {
  value?: any;
  sensitive?: boolean;
  fieldString?: string;

  validBase64?: boolean;
  extension?: string;
  isArray?: boolean;

  labelField?: Field;

  isObject?: boolean;
  object?: Field;
  fields?: Field[]; //for objects
  fieldGroups?: FieldGroupData[]; // for arrays

  //below list all the evaluated props from Field interface
}

// props that can be extracted from a field string
export const FIELD_PROPS = [
  'type type(string)',
  'order type(number)',
  'visible type(boolean)',

  'showColon type(boolean)',
  'showUnderline type(boolean)',
  'class mergeWith(fieldsClass) type(string)',
  'innerClass mergeWith(fieldsInnerClass) type(string)',
  'outerClass mergeWith(fieldsOuterClass) type(string)',

  'label type(string)',
  'showLabel type(boolean)',
  'labelClass mergeWith(labelsClass) type(string)',
  'labelIcon type(string)',

  'valueClass mergeWith(valuesClass) type(string)',
  'valueIcon type(string)',

  'icon type(string)',
  'iconClass mergeWith(iconsClass) type(string)',

  'layout type(string)',
  'labelKey type(string)',
  'visibleFields type(stringArray)',
  'sortedFields type(stringArray)',

  'spread type(boolean)',
  'expanded type(boolean)',

  'tabular type(boolean)',
  'truncate type(number)',
  'tooltip type(string)',
];
