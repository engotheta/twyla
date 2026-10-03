import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAYOUT_CONFIG } from './layout-config.token';

/** © year and owner, the footer links, the version. */
@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer
      class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 text-xs text-gray-600"
    >
      <p>
        © {{ year }}
        @if (footer.ownerUrl) {
          <a
            class="font-medium text-gray-700 underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
            [href]="footer.ownerUrl"
            >{{ footer.owner }}<span class="sr-only"> (opens in a new tab)</span></a
          ><span>. All rights reserved.</span>
        } @else {
          <span>{{ footer.owner }}. All rights reserved.</span>
        }
      </p>

      @if (footer.links.length || footer.version) {
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          @if (footer.links.length) {
            <nav aria-label="Footer">
              <ul class="flex flex-wrap gap-x-4 gap-y-1">
                @for (link of footer.links; track link.label) {
                  <li>
                    @if (link.route) {
                      <a
                        class="underline-offset-2 hover:text-gray-900 hover:underline"
                        [routerLink]="link.route"
                      >
                        {{ link.label }}
                      </a>
                    } @else {
                      <a
                        class="underline-offset-2 hover:text-gray-900 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        [href]="link.href"
                      >
                        {{ link.label }}<span class="sr-only"> (opens in a new tab)</span>
                      </a>
                    }
                  </li>
                }
              </ul>
            </nav>
          }
          @if (footer.version) {
            <span>v{{ footer.version }}</span>
          }
        </div>
      }
    </footer>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFooterComponent {
  protected readonly footer = inject(LAYOUT_CONFIG).footer;
  protected readonly year = new Date().getFullYear();
}
