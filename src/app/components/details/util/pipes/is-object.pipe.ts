import { Pipe, PipeTransform } from '@angular/core';
import { isObject } from '../util.helpers';

@Pipe({
  name: 'isObject',
})
export class IsObjectPipe implements PipeTransform {
  transform(value: any): any {
    return isObject(value);
  }
}
