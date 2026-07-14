import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'bg-icon-mark',
  imports: [MatIcon],
  template: `
    <div
      class="{{ outerClass() }} absolute overflow-hidden size-full top-0 left-0
      {{ animation() }} --order-4"
    >
      <div class="absolute top-[50%] right-[-40%] size-full">
        @if (icon(); as icon) {
          <mat-icon
            [svgIcon]="icon"
            class="absolute icon-full opacity-[0.015]"
            [style.opacity]="opacity()"
          />
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BgIconMarkComponent {
  readonly animation = input<string>();
  readonly icon = input<string>();
  readonly opacity = input<number>();
  readonly outerClass = input('');
}
