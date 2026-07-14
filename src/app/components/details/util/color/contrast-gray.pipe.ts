import { Pipe, PipeTransform } from '@angular/core';
import { getContrastGray, getContrastColor } from './color.helpers';

@Pipe({
  name: 'contrastGray',
})
export class ContrastGrayPipe implements PipeTransform {
  transform(value: string): string {
    return getContrastGray(value);
  }
}
