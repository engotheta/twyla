import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Breadcrumb } from './page-header.interface';

/** A breadcrumb trail; the last item is the current page (`aria-current="page"`). */
@Component({
  selector: 'breadcrumbs',
  imports: [RouterLink, MatIcon],
  template: `
    <nav [attr.aria-label]="label()">
      <ol class="flex flex-wrap items-center gap-x-1 text-xs text-gray-600">
        @for (crumb of items(); track $index; let last = $last) {
          <li class="flex min-w-0 items-center gap-1">
            @if (last) {
              <span class="truncate font-medium text-gray-800" aria-current="page">{{
                crumb.label
              }}</span>
            } @else {
              @if (crumb.route) {
                <a
                  class="truncate rounded-sm underline-offset-2 hover:text-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                  [routerLink]="crumb.route"
                >
                  {{ crumb.label }}
                </a>
              } @else {
                <span class="truncate">{{ crumb.label }}</span>
              }
              <mat-icon
                class="size-4! shrink-0 text-base! leading-4! text-gray-400"
                aria-hidden="true"
              >
                chevron_right
              </mat-icon>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbsComponent {
  readonly items = input.required<Breadcrumb[]>();
  /** the landmark's name — unique per page when a page shows more than one trail */
  readonly label = input('Breadcrumb');
}
