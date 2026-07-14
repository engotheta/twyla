import { Pipe, PipeTransform } from '@angular/core';
import { mergeClasses } from './class-name.helpers';

@Pipe({
  name: 'mergeClasses',
})
export class MergeClassesPipe implements PipeTransform {
  transform(...classLists: string[] | any[]): any {
    let mergedClass = '';
    mergedClass = classLists.reduce((a, b) => mergeClasses(a, b), '');
    return mergedClass;
  }
}
