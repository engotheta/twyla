import { Pipe, PipeTransform } from '@angular/core';
import { Observable, isObservable } from 'rxjs';

@Pipe({ name: 'isObservable' })
export class IsObservablePipe implements PipeTransform {
  transform(value: Observable<any> | unknown): boolean {
    return isObservable(value);
  }
}
