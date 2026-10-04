import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { injectMessages } from '@services/i18n/message-bundle';
import { LAYOUT_MESSAGES } from '../layout.messages';
import { MenuBadgeComponent } from './menu-badge.component';
import { MenuIconComponent } from './menu-icon.component';
import { MenuNode } from './menu.interface';
import { SidebarMenuState } from './sidebar-menu.state';

const ROW =
  'group relative flex min-h-10 items-center gap-3 rounded-lg px-2 py-1.5 text-start ' +
  'text-sm text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 ' +
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

/** a nested row leaves room at its start for the line beside the list and its branch */
const ROW_WIDTH = { top: 'w-full', nested: 'ms-[1.375rem] w-[calc(100%-1.375rem)]' };

/** the current page: a tint — and, at the top level, a bar at the row's start edge (in a nested
 *  list the lit branch says it) */
const ACTIVE = 'bg-primary/10! font-medium text-blue-800!';
const ACTIVE_BAR =
  'before:absolute before:inset-y-2 before:-start-1 before:w-1 before:rounded-full before:bg-primary';

/** a list's start edge is where its line runs: under the centre of the parent's icon at the
 *  first level, under the parent's circle below that */
const LIST = { top: 'space-y-0.5', first: 'ms-6', deeper: 'ms-[0.9375rem]' };

// ── the line beside a nested list ──
// Three pieces per child, all decoration: the rail (the child's own stretch of the line down the
// list, the full height of the child and whatever it has open), the branch (from the line to the
// child, halfway down its row) and the node (the small circle the branch ends in). Because every
// child draws its own stretch, the line stops at the last child's branch whatever the heights
// are, and lighting the way to the current page is a matter of which pieces take the primary
// colour: the rails of the children above it, then its own branch and node. (The `menu-…` names
// carry no style: they say which piece is which, to a reader of the page and to the tests.)
const LINE = 'pointer-events-none absolute transition-colors duration-200 motion-reduce:transition-none';
const FAINT = 'border-gray-200';
/** above the faint pieces it crosses */
const LIT = 'z-1 border-primary';
const RAIL = `menu-rail ${LINE} inset-y-0 start-0 border-s`;
/** from the list's edge (which the row's margin leaves clear) to the node, ending level with the
 *  middle of the row; it starts a little above the row, to meet the stretch of line before it */
const BRANCH = `menu-branch ${LINE} -start-[1.375rem] -top-0.5 bottom-1/2 w-3 border-b`;
/** the turn from the line into the branch — drawn where the line ends (the last child) or lights
 *  up no further (the current one); elsewhere the rail passes straight by */
const TURN = 'rounded-es-lg border-s';
const NODE = `menu-node ${LINE} -start-[0.625rem] top-1/2 size-[0.4375rem] -translate-y-1/2 rounded-full border-[1.5px]`;
/** from an open group down to its list: below the icon at the top level, below the node deeper */
const STEM = {
  top: `menu-stem ${LINE} start-6 top-[calc(50%+1rem)] bottom-0 border-s`,
  nested: `menu-stem ${LINE} -start-[0.4375rem] top-[calc(50%+0.25rem)] bottom-0 border-s`,
};
/** the pieces light up one after another, from the top */
const LIGHT_STEP_MS = 30;

/**
 * One level of the side menu; groups render the next level with this same component, so any
 * depth works. Groups are disclosure buttons (`aria-expanded` / `aria-controls`); a closed group's
 * list is `inert`, out of the tab order. Pages are links marked `aria-current="page"`.
 *
 * A nested list has a line down its start edge with a branch to each child, lit from the top as
 * far as the child the current page is, or is under (`SidebarMenuState.onTrail`).
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
    <ul [class]="listClass()">
      @for (item of items(); track item.id; let i = $index, last = $last) {
        @let lit = state.onTrail(item);
        <li [class]="nested() ? 'relative pt-0.5' : ''">
          @if (nested() && !last) {
            <span
              aria-hidden="true"
              [class]="railClass(i)"
              [style.transition-delay.ms]="lightDelay(i, i < litIndex())"
            ></span>
          }
          @switch (item.type) {
            @case ('sub') {
              @let open = state.isOpen(item);
              <button
                type="button"
                [class]="row()"
                [attr.aria-expanded]="open"
                [attr.aria-controls]="item.id"
                (click)="state.toggle(item, items())"
              >
                <ng-container
                  [ngTemplateOutlet]="content"
                  [ngTemplateOutletContext]="{ $implicit: item, index: i, last, lit }"
                />
                <mat-icon
                  class="shrink-0 text-gray-500 transition-transform motion-reduce:transition-none"
                  [class.rotate-90]="open"
                  aria-hidden="true"
                >
                  chevron_right
                </mat-icon>
                @if (open) {
                  <span aria-hidden="true" [class]="stemClass(lit)"></span>
                }
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
                [class]="row()"
                [routerLink]="item.link"
                [routerLinkActive]="active()"
                ariaCurrentWhenActive="page"
              >
                <ng-container
                  [ngTemplateOutlet]="content"
                  [ngTemplateOutletContext]="{ $implicit: item, index: i, last, lit }"
                />
              </a>
            }
            @default {
              <a
                [class]="row()"
                [href]="item.link"
                [attr.target]="item.type === 'extTabLink' ? '_blank' : null"
                rel="noopener noreferrer"
              >
                <ng-container
                  [ngTemplateOutlet]="content"
                  [ngTemplateOutletContext]="{ $implicit: item, index: i, last, lit }"
                />
                <mat-icon class="shrink-0 size-6! text-base! text-gray-500" aria-hidden="true"
                  >open_in_new</mat-icon
                >
                @if (item.type === 'extTabLink') {
                  <span class="sr-only">{{ t().newTab }}</span>
                }
              </a>
            }
          }
        </li>
      }
    </ul>

    <!-- what a row holds: at the top level its icon, in a nested list its branch and node -->
    <ng-template #content let-item let-index="index" let-last="last" let-lit="lit">
      @if (nested()) {
        <span
          aria-hidden="true"
          [class]="branchClass(lit, last)"
          [style.transition-delay.ms]="lightDelay(index, lit)"
        ></span>
        <span
          aria-hidden="true"
          [class]="nodeClass(item, lit)"
          [style.transition-delay.ms]="lightDelay(index + 1, lit)"
        ></span>
      } @else {
        <menu-icon
          class="size-8 shrink-0 rounded-lg transition-colors group-hover:bg-white"
          [class]="lit && item.type === 'sub' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'"
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

  protected readonly t = injectMessages(LAYOUT_MESSAGES);

  protected readonly nested = computed(() => this.level() > 0);
  protected readonly listClass = computed(() =>
    this.level() === 0 ? LIST.top : this.level() === 1 ? LIST.first : LIST.deeper,
  );
  protected readonly row = computed(() => `${ROW} ${this.nested() ? ROW_WIDTH.nested : ROW_WIDTH.top}`);
  protected readonly active = computed(() => (this.nested() ? ACTIVE : `${ACTIVE} ${ACTIVE_BAR}`));

  /** which of this list's items the current page is, or is under; -1 when it is elsewhere */
  protected readonly litIndex = computed(() =>
    this.items().findIndex((item) => this.state.onTrail(item)),
  );

  /** the stretch of line beside the item at `index`: lit while the current page is further down */
  protected railClass(index: number): string {
    return `${RAIL} ${index < this.litIndex() ? LIT : FAINT}`;
  }

  protected branchClass(lit: boolean, last: boolean): string {
    return `${BRANCH} ${lit || last ? TURN : ''} ${lit ? LIT : FAINT}`;
  }

  /** hollow; primary for a group the current page is under; filled for the page itself */
  protected nodeClass(item: MenuNode, lit: boolean): string {
    if (!lit) return `${NODE} border-gray-400 bg-white`;
    return `${NODE} z-1 border-primary ${this.state.isCurrent(item) ? 'bg-primary' : 'bg-white'}`;
  }

  protected stemClass(lit: boolean): string {
    return `${this.nested() ? STEM.nested : STEM.top} ${lit ? LIT : FAINT}`;
  }

  /** a piece waits its turn to light up, and goes out at once */
  protected lightDelay(step: number, lit: boolean): number {
    return lit ? step * LIGHT_STEP_MS : 0;
  }
}
