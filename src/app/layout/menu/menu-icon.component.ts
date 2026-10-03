import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MenuNode } from './menu.interface';

/** A menu item's icon — a Material ligature or a registered SVG — or its initial without one. */
@Component({
  selector: 'menu-icon',
  imports: [MatIcon],
  template: `
    @let item = this.item();
    @if (!item.icon) {
      <span class="text-sm font-semibold" aria-hidden="true">{{ initial() }}</span>
    } @else if (item.iconType === 'svg') {
      <mat-icon aria-hidden="true" [svgIcon]="item.icon" />
    } @else {
      <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
    }
  `,
  host: { class: 'inline-grid place-items-center' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuIconComponent {
  readonly item = input.required<Pick<MenuNode, 'name' | 'icon' | 'iconType'>>();

  protected readonly initial = computed(() => this.item().name.trim().charAt(0).toUpperCase());
}
