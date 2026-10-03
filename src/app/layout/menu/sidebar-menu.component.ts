import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuBadgeComponent } from './menu-badge.component';
import { MenuIconComponent } from './menu-icon.component';
import { MenuNode } from './menu.interface';
import { SidebarMenuState } from './sidebar-menu.state';

const ROW =
  'group relative flex min-h-10 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start ' +
  'text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

/** a bar at the row's start edge plus a tint — the current page */
const ACTIVE =
  'bg-primary/10! font-medium text-blue-800! before:absolute before:inset-y-2 before:-start-1 ' +
  'before:w-1 before:rounded-full before:bg-primary';

/**
 * One level of the side menu; groups render the next level with this same component, so any
 * depth works. Groups are disclosure buttons (`aria-expanded` / `aria-controls`); a closed group's
 * list is `inert`, out of the tab order. Pages are links marked `aria-current="page"`.
 */
@Component({
  selector: 'sidebar-menu',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    MatIcon,
    MenuIconComponent,
    MenuBadgeComponent,
    SidebarMenuComponent,
  ],
  template: `
    <ul
      [class]="
        level() === 0 ? 'space-y-0.5' : 'ms-6 mt-0.5 space-y-0.5 border-s border-gray-200 ps-2'
      "
    >
      @for (item of items(); track item.id) {
        <li>
          @switch (item.type) {
            @case ('sub') {
              @let open = state.isOpen(item);
              <button
                type="button"
                [class]="row"
                [attr.aria-expanded]="open"
                [attr.aria-controls]="item.id"
                (click)="state.toggle(item, items())"
              >
                <ng-container
                  [ngTemplateOutlet]="content"
                  [ngTemplateOutletContext]="{ $implicit: item }"
                />
                <mat-icon
                  class="shrink-0 text-gray-500 transition-transform motion-reduce:transition-none"
                  [class.rotate-90]="open"
                  aria-hidden="true"
                >
                  chevron_right
                </mat-icon>
              </button>
              <div
                class="grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none"
                [class]="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
              >
                <div class="min-h-0 overflow-hidden" [attr.inert]="open ? null : ''">
                  <sidebar-menu [id]="item.id" [items]="item.children" [level]="level() + 1" />
                </div>
              </div>
            }
            @case ('link') {
              <a
                [class]="row"
                [routerLink]="item.link"
                [routerLinkActive]="active"
                ariaCurrentWhenActive="page"
              >
                <ng-container
                  [ngTemplateOutlet]="content"
                  [ngTemplateOutletContext]="{ $implicit: item }"
                />
              </a>
            }
            @default {
              <a
                [class]="row"
                [href]="item.link"
                [attr.target]="item.type === 'extTabLink' ? '_blank' : null"
                rel="noopener noreferrer"
              >
                <ng-container
                  [ngTemplateOutlet]="content"
                  [ngTemplateOutletContext]="{ $implicit: item }"
                />
                <mat-icon class="shrink-0 text-base! text-gray-500" aria-hidden="true"
                  >open_in_new</mat-icon
                >
                @if (item.type === 'extTabLink') {
                  <span class="sr-only">(opens in a new tab)</span>
                }
              </a>
            }
          }
        </li>
      }
    </ul>

    <ng-template #content let-item>
      @if (level() === 0) {
        <menu-icon
          class="size-8 shrink-0 rounded-lg bg-gray-100 text-gray-600 group-hover:bg-white"
          [item]="item"
        />
      }
      <span class="min-w-0 flex-1 truncate">{{ item.name }}</span>
      <menu-badge [label]="item.label" [badge]="item.badge" />
    </ng-template>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarMenuComponent {
  protected readonly state = inject(SidebarMenuState);

  readonly items = input.required<MenuNode[]>();
  readonly level = input(0);

  protected readonly row = ROW;
  protected readonly active = ACTIVE;
}
