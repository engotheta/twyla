import { isValidBase64, getBase64Object } from '../util/base-64/base-64.helpers';
import { isValue, isObject, splitFieldString, getPathValue } from '../util/util.helpers';
import { FieldsSort, FieldsParameter, FieldGroupData } from './field-group.interface';
import {
  COMMENT_KEYS,
  ATTACHMENT_KEYS,
  PERCENTAGE_KEYS,
  SENSITIVE_KEYS,
} from './field-keys.constants';
import { USE_TABLE_THRES, UNDEFINED_VALUES } from './field.constants';
import { Field, FieldType, FIELD_PROPS, DataField, FieldData } from './field.interface';
import { getKeys } from './field-keys.helpers';
import { FILE_EXTENSION_ATTRIBUTE_MAP } from '../util/file.interface';
import {
  camelToSpaced,
  capFirstChar,
  getAttachmentIcon,
  getLabelField,
  labelFromFieldString,
} from './field-labels.helpers';
import { mergeFieldStrings, propsFromString } from './field-string.helpers';
import { SUFFIX_TYPE_MAP } from './field-maps.constants';
import { dataFieldsFromMap, dataFieldsFromDetail } from './field-group.helpers';

type Obj = Record<string, any> | null | undefined;

export function getFields(obj: Obj, hiddenKeys?: string[], types?: FieldType[]): Field[] {
  if (typeof obj !== 'object' || !obj) return [];

  let fields: Field[] = Object.keys(obj)
    .filter((key) => !hiddenKeys?.includes(key))
    .map((key) => ({ key, value: obj[key], label: camelToSpaced(key) }))
    .map((field: Field) => {
      let type: FieldType = typeof field.value;
      if (Array.isArray(field.value) && typeof field.value?.[0] === 'object') type = 'objectArray';
      field.type = type;
      return field;
    });

  if (types) fields = fields.filter((f) => f.type && types.includes(f.type));
  return fields;
}

export function getFieldType(f: Field): FieldType {
  if (!isValue(f.value) || f.value === null || f.value === undefined) return 'undefined';

  let isArray = Array.isArray(f.value);
  let isCommentKey = (key: string) => COMMENT_KEYS.find((c) => key.includes(c));
  let isAttachmentKey = (key: string) => ATTACHMENT_KEYS.find((c) => key.includes(c));
  let isNumber = typeof f.value === 'number';
  let isHex = (value: any) => /^#([0-9a-fA-F]{3}){1,2}$/.test(value);
  let isString = (value: any) => typeof value === 'string';
  let isNumber_ = (value: any) => typeof value === 'number';

  let fVal = f?.value?.[0];

  let extensions = Object.keys(FILE_EXTENSION_ATTRIBUTE_MAP);

  if (isArray && Object.keys(fVal ?? {}).some((k) => isCommentKey(k))) return 'commentArray';
  if (isArray && Object.keys(fVal ?? {}).some((k) => isAttachmentKey(k))) return 'attachmentArray';
  if (isArray && isObject(fVal)) return 'objectArray';
  if (isArray && isString(fVal)) return 'stringArray';
  if (isArray && isNumber_(fVal)) return 'numberArray';

  if (isAttachmentKey(f.key)) return 'attachment';
  if (isString(f.value) && extensions.find((e) => f.value.includes(e))) return 'attachment';
  if (isObject(f.value) && Object.keys(f.value).some((k) => isCommentKey(k))) return 'comment';
  if (PERCENTAGE_KEYS.find((c) => f.key.includes(c)) && isNumber) return 'percentage';
  if (isString(f.value) && isHex(f.value)) return 'hexColorCode';
  if (isObject(f.value)) return 'object';

  let validBase64 = isValidBase64(f.value);
  let bObj = validBase64 ? getBase64Object(f.value) : undefined;

  if (validBase64 && bObj?.extension !== 'pdf') return 'image';
  if (validBase64 && bObj?.extension === 'pdf') return 'pdf';
  return Array.isArray(f.value) ? 'array' : <any>typeof f.value;
}

export function expandDataFields(dataFields: DataField[]) {
  let isString = (k: any) => typeof k === 'string';
  return dataFields?.reduce((p: DataField[], k: DataField) => {
    let e = isString(k) ? [k] : k.siblings ? k.siblings.map((s) => ({ ...k, key: s })) : [k];
    return p.concat(e);
  }, []);
}

export function parseFieldsParameter(specs: FieldsParameter = {}) {
  // expand siblings //merge visibible keys
  specs.visibleFields = expandDataFields(specs.visibleFields ?? []);

  specs.visibleFields?.forEach((k) => {
    let props = specs.fieldsProperties;

    if (typeof k === 'string') return;
    let key = k.key.split(' ')[0];
    specs.fieldsProperties = { ...props, [key]: { ...props?.[key], ...k } };
  });

  // merge fields strings
  let isString = (k: any) => typeof k === 'string';

  let groupsDataFields = [
    ...dataFieldsFromMap(specs.fieldGroupsMap ?? {}),
    ...dataFieldsFromDetail(specs.fieldGroups ?? []),
  ];

  // add fields props from groups dataFields
  groupsDataFields.forEach((dataFields) => {
    expandDataFields(dataFields).forEach((k) => {
      if (isString(k)) return;
      let key = k.key.split(' ')[0];
      let props = specs.fieldsProperties;
      specs.fieldsProperties = { ...props, [key]: { ...props?.[key], ...k } };
    });
  });

  let getFString = (k: DataField) => (isString(k) ? k : (k.key ?? ''));

  //consolidate all fieldstrings
  const ss: string[] = (specs?.fieldsStrings ?? [])
    .concat(specs?.visibleFields?.map((k) => getFString(k)) ?? [])
    .concat(specs?.sortedFields?.map((k) => getFString(k)) ?? [])
    .concat(groupsDataFields.reduce((p: string[], c) => p.concat(c.map((k) => getFString(k))), []));

  const splitedStrings = ss.map((s) => splitFieldString(s)).reduce((a, b) => a.concat(b), []);
  const fieldsStrings = mergeFieldStrings(splitedStrings);
  specs.fieldsStrings = fieldsStrings;

  return specs;
}

export function getAllFields(obj: any, fp: FieldsParameter = {}, path: string = ''): FieldData[] {
  if (!Object.keys(obj ?? {}).length) return [];

  //parse spes / visibles keys / fieldsprops / fieldsstrings
  fp = parseFieldsParameter(fp);

  // set paths from visible or use all object's keys
  let vf = fp.visibleFields;
  let paths = vf?.length ? getKeys(vf) : (Object.keys(obj ?? {}) ?? []);

  let allFields: Field[] = [];

  const isEither = (value: any, values: any[] | string): boolean => {
    if (!Array.isArray(values)) values = [values];
    return values.findIndex((v) => v === value) > -1;
  };

  const endsWithEither = (value: string, values: any[] | string): boolean => {
    if (!Array.isArray(values)) values = [values];
    return !!values.find((v) => value.endsWith(v));
  };

  while (paths.length) {
    const keyPath: string = <any>paths.shift();
    const value = getPathValue(obj, keyPath);

    let type: FieldType = <any>undefined;

    // set auto map
    if (fp.autoMapValues) {
      let key = Object.keys(SUFFIX_TYPE_MAP).find((k: string) => keyPath?.endsWith(k));
      if (!!key) type = SUFFIX_TYPE_MAP[key];
    }

    if (!type) type = getFieldType({ key: keyPath, value });

    const fullPath = path ? `${path}.${keyPath}` : keyPath;
    const endsWithSensitive = SENSITIVE_KEYS.map((k) => capFirstChar(k));
    const fieldsStrings = fp.fieldsStrings ?? [];
    let value_ = fp.undefinedValue && !isValue(value) ? fp.undefinedValue : value;

    // set up base Field
    const baseField: Field = { type, key: keyPath, path: fullPath, value: value_ };
    // set auto icon on attachment fields
    if (['attachment'].includes(type)) baseField.labelIcon = getAttachmentIcon(value);

    const undefinedHide = fp.hideUndefined && !isValue(value);
    const hiddenHide = !!fp?.hiddenFields?.length && isEither(fullPath, fp.hiddenFields);

    let p = fullPath;
    let x = keyPath;
    let ss = fieldsStrings;

    let k_ = (s: string) => s.split(' ')[0];
    let fs = ss?.find((s) => k_(s) === p || k_(s) === x || p.endsWith(k_(s))) ?? keyPath ?? '';
    const fieldString = fs;

    let field: FieldData = {
      sensitive: isEither(keyPath, SENSITIVE_KEYS) || endsWithEither(keyPath, endsWithSensitive),
      visible: !(hiddenHide || undefinedHide),
      label: labelFromFieldString(fieldString),
      fieldString,
      showColon: true,
      showLabel: true,
      showUnderline: true,

      ...baseField,
      ...propsFromString(fieldString, FIELD_PROPS, fp?.defaults),
      ...fp.fieldsProperties?.[fullPath],
    };

    let hasObjectItem = () => typeof value?.[0] === 'object';
    let hasNestedFields = (type?.includes('Array') && hasObjectItem()) || type?.includes('object');
    if (hasNestedFields) field = attachNestedFields(field, fp);
    allFields.push(field);
  }

  // sort by sortedkeys order
  if (fp.sortedFields?.length) {
    let inSorted = (f: FieldData) =>
      !!getKeys(fp.sortedFields ?? [])?.find((s) => f.key.includes(s)) ? 1 : 0;

    allFields = [...allFields].sort((a, b) => inSorted(b) - inSorted(a));
  }

  if (fp.sortby) sortFields(allFields, fp.sortby);

  return allFields;
}

export function attachNestedFields(field: FieldData, specs: FieldsParameter): FieldData {
  const value = field.value;
  let hasObjectItem = () => typeof value?.[0] === 'object';

  // use field 's data for inner childrens specs
  let fieldSpecs: FieldsParameter = {
    ...specs,
    visibleFields: field.visibleFields ?? [],
    sortedFields: field.sortedFields ?? specs.sortedFields ?? [],
    fieldGroupsMap: undefined,
    fieldGroups: undefined,
  };

  //handle objects // arrays
  //TODO: try to avoid max-stack for object  and array on large hightly nested objects
  if (isObject(value)) {
    const labelField = getLabelField(field.value);
    let fields = getAllFields(value, fieldSpecs, field.path);
    field = { ...field, labelField, isObject: true, fields };
  }

  // object array value // items list are fieldgroups
  else if (field.type?.includes('Array') && hasObjectItem()) {
    const fieldGroups: FieldGroupData[] = [];

    for (let index = 0; index < field.value.length; index++) {
      let labelField = getLabelField(field.value[index]);
      let fields = getAllFields(field.value[index], fieldSpecs, `${field.path}[${index}]`);
      // remove labelField from fields
      fields = fields.filter((f) => f.key !== labelField.key);
      fieldGroups.push({ label: labelField?.value, fields });
    }

    let tabular = value?.length >= (specs?.useTableThres ?? USE_TABLE_THRES);
    field = { ...field, tabular, fieldGroups };
  }

  return field;
}

export function sortFields(fields: Field[], sortby: FieldsSort | FieldsSort[]) {
  if (!Array.isArray(sortby)) sortby = !!sortby ? [sortby] : [];

  sortby.forEach((s) => {
    let u = UNDEFINED_VALUES;
    let stringFromField = (f: Field) => f?.[s.sortby]?.toString();
    let compare = (a: Field, b: Field) => stringFromField(a)?.localeCompare(stringFromField(b));
    let has = (a: Field, b: Field) => <any>u.includes(a.value) - <any>u.includes(b.value);

    fields.sort((a: Field, b: Field) => (s.sortby === 'value' ? has(a, b) : compare(a, b)));
    if (s.direction == 'DESC') fields.reverse();
  });
}

export function flattenFields(fields: FieldData[]): FieldData[] {
  return fields.reduce((p, field) => {
    p.push(field);
    if (field.fields && Array.isArray(field.fields)) p.push(...flattenFields(field.fields));
    return p;
  }, [] as FieldData[]);
}
