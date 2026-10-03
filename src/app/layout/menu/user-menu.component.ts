import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { LAYOUT_CONFIG } from '../layout-config.token';
import { resolveMenu } from './menu.helpers';
import { MenuIconComponent } from './menu-icon.component';

/**
 * The signed-in user's avatar (or initials) opening their menu: "All modules", the configured
 * `userMenu` entries, "Sign out". Shows a "Sign in" link when nobody is signed in.
 */
@Component({
  selector: 'user-menu',
  imports: [
    RouterLink,
    MatButton,
    MatDivider,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MenuIconComponent,
  ],
  template: `
    @if (user(); as user) {
      <button
        type="button"
        class="flex items-center gap-2 rounded-full p-1 text-start hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary md:pe-2"
        [attr.aria-label]="'Account: ' + user.name"
        [matMenuTriggerFor]="panel"
      >
        @if (user.avatar && !avatarFailed()) {
          <img
            class="size-8 shrink-0 rounded-full bg-gray-100 object-cover"
            alt=""
            width="32"
            height="32"
            [src]="user.avatar"
            (error)="avatarFailed.set(true)"
          />
        } @else {
          <span
            class="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {{ initials() }}
          </span>
        }
        <span class="hidden max-w-40 truncate text-sm font-medium text-gray-800 md:block">
          {{ user.name }}
        </span>
        <mat-icon class="hidden! text-gray-500 md:inline-block!" aria-hidden="true"
          >expand_more</mat-icon
        >
      </button>

      <mat-menu #panel="matMenu" xPosition="before">
        <p class="px-4 pt-2 pb-2 leading-snug">
          <span class="block text-sm font-medium text-gray-900">{{ user.name }}</span>
          @if (user.subtitle || user.email) {
            <span class="block text-xs text-gray-600">{{ user.subtitle ?? user.email }}</span>
          }
        </p>
        <mat-divider />
        <a mat-menu-item [routerLink]="config.homeUrl">
          <mat-icon aria-hidden="true">apps</mat-icon>
          <span>All modules</span>
        </a>
        @for (item of items; track item.id) {
          <a mat-menu-item [routerLink]="item.link">
            <menu-icon class="me-4 text-gray-600" [item]="item" />
            <span>{{ item.name }}</span>
          </a>
        }
        @if (config.signOut) {
          <mat-divider />
          <button mat-menu-item type="button" (click)="signOut()">
            <mat-icon aria-hidden="true">logout</mat-icon>
            <span>Sign out</span>
          </button>
        }
      </mat-menu>
    } @else {
      <a mat-button [routerLink]="config.signInUrl">Sign in</a>
    }
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  protected readonly config = inject(LAYOUT_CONFIG);
  protected readonly user = this.config.user;
  protected readonly items = resolveMenu(this.config.userMenu);

  protected readonly initials = computed(() =>
    (this.user()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join(''),
  );

  /** the avatar image failed to load: show initials instead */
  protected readonly avatarFailed = signal(false);

  protected signOut(): void {
    this.config.signOut?.();
  }
}
