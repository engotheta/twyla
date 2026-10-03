import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { PageHeaderComponent } from '../../layout/page-header';

/**
 * A stand-in page: the page header (named from the route's `data.name`) and a "nothing here yet"
 * card listing the route's parameters. Swap the route's `loadComponent` for the real page.
 */
@Component({
  selector: 'placeholder-page',
  imports: [PageHeaderComponent, MatIcon],
  template: `
    <page-header [showBackBtn]="params().length > 0" [subtitle]="subtitle" />
    <section
      class="grid place-items-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-14 text-center"
      aria-labelledby="placeholder-title"
    >
      <mat-icon class="size-12! text-5xl! text-gray-400" aria-hidden="true">construction</mat-icon>
      <h2 id="placeholder-title" class="mt-3 text-lg font-semibold text-gray-900">
        Nothing here yet
      </h2>
      <p class="mt-1 max-w-md text-sm text-gray-600">
        This page is a placeholder. Give its route a real
        <code class="text-gray-800">loadComponent</code>
        to build it out.
      </p>
      @if (params().length) {
        <dl class="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
          @for (param of params(); track param.key) {
            <div class="flex gap-1.5">
              <dt class="text-gray-600">{{ param.key }}</dt>
              <dd class="font-medium text-gray-900">{{ param.value }}</dd>
            </div>
          }
        </dl>
      }
    </section>
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly subtitle: string | undefined = this.route.snapshot.data['subtitle'];

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly params = computed(() =>
    this.paramMap().keys.map((key) => ({ key, value: this.paramMap().get(key) ?? '' })),
  );
}
