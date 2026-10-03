import { Pipe, PipeTransform } from '@angular/core';
import { getContrastGray, getContrastColor } from '../color.helpers';

@Pipe({
  name: 'contrastColor',
})
export class ContrastColorPipe implements PipeTransform {
  transform(value: string): string {
    return getContrastColor(value);
  }
}
