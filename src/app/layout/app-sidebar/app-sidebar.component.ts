import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../brand-logo.component';
import { LAYOUT_CONFIG } from '../layout-config.token';
import { flattenMenu } from '../menu/menu.helpers';
import { MenuIconComponent } from '../menu/menu-icon.component';
import { MenuService } from '../menu/menu.service';
import { SidebarMenuComponent } from '../menu/sidebar-menu.component';
import { SidebarMenuState } from '../menu/sidebar-menu.state';

/** from this many pages up, the menu gets a filter box */
const FILTER_FROM = 8;

/**
 * The sidebar, GASCO style: the brand, a card naming the current module (a module switcher in the
 * drawer, where the module rail is hidden), then the module's menu.
 */
@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    BrandLogoComponent,
    MenuIconComponent,
    SidebarMenuComponent,
  ],
  providers: [SidebarMenuState],
  template: `
    <!-- the whole sidebar is one landmark: brand, module card and menu are all navigation -->
    <nav class="flex h-full flex-col" [attr.aria-label]="(menu.module()?.name ?? 'Main') + ' menu'">
      <div class="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 px-4">
        <a
          class="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          [routerLink]="homeUrl"
        >
          <brand-logo />
        </a>
        @if (closable()) {
          <button
            mat-icon-button
            type="button"
            class="ms-auto"
            aria-label="Close navigation"
            (click)="closed.emit()"
          >
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        }
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        @if (menu.module(); as module) {
          @if (switcher()) {
            <button
              type="button"
              class="relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-gray-100 p-3 text-start focus-visible:outline-2 focus-visible:outline-primary"
              [matMenuTriggerFor]="modules"
            >
              <menu-icon class="size-9 shrink-0 rounded-lg bg-white text-primary" [item]="module" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-gray-900">{{ module.name }}</span>
                <span class="block text-xs text-gray-600">Switch module</span>
              </span>
              <mat-icon class="shrink-0 text-gray-500" aria-hidden="true">unfold_more</mat-icon>
            </button>
            <mat-menu #modules="matMenu">
              <a mat-menu-item [routerLink]="homeUrl">
                <mat-icon aria-hidden="true">apps</mat-icon>
                <span>All modules</span>
              </a>
              @for (item of menu.modules(); track item.id) {
                <a mat-menu-item [routerLink]="item.link">
                  <menu-icon class="me-3 size-6" [item]="item" />
                  <span>{{ item.name }}</span>
                </a>
              }
            </mat-menu>
          } @else {
            <div class="relative overflow-hidden rounded-xl bg-gray-100 px-4 py-3">
              <menu-icon
                class="absolute -end-2 -bottom-3 size-16 text-primary/10 [&_mat-icon]:size-16! [&_mat-icon]:text-[4rem]!"
                [item]="module"
              />
              <span class="relative block truncate font-semibold text-gray-800">{{
                module.name
              }}</span>
            </div>
          }
        }

        @if (showFilter()) {
          <label class="relative block">
            <span class="sr-only">Filter menu</span>
            <mat-icon
              class="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-xl! text-gray-500"
              aria-hidden="true"
            >
              search
            </mat-icon>
            <input
              type="search"
              placeholder="Filter menu"
              autocomplete="off"
              class="h-10 w-full rounded-lg border border-gray-300 bg-white ps-9 pe-3 text-sm placeholder:text-gray-500 focus:border-primary focus:outline-2 focus:outline-primary/30"
              [value]="state.query()"
              (input)="onFilter($event)"
            />
          </label>
        }

        <sidebar-menu [items]="state.items()" />
        <p class="px-2 py-3 text-sm text-gray-600" role="status">
          @if (state.filtering() && !state.items().length) {
            No pages match "{{ state.query() }}".
          }
        </p>
      </div>
    </nav>
  `,
  host: { class: 'block h-full bg-white' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebarComponent {
  protected readonly menu = inject(MenuService);
  protected readonly state = inject(SidebarMenuState);
  protected readonly homeUrl = inject(LAYOUT_CONFIG).homeUrl;

  /** the drawer variant: a module switcher instead of the module card (the rail is hidden) */
  readonly switcher = input(false);
  /** show a close button (the drawer) */
  readonly closable = input(false);
  readonly closed = output<void>();

  protected readonly showFilter = computed(
    () => flattenMenu(this.menu.menu()).filter((node) => node.type !== 'sub').length >= FILTER_FROM,
  );

  protected onFilter(event: Event): void {
    this.state.query.set((event.target as HTMLInputElement).value);
  }
}
