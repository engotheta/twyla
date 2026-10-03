import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppFooterComponent } from '../../layout';
import { AuthHeaderComponent } from './auth-header.component';

/**
 * The public pages' layout (GASCO's AuthLayout): the auth header over a quiet decorated
 * background, the page, the footer — all in one scroll area (the document itself never scrolls).
 */
@Component({
  selector: 'auth-layout',
  imports: [RouterOutlet, AuthHeaderComponent, AppFooterComponent],
  template: `
    <div class="relative isolate flex min-h-full flex-col">
      <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          class="absolute -end-48 -top-48 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(37_99_235/0.16),transparent_70%)]"
        ></div>
        <div
          class="absolute -start-40 -bottom-40 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(14_165_233/0.12),transparent_70%)]"
        ></div>
        <div
          class="absolute inset-0 [background-image:radial-gradient(rgb(37_99_235/0.08)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_40%,black,transparent)] [background-size:26px_26px]"
        ></div>
      </div>

      <auth-header />
      <main class="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-10">
        <router-outlet />
      </main>
      <app-footer class="mx-auto w-full max-w-7xl" />
    </div>
  `,
  host: { class: 'block h-full overflow-y-auto bg-gray-50' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {}
