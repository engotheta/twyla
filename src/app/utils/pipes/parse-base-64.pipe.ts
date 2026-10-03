import { Pipe, PipeTransform } from '@angular/core';
import { getBase64Object } from '../base-64.helpers';

@Pipe({ name: 'parseBase64' })
export class ParseBase64Pipe implements PipeTransform {
  transform(value?: string) {
    if (typeof value != 'string') return value;
    return getBase64Object(value);
  }
}
