import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { DataGridComponent } from '../components/data-grid';
import { FetchService } from '../services/fetch';
import { LoadingOverlayDirective } from '../services/loading';
import { DummyUser, DummyUsersResponse, getGridParameterFetch } from './data-grid-fetch';

/**
 * Exercises FetchService, the loading overlay and toasts against dummyjson.com: a cached read
 * with a class-targeted overlay, a write that toasts, a failing call that retries then toasts,
 * a template-driven `[loadingOverlay]`, and the FetchService-backed grid.
 */
@Component({
  selector: 'fetch-demo',
  imports: [MatButton, DataGridComponent, LoadingOverlayDirective],
  template: `
    <section class="flex h-full flex-col gap-3" aria-labelledby="fetch-demo-title">
      <div class="flex flex-wrap items-center gap-2 rounded-lg bg-white p-4">
        <h2 id="fetch-demo-title" class="me-auto text-base font-medium">Fetch, loading & toasts</h2>
        <button mat-flat-button type="button" class="btn" (click)="loadUsers()">Load users</button>
        <button mat-stroked-button type="button" (click)="addUser()">Add user</button>
        <button mat-stroked-button type="button" (click)="failingRequest()">Failing request</button>
        <button
          mat-stroked-button
          type="button"
          [attr.aria-pressed]="overlay()"
          (click)="overlay.set(!overlay())"
        >
          Toggle overlay
        </button>
      </div>

      <div class="users-card rounded-lg bg-white p-4" [loadingOverlay]="overlay()">
        <p class="text-sm text-gray-700">{{ status() }}</p>
        <ul class="mt-2 grid gap-1 sm:grid-cols-2">
          @for (user of users() ?? []; track user.id) {
            <li>{{ user.firstName }} {{ user.lastName }} — {{ user.email }}</li>
          } @empty {
            <li class="text-gray-600">No users loaded yet.</li>
          }
        </ul>
      </div>

      <div class="grow min-h-0">
        <data-grid [params]="gridParameter" />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FetchDemoComponent {
  private readonly api = inject(FetchService);

  protected readonly gridParameter = getGridParameterFetch();
  protected readonly users = signal<DummyUser[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly overlay = signal(false);
  protected readonly status = computed(() =>
    this.loading() ? 'Loading users…' : `${this.users()?.length ?? 0} users loaded`,
  );

  /** Cached for 30 s: a second click inside that window makes no request and shows no overlay. */
  protected loadUsers(): void {
    void this.api.fetch({
      url: 'users',
      method: 'GET',
      variables: { limit: 6, select: 'firstName,lastName,email' },
      resFn: (res: DummyUsersResponse) => res.users,
      data: this.users,
      loading: { on: ['users-card', 'btn'], signal: this.loading },
      cache: { policy: 'cache-first', ttl: 30_000 },
    });
  }

  /** A write: POST by default (variables given), toasts on success, double clicks are ignored. */
  protected async addUser(): Promise<void> {
    let x = await this.api.fetch({
      fieldSelection: ['name', 'continent {code}'],
      loading: { on: 'users-card' },
      query: `query {
        countries{
          capital
          name
          continent{
          name
          code
          }
        }
      }
      `,
    });

    console.log(x);

    void this.api.fetch({
      url: 'users/add',
      variables: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
      successMessage: (user: DummyUser) => `Added ${user.firstName} ${user.lastName} (#${user.id})`,
      loading: { on: 'users-card' },
      concurrency: 'exhaust',
    });
  }

  /** A 500: retried once, then reported with the server's own message. */
  protected failingRequest(): void {
    void this.api.fetch({ url: 'http/500/Simulated server error', retry: 1 });
  }
}
