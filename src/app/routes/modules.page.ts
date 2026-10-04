import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import {
  AppFooterComponent,
  BrandLogoComponent,
  LAYOUT_CONFIG,
  MenuIconComponent,
  MenuService,
  UserMenuComponent,
} from '@layout';
import { injectMessages } from '@services/i18n';
import { SessionService } from '@services/session';
import { SettingsButtonComponent } from '@services/settings';
import { PAGES_MESSAGES } from './pages.messages';
import { RichTextComponent } from './shared/rich-text.component';

/** Where signing in lands (GASCO's staff landing): a card per module the user may open. */
@Component({
  selector: 'modules-page',
  imports: [
    RouterLink,
    MatIcon,
    AppFooterComponent,
    BrandLogoComponent,
    MenuIconComponent,
    RichTextComponent,
    SettingsButtonComponent,
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
      @if (showSettings) {
        <settings-button />
      }
      <user-menu />
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 class="text-2xl font-semibold text-gray-900">{{ t().modules.welcome(firstName()) }}</h1>
      <p class="mt-1 text-gray-600">{{ t().modules.lead }}</p>

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
          <li class="text-gray-600">{{ t().modules.empty }}</li>
        }
      </ul>

      <section
        class="mt-10 rounded-xl bg-white p-6 ring-1 ring-gray-200"
        aria-labelledby="getting-started-title"
      >
        <h2 id="getting-started-title" class="text-lg font-semibold text-gray-900">
          {{ t().modules.gettingStarted }}
        </h2>
        <ol class="mt-3 list-decimal space-y-2 ps-5 text-sm text-gray-700">
          <li><rich-text [text]="t().modules.steps.modules" /></li>
          <li><rich-text [text]="t().modules.steps.menus" /></li>
          <li><rich-text [text]="t().modules.steps.brand" /></li>
          <li><rich-text [text]="t().modules.steps.signIn" /></li>
        </ol>
      </section>
    </main>

    <app-footer class="border-t border-gray-200 bg-white" />
  `,
  host: { class: 'flex h-full flex-col overflow-y-auto bg-gray-50 dark:bg-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModulesPage {
  protected readonly menu = inject(MenuService);
  protected readonly showSettings = inject(LAYOUT_CONFIG).showSettings;
  private readonly session = inject(SessionService);
  protected readonly t = injectMessages(PAGES_MESSAGES);

  protected readonly firstName = computed(() => this.session.user()?.name.split(/\s+/)[0] ?? '');
}
