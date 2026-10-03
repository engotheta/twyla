import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { LAYOUT_CONFIG } from '@layout';
import { SessionService } from '@services/session';

const FEATURES = [
  {
    icon: 'grid_on',
    title: 'Data grid',
    text: 'Local or server rows with sorting, filters, grouping, inline editing and export.',
  },
  {
    icon: 'dynamic_form',
    title: 'Config-driven forms',
    text: 'Fields, lists, steps and cross-field rules from one config — sign-in forms included.',
  },
  {
    icon: 'article',
    title: 'Details',
    text: 'Read-only records, grouped and formatted by type, with actions.',
  },
  {
    icon: 'preview',
    title: 'File viewer',
    text: 'PDF, Office, images, text and media from URLs, base64, blobs or streams.',
  },
  {
    icon: 'dashboard',
    title: 'Contents view',
    text: 'Tables, details and forms composed into tabbed, resizable views.',
  },
  {
    icon: 'space_dashboard',
    title: 'Layout & sessions',
    text: 'Modules, menus nested to any depth, page headers, sign-in, sign-up and password resets.',
  },
];

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
          Angular starter
        </p>
        <h1 class="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Build admin apps from parts that already work
        </h1>
        <p class="mt-4 max-w-xl text-lg text-gray-600">
          {{ brand.tagline }} Data grids, config-driven forms, a file viewer and a full app layout —
          accessible, signal-based, and ready to point at your API.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          @if (session.isAuthenticated()) {
            <a mat-flat-button [routerLink]="homeUrl">Open modules</a>
          } @else {
            <a mat-flat-button routerLink="/auth/register">Get started</a>
            <a mat-stroked-button routerLink="/auth/login">Sign in</a>
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
      <h2 id="features-title" class="text-2xl font-semibold text-gray-900">What's inside</h2>
      <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (feature of features; track feature.title) {
          <li class="rounded-xl bg-white p-5 ring-1 ring-gray-200">
            <span class="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <mat-icon aria-hidden="true">{{ feature.icon }}</mat-icon>
            </span>
            <h3 class="mt-3 font-semibold text-gray-900">{{ feature.title }}</h3>
            <p class="mt-1 text-sm text-gray-600">{{ feature.text }}</p>
          </li>
        }
      </ul>
    </section>

    <section
      class="mx-auto my-8 flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 rounded-2xl bg-primary px-6 py-8 text-white sm:px-10"
      aria-labelledby="cta-title"
    >
      <div>
        <h2 id="cta-title" class="text-2xl font-semibold">Ready when you are</h2>
        <p class="mt-1">Sign in with the demo account and open the modules.</p>
      </div>
      <a
        class="inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        [routerLink]="session.isAuthenticated() ? homeUrl : '/auth/login'"
      >
        {{ session.isAuthenticated() ? 'Open modules' : 'Sign in' }}
      </a>
    </section>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  protected readonly session = inject(SessionService);
  protected readonly brand = inject(LAYOUT_CONFIG).brand;
  protected readonly homeUrl = inject(LAYOUT_CONFIG).homeUrl;
  protected readonly features = FEATURES;
}
