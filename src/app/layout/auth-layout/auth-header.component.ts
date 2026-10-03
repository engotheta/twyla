import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { BrandLogoComponent } from '../brand-logo.component';
import { LAYOUT_CONFIG } from '../layout-config.token';
import { urlPath } from '../menu/menu.helpers';
import { UserMenuComponent } from '../menu/user-menu.component';

/**
 * The public pages' top bar (GASCO's auth-header): the brand, then Home / Sign in / Register for
 * visitors — the page you're on left out — or "Open modules" and the user menu once signed in.
 */
@Component({
  selector: 'auth-header',
  imports: [RouterLink, MatButton, BrandLogoComponent, UserMenuComponent],
  template: `
    <header class="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-10">
      <a
        class="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        routerLink="/home"
      >
        <brand-logo />
      </a>
      <span class="flex-1"></span>
      <nav aria-label="Account" class="flex items-center gap-1 sm:gap-2">
        @if (user()) {
          <a mat-flat-button [routerLink]="homeUrl">Open modules</a>
          <user-menu />
        } @else {
          @if (path() !== '/home') {
            <a mat-button class="hidden! sm:inline-flex!" routerLink="/home">Home</a>
          }
          @if (path() !== '/auth/login') {
            <a mat-button routerLink="/auth/login">Sign in</a>
          }
          @if (path() !== '/auth/register') {
            <a mat-flat-button routerLink="/auth/register">Register</a>
          }
        }
      </nav>
    </header>
  `,
  host: { class: 'block shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthHeaderComponent {
  private readonly config = inject(LAYOUT_CONFIG);
  protected readonly user = this.config.user;
  protected readonly homeUrl = this.config.homeUrl;
  private readonly router = inject(Router);

  protected readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => urlPath(event.urlAfterRedirects)),
    ),
    { initialValue: urlPath(this.router.url) },
  );
}
