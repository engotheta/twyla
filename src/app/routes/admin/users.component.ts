import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../layout/page-header';

const USERS = [
  { id: 1, name: 'Emily Johnson', email: 'emily.johnson@example.com', role: 'Administrator' },
  { id: 2, name: 'Michael Williams', email: 'michael.williams@example.com', role: 'Editor' },
  { id: 3, name: 'Sophia Brown', email: 'sophia.brown@example.com', role: 'Viewer' },
];

/** A list whose rows open `users/:userId` — a detail route matched with `matchRoute`. */
@Component({
  selector: 'admin-users',
  imports: [PageHeaderComponent, RouterLink],
  template: `
    <page-header
      subtitle="Detail pages aren't in the menu; their breadcrumbs still find their way"
    />
    <div class="overflow-x-auto rounded-xl bg-white ring-1 ring-gray-200">
      <table class="w-full text-start text-sm">
        <caption class="sr-only">
          Users
        </caption>
        <thead class="border-b border-gray-200 bg-gray-50 text-xs text-gray-600 uppercase">
          <tr>
            <th scope="col" class="px-4 py-3 text-start font-semibold">Name</th>
            <th scope="col" class="px-4 py-3 text-start font-semibold">Email</th>
            <th scope="col" class="px-4 py-3 text-start font-semibold">Role</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          @for (user of users; track user.id) {
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <a
                  class="font-medium text-blue-700 underline-offset-2 hover:underline"
                  [routerLink]="[user.id]"
                >
                  {{ user.name }}
                </a>
              </td>
              <td class="px-4 py-3 text-gray-700">{{ user.email }}</td>
              <td class="px-4 py-3 text-gray-700">{{ user.role }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent {
  protected readonly users = USERS;
}
