import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectMessages } from '@services/i18n/message-bundle';
import { LAYOUT_CONFIG } from './layout-config.token';
import { LAYOUT_MESSAGES } from './layout.messages';

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
            >{{ footer.owner }}<span class="sr-only"> {{ t().newTab }}</span></a
          ><span>. {{ t().footer.rights }}</span>
        } @else {
          <span>{{ footer.owner }}. {{ t().footer.rights }}</span>
        }
      </p>

      @if (footer.links.length || footer.version) {
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          @if (footer.links.length) {
            <nav [attr.aria-label]="t().footer.links">
              <ul class="flex flex-wrap gap-x-4 gap-y-1">
                @for (link of footer.links; track link.label) {
                  <li>
                    @if (link.route) {
                      <a
                        class="underline-offset-2 hover:text-gray-900 hover:underline"
                        [routerLink]="link.route"
                      >
                        {{ translate(link.label) }}
                      </a>
                    } @else {
                      <a
                        class="underline-offset-2 hover:text-gray-900 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        [href]="link.href"
                      >
                        {{ translate(link.label) }}<span class="sr-only"> {{ t().newTab }}</span>
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
  protected readonly translate = inject(LAYOUT_CONFIG).translate;
  protected readonly t = injectMessages(LAYOUT_MESSAGES);
  protected readonly year = new Date().getFullYear();
}
