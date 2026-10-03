import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { LAYOUT_CONFIG } from '../../layout';

@Component({
  selector: 'not-found-page',
  imports: [RouterLink, MatButton],
  template: `
    <main class="max-w-md text-center">
      <p class="text-sm font-semibold text-blue-700">404</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">Page not found</h1>
      <p class="mt-3 text-gray-600">The page you're looking for doesn't exist, or it has moved.</p>
      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <a mat-flat-button routerLink="/home">Go home</a>
        <a mat-stroked-button [routerLink]="homeUrl">All modules</a>
      </div>
    </main>
  `,
  host: { class: 'grid h-full place-items-center overflow-y-auto bg-gray-50 px-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  protected readonly homeUrl = inject(LAYOUT_CONFIG).homeUrl;
}
