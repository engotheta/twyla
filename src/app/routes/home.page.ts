import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { LAYOUT_CONFIG } from '@layout';
import { injectMessages } from '@services/i18n';
import { SessionService } from '@services/session';
import { PAGES_MESSAGES } from './pages.messages';

/** the "What's inside" cards: an icon for each entry of the page's `features` text */
const FEATURES = [
  { key: 'grid', icon: 'grid_on' },
  { key: 'forms', icon: 'dynamic_form' },
  { key: 'details', icon: 'article' },
  { key: 'viewer', icon: 'preview' },
  { key: 'contents', icon: 'dashboard' },
  { key: 'layout', icon: 'space_dashboard' },
] as const;

/** The public landing page (inside the auth layout). */
@Component({
  selector: 'home-page',
  imports: [RouterLink, MatButton, MatIcon],
  template: `
    <section class="mx-auto grid w-full max-w-7xl items-center gap-12 py-8 lg:grid-cols-2 lg:py-16">
      <div>
        <p
          class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-800 uppercase"
        >
          <span class="size-1.5 rounded-full bg-primary" aria-hidden="true"></span>
          {{ t().home.eyebrow }}
        </p>
        <h1 class="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          {{ t().home.heading }}
        </h1>
        <p class="mt-4 max-w-xl text-lg text-gray-600">{{ tagline() }} {{ t().home.lead }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          @if (session.isAuthenticated()) {
            <a mat-flat-button [routerLink]="homeUrl">{{ t().home.openModules }}</a>
          } @else {
            <a mat-flat-button routerLink="/auth/register">{{ t().home.getStarted }}</a>
            <a mat-stroked-button routerLink="/auth/login">{{ t().home.signIn }}</a>
          }
        </div>
      </div>

      <!-- a sketch of the signed-in layout -->
      <div
        class="hidden overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 sm:block"
        aria-hidden="true"
      >
        <div class="flex h-80">
          <div
            class="flex w-14 flex-col items-center gap-3 border-e border-gray-200 bg-gray-50 py-4"
          >
            <span class="size-8 rounded-lg bg-primary"></span>
            <span class="size-8 rounded-lg bg-gray-200"></span>
            <span class="size-8 rounded-lg bg-gray-200"></span>
          </div>
          <div class="flex w-44 flex-col gap-2 border-e border-gray-200 p-4">
            <span class="mb-2 h-8 rounded-lg bg-gray-100"></span>
            <span class="h-3 w-28 rounded bg-gray-200"></span>
            <span class="h-3 w-20 rounded bg-primary/40"></span>
            <span class="ms-3 h-3 w-24 rounded bg-gray-200"></span>
            <span class="ms-3 h-3 w-16 rounded bg-gray-200"></span>
            <span class="h-3 w-24 rounded bg-gray-200"></span>
          </div>
          <div class="flex flex-1 flex-col bg-gray-50">
            <div class="h-12 border-b border-gray-200 bg-white"></div>
            <div class="grid flex-1 grid-cols-2 gap-3 p-4">
              <span class="col-span-2 h-12 rounded-xl bg-white ring-1 ring-gray-200"></span>
              <span class="rounded-xl bg-white ring-1 ring-gray-200"></span>
              <span class="rounded-xl bg-white ring-1 ring-gray-200"></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto w-full max-w-7xl py-8" aria-labelledby="features-title">
      <h2 id="features-title" class="text-2xl font-semibold text-gray-900">
        {{ t().home.featuresHeading }}
      </h2>
      <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (feature of features; track feature.key) {
          @let text = t().home.features[feature.key];
          <li class="rounded-xl bg-white p-5 ring-1 ring-gray-200">
            <span class="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <mat-icon aria-hidden="true">{{ feature.icon }}</mat-icon>
            </span>
            <h3 class="mt-3 font-semibold text-gray-900">{{ text.title }}</h3>
            <p class="mt-1 text-sm text-gray-600">{{ text.text }}</p>
          </li>
        }
      </ul>
    </section>

    <section
      class="mx-auto my-8 flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary px-6 py-8 text-white sm:px-10"
      aria-labelledby="cta-title"
    >
      <div>
        <h2 id="cta-title" class="text-2xl font-semibold">{{ t().home.ctaHeading }}</h2>
        <p class="mt-1">{{ t().home.ctaText }}</p>
      </div>
      <a
        class="inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        [routerLink]="session.isAuthenticated() ? homeUrl : '/auth/login'"
      >
        {{ session.isAuthenticated() ? t().home.openModules : t().home.signIn }}
      </a>
    </section>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly session = inject(SessionService);
  private readonly layout = inject(LAYOUT_CONFIG);
  protected readonly t = injectMessages(PAGES_MESSAGES);
  protected readonly homeUrl = this.layout.homeUrl;
  protected readonly features = FEATURES;

  /** the brand's tagline is the app's own text: the layout config says how to translate it */
  protected readonly tagline = computed(() => {
    const tagline = this.layout.brand.tagline;
    return tagline ? this.layout.translate(tagline) : '';
  });
}
