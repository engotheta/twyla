import { isSignal, Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'isSignal',
})
export class IsSignalPipe implements PipeTransform {
  transform(value: any): boolean {
    return isSignal(value);
  }
}
