import { expand } from 'rxjs';
import { FieldsGroupsMap, FieldGroup, GROUP_PROPS, FieldGroupData } from './field-group.interface';
import { camelToSpaced } from './field-labels.helpers';
import { propsFromString } from './field-string.helpers';
import { DataField } from './field.interface';
import { expandDataFields } from './fields.helper';

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
