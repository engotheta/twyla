import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeaderComponent } from '@layout/page-header';
import { injectMessages } from '@services/i18n';
import { SessionService } from '@services/session';
import { ACCOUNT_MESSAGES } from './account.messages';

/** The signed-in user, as the session API returned them. */
@Component({
  selector: 'profile-page',
  imports: [PageHeaderComponent],
  template: `
    @let text = t().profile;
    <page-header [subtitle]="text.subtitle" />
    @if (session.user(); as user) {
      <section
        class="flex flex-col gap-6 rounded-xl bg-white p-6 ring-1 ring-gray-200 sm:flex-row sm:items-start"
        [attr.aria-label]="text.label"
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
            <dt class="text-gray-600">{{ text.name }}</dt>
            <dd class="font-medium text-gray-900">{{ user.name }}</dd>
          </div>
          <div>
            <dt class="text-gray-600">{{ text.username }}</dt>
            <dd class="font-medium text-gray-900">{{ user.username ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-600">{{ text.email }}</dt>
            <dd class="font-medium text-gray-900">{{ user.email ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-600">{{ text.roles }}</dt>
            <dd class="font-medium text-gray-900">{{ user.roles?.join(', ') || '—' }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-gray-600">{{ text.permissions }}</dt>
            <dd class="font-medium text-gray-900">
              {{ user.permissions?.join(', ') || text.none }}
            </dd>
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
  protected readonly t = injectMessages(ACCOUNT_MESSAGES);
}
