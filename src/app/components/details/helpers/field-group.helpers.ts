import { ArrayConfig, DetailsParameter } from '../interfaces/details.interface';
import { FieldsGroupsMap, FieldGroup, GROUP_PROPS, FieldGroupData } from '../interfaces/field-group.interface';
import { camelToSpaced } from './field-labels.helpers';
import { propsFromString } from './field-string.helpers';
import { DataField, FieldData } from '../interfaces/field.interface';
import { expandDataFields } from './fields.helpers';

export function getGroupsFromMap(fieldsGroupsMap: FieldsGroupsMap): FieldGroupData[] {
  if (!fieldsGroupsMap) return [];

  let groups: FieldGroupData[] = Object.entries(fieldsGroupsMap).map(([key, value]) => {
    let label = camelToSpaced(key);
    let group: FieldGroupData = { label, ...propsFromString(key, GROUP_PROPS) };

    if (Array.isArray(value)) {
      let values: DataField[] = expandDataFields(value ?? []);
      let fieldsStrings = values.map((k) => (typeof k === 'object' ? k.key : k));
      let keys = fieldsStrings.map((s) => s?.split(' ')?.[0]);
      group = { ...group, keys, fieldsStrings };
    } else group = { ...group, groups: getGroupsFromMap(value) };

    return group;
  });

  return groups;
}

export function getGroupsFromDetailsGroups(detailsGroups: FieldGroup[]): FieldGroupData[] {
  if (!detailsGroups || !Array.isArray(detailsGroups)) return [];

  return detailsGroups.map((detailGroup) => {
    let label = camelToSpaced(detailGroup.label ?? '');
    let { fields, groups, ...group_ } = detailGroup;
    let group: FieldGroupData = { label, ...group_, ...propsFromString(label, GROUP_PROPS) };

    // Handle fields if present
    if (detailGroup.fields && Array.isArray(detailGroup.fields)) {
      let values: DataField[] = expandDataFields(detailGroup.fields);
      let fieldsStrings = values.map((k) => (typeof k === 'object' ? k.key : k));
      let keys = fieldsStrings.map((s) => s?.split(' ')?.[0]);
      group = { ...group, keys, fieldsStrings };
    }

    // Handle nested groups
    if (detailGroup.groups) {
      if (Array.isArray(detailGroup.groups)) {
        // Recursive case: groups is an array of DetailGroup
        group.groups = getGroupsFromDetailsGroups(detailGroup.groups);
        // groups is a FieldsGroupsMap
      } else group.groups = getGroupsFromMap(detailGroup.groups);
    }

    return group;
  });
}

export function dataFieldsFromMap(map: FieldsGroupsMap): DataField[][] {
  let result: DataField[][] = [];

  // Iterate through every value in the current object level
  for (const value of Object.values(map)) {
    // Base case: It's a DataField[], add it to our collection
    if (Array.isArray(value)) result.push(value);
    // Recursive case: It's another FieldsGroupsMap, dig deeper
    else result = result.concat(dataFieldsFromMap(value));
  }

  return result;
}

export function dataFieldsFromDetail(groups: FieldGroup[]): DataField[][] {
  let result: DataField[][] = [];

  for (const group of groups) {
    // If this group has fields directly, add them
    if (group.fields && group.fields.length > 0) result.push(group.fields);

    // If this group has nested groups, process them
    if (group.groups) {
      // Case 1: groups is a FieldsGroupsMap
      if (!Array.isArray(group.groups)) result = result.concat(dataFieldsFromMap(group.groups));
      // Case 2: groups is an array of FieldGroup[]
      else result = result.concat(dataFieldsFromDetail(group.groups));
    }
  }

  return result;
}

// Simplest fallback: one group of all non-array fields, one group of arrays
// (the array group is only added if an array is present and passes `arrayConfig` visibility).
export function defaultGroups(fields: FieldData[], arrayConfig?: ArrayConfig): FieldGroupData[] {
  const isArrayField = (f: FieldData) => !!f.type?.includes('Array');

  const mainFields = fields.filter((f) => !isArrayField(f));
  const arrayFields = fields.filter(isArrayField);

  const groups: FieldGroupData[] = [];
  if (mainFields.length) groups.push({ fields: mainFields });

  const arraysVisible = arrayConfig?.visible !== false;
  const hasValues = arrayFields.some((f) => Array.isArray(f.value) && f.value.length);

  if (arraysVisible && arrayFields.length && (hasValues || arrayConfig?.showEmpty)) {
    groups.push({ fields: arrayFields });
  }

  return groups;
}

// Matches evaluated FieldData onto explicit group definitions (from getGroupsFromMap /
// getGroupsFromDetailsGroups) by key/path. A "..." key catches whatever no other group claimed.
// Groups left with no fields and no subgroups are dropped.
export function attachFieldsToGroups(
  groups: FieldGroupData[],
  fields: FieldData[],
  used: Set<string> = new Set(),
): FieldGroupData[] {
  const fieldId = (f: FieldData) => f.path ?? f.key;

  const resolved = groups.map((group) => {
    const keys = group.keys?.filter((k) => k !== '...') ?? [];
    const matched = keys.length ? fields.filter((f) => keys.includes(f.key) || keys.includes(f.path ?? '')) : [];

    matched.forEach((f) => used.add(fieldId(f)));

    const groups_ = group.groups?.length ? attachFieldsToGroups(group.groups, fields, used) : group.groups;

    return { ...group, fields: matched, groups: groups_ };
  });

  const restIndex = groups.findIndex((g) => g.keys?.includes('...'));
  if (restIndex > -1) {
    const remaining = fields.filter((f) => !used.has(fieldId(f)));
    resolved[restIndex] = {
      ...resolved[restIndex],
      fields: [...(resolved[restIndex].fields ?? []), ...remaining],
    };
  }

  return resolved.filter((g) => (g.fields?.length ?? 0) > 0 || (g.groups?.length ?? 0) > 0);
}

// Three mutually-exclusive strategies, in priority order (see file header table):
// fieldsGroupsMap > fieldGroups > defaultGroups.
export function resolveFieldGroups(
  fields: FieldData[],
  parameter: Pick<DetailsParameter, 'fieldsGroupsMap' | 'fieldGroups' | 'arrayConfig'>,
): FieldGroupData[] {
  if (parameter.fieldsGroupsMap && Object.keys(parameter.fieldsGroupsMap).length) {
    return attachFieldsToGroups(getGroupsFromMap(parameter.fieldsGroupsMap), fields);
  }

  if (parameter.fieldGroups?.length) {
    return attachFieldsToGroups(getGroupsFromDetailsGroups(parameter.fieldGroups), fields);
  }

  return defaultGroups(fields, parameter.arrayConfig);
}
