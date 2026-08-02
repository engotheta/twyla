import { Observable, from, isObservable, of } from 'rxjs';
import { DetailsParameter } from './detail.interface';
import { resolveFieldGroups } from './field/field-group.helpers';
import { FieldGroupData, FieldsParameter } from './field/field-group.interface';
import { FieldData } from './field/field.interface';
import { getAllFields } from './field/fields.helper';
import { isValue } from './util/util.helpers';

const SENSITIVE_MASK = '••••••';

/** Normalizes a `DetailsParameter.fetchFn` result (Observable, Promise, or plain value) into an
 *  observable stream. */
export function toObservableSource<T>(value: Observable<T> | Promise<T> | T): Observable<T> {
  if (isObservable(value)) return value;
  return value instanceof Promise ? from(value) : of(value);
}

function toFieldsParameter<T>(parameter: DetailsParameter<T>): FieldsParameter {
  return {
    sortby: parameter.sortby,
    visibleFields: parameter.visibleFields,
    sortedFields: parameter.sortedFields,
    fieldGroups: parameter.fieldGroups,
    fieldGroupsMap: parameter.fieldsGroupsMap,
    hiddenFields: parameter.hiddenFields,
    fieldsStrings: parameter.fieldsStrings,
    fieldsProperties: parameter.fieldsProperties,
    autoMapValues: parameter.autoMapValues,
    showUndefined: parameter.showUndefined,
    undefinedValue: parameter.undefinedValue,
    useTableThres: parameter.arrayConfig?.useTableThres,
  };
}

function maskSensitiveField(field: FieldData): FieldData {
  if (!field.sensitive || !isValue(field.value)) return field;
  return { ...field, value: SENSITIVE_MASK };
}

/** Evaluates a `DetailsParameter.entity` into a flat, display-ready list of fields. */
export function resolveDetailFields<T>(parameter: DetailsParameter<T>): FieldData[] {
  const fields = getAllFields(parameter.entity, toFieldsParameter(parameter)).filter(
    (f) => f.visible !== false,
  );

  return parameter.showSensitive ? fields : fields.map(maskSensitiveField);
}

/** Evaluates a `DetailsParameter.entity` into the groups it should be rendered in. */
export function resolveDetailGroups<T>(parameter: DetailsParameter<T>): FieldGroupData[] {
  return resolveFieldGroups(resolveDetailFields(parameter), parameter);
}
