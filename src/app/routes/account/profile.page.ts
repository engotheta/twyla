import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeaderComponent } from '@layout/page-header';
import { SessionService } from '@services/session';

/** The signed-in user, as the session API returned them. */
@Component({
  selector: 'profile-page',
  imports: [PageHeaderComponent],
  template: `
    <page-header subtitle="Who you're signed in as" />
    @if (session.user(); as user) {
      <section
        class="flex flex-col gap-6 rounded-xl bg-white p-6 ring-1 ring-gray-200 sm:flex-row sm:items-start"
        aria-label="Profile"
      >
        @if (user.avatar) {
          <img
            class="size-24 shrink-0 rounded-full bg-gray-100 object-cover"
            alt=""
            width="96"
            height="96"
            [src]="user.avatar"
          />
        }
        <dl class="grid flex-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-gray-600">Name</dt>
            <dd class="font-medium text-gray-900">{{ user.name }}</dd>
          </div>
          <div>
            <dt class="text-gray-600">Username</dt>
            <dd class="font-medium text-gray-900">{{ user.username ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-600">Email</dt>
            <dd class="font-medium text-gray-900">{{ user.email ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-600">Roles</dt>
            <dd class="font-medium text-gray-900">{{ user.roles?.join(', ') || '—' }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-gray-600">Permissions</dt>
            <dd class="font-medium text-gray-900">{{ user.permissions?.join(', ') || 'none' }}</dd>
          </div>
        </dl>
      </section>
    }
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly session = inject(SessionService);
}
