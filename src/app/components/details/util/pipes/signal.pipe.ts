import { isSignal, Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'signal',
})
export class SignalPipe implements PipeTransform {
  transform(value: any): string {
    if (isSignal(value)) value = value();
    return value;
  }
}
