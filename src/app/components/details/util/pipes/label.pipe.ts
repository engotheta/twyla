import { Pipe, PipeTransform } from '@angular/core';
import { isObject } from '../util.helpers';
import { getLabelField, labelFromFieldString } from '../../field/field-labels.helpers';

@Pipe({
  name: 'label',
})
export class LabelPipe implements PipeTransform {
  transform(value: any, parsePrimitives = false): string {
    let item = value;

    if (!parsePrimitives && ['boolean', 'number', 'string'].includes(typeof item)) return item;

    if (typeof item == 'string') return labelFromFieldString(item);
    //
    else if (isObject(item)) return getLabelField(item)?.value;

    return item;
  }
}
