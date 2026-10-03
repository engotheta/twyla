import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { LAYOUT_CONFIG } from './layout-config.token';

/**
 * The brand: `LayoutConfig.brand.logo` (a static image, so `NgOptimizedImage`) or, without one,
 * an inline mark — then the name. With `showName` off the name stays for screen readers, so a
 * link wrapping just the mark still has one.
 */
@Component({
  selector: 'brand-logo',
  imports: [NgOptimizedImage],
  template: `
    @if (brand.logo; as logo) {
      <img
        class="size-8 shrink-0 object-contain"
        alt=""
        [ngSrc]="logo.src"
        [width]="logo.width"
        [height]="logo.height"
      />
    } @else {
      <svg class="size-8 shrink-0" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="9" class="fill-primary" />
        <path d="M16 7.5 7.5 12 16 16.5 24.5 12Z" fill="#fff" />
        <path
          d="m7.5 16 8.5 4.5 8.5-4.5M7.5 20l8.5 4.5 8.5-4.5"
          fill="none"
          stroke="#fff"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    }
    <span [class]="showName() ? 'truncate text-base font-semibold tracking-tight' : 'sr-only'">
      {{ brand.name }}
    </span>
  `,
  host: { class: 'inline-flex min-w-0 items-center gap-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogoComponent {
  protected readonly brand = inject(LAYOUT_CONFIG).brand;

  readonly showName = input(true);
}
