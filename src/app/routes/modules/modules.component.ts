import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import {
  AppFooterComponent,
  BrandLogoComponent,
  MenuIconComponent,
  MenuService,
  UserMenuComponent,
} from '../../layout';
import { SessionService } from '../../services/session';

/** Where signing in lands (GASCO's staff landing): a card per module the user may open. */
@Component({
  selector: 'modules-page',
  imports: [
    RouterLink,
    MatIcon,
    AppFooterComponent,
    BrandLogoComponent,
    MenuIconComponent,
    UserMenuComponent,
  ],
  template: `
    <header
      class="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 sm:px-6"
    >
      <a
        class="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        routerLink="/home"
      >
        <brand-logo />
      </a>
      <span class="flex-1"></span>
      <user-menu />
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 class="text-2xl font-semibold text-gray-900">
        Welcome back{{ firstName() ? ', ' + firstName() : '' }}
      </h1>
      <p class="mt-1 text-gray-600">Pick a module to get started.</p>

      <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (module of menu.modules(); track module.id) {
          <li>
            <a
              class="group flex h-full items-start gap-4 rounded-xl bg-white p-5 ring-1 ring-gray-200 transition-shadow hover:shadow-md hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              [routerLink]="module.link"
            >
              <menu-icon
                class="size-12 shrink-0 rounded-xl bg-primary/10 text-primary"
                [item]="module"
              />
              <span class="min-w-0 flex-1">
                <span class="block font-semibold text-gray-900">{{ module.name }}</span>
                @if (module.description) {
                  <span class="mt-1 block text-sm text-gray-600">{{ module.description }}</span>
                }
              </span>
              <mat-icon class="shrink-0 text-gray-400 group-hover:text-primary" aria-hidden="true">
                arrow_forward
              </mat-icon>
            </a>
          </li>
        } @empty {
          <li class="text-gray-600">You don't have access to any modules yet.</li>
        }
      </ul>

      <section
        class="mt-10 rounded-xl bg-white p-6 ring-1 ring-gray-200"
        aria-labelledby="getting-started-title"
      >
        <h2 id="getting-started-title" class="text-lg font-semibold text-gray-900">
          Getting started
        </h2>
        <ol class="mt-3 list-decimal space-y-2 ps-5 text-sm text-gray-700">
          <li>
            <strong>Modules</strong> are the <code>isMenu</code> routes in
            <code>app.routes.ts</code>: each loads a shell (<code>*.module.ts</code>) and its own
            routes (<code>*.routes.ts</code>).
          </li>
          <li>
            <strong>Side menus</strong> come from each module's routes:
            <code>data: {{ '{' }} isMenu, name, icon, permissions {{ '}' }}</code> — a
            <code>path: ''</code> route with children is a group.
          </li>
          <li>
            <strong>Brand, header and footer</strong>: <code>provideLayoutConfig()</code> in
            <code>app.config.ts</code>.
          </li>
          <li>
            <strong>Sign-in</strong>: point
            <code>provideSessionConfig({{ '{' }} api {{ '}' }})</code> at your backend — the guards
            and the token interceptor are already wired.
          </li>
        </ol>
      </section>
    </main>

    <app-footer class="border-t border-gray-200 bg-white" />
  `,
  host: { class: 'flex h-full flex-col overflow-y-auto bg-gray-50' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModulesComponent {
  protected readonly menu = inject(MenuService);
  private readonly session = inject(SessionService);

  protected readonly firstName = computed(() => this.session.user()?.name.split(/\s+/)[0] ?? '');
}
