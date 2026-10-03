import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let nextId = 0;

/** The session pages' card: the page's `<h1>`, a lead line, then the page's content. */
@Component({
  selector: 'auth-card',
  template: `
    <section
      class="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8"
      [attr.aria-labelledby]="headingId"
    >
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900" [id]="headingId">
        {{ heading() }}
      </h1>
      @if (lead()) {
        <p class="mt-1 text-sm text-gray-600">{{ lead() }}</p>
      }
      <div class="mt-6">
        <ng-content />
      </div>
    </section>
  `,
  host: { class: 'flex flex-1 items-start justify-center sm:items-center' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCardComponent {
  readonly heading = input.required<string>();
  readonly lead = input<string>();

  protected readonly headingId = `auth-card-${nextId++}`;
}
