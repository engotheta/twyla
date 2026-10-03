import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LAYOUT_CONFIG } from '../layout-config.token';
import { MenuIconComponent } from './menu-icon.component';
import { MenuService } from './menu.service';

const RAIL_LINK =
  'grid size-11 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 ' +
  'transition-colors hover:border-primary/40 hover:text-gray-900 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** GASCO's module column: "All modules", then one link per module the user may open. */
@Component({
  selector: 'module-rail',
  imports: [RouterLink, RouterLinkActive, MatIcon, MatTooltip, MenuIconComponent],
  template: `
    <nav
      aria-label="Modules"
      class="flex h-full flex-col items-center gap-3 overflow-y-auto px-2.5 py-3"
    >
      <a
        aria-label="All modules"
        matTooltip="All modules"
        matTooltipPosition="right"
        [class]="railLink"
        [routerLink]="homeUrl"
        routerLinkActive="border-primary! bg-primary! text-white!"
        ariaCurrentWhenActive="page"
      >
        <mat-icon aria-hidden="true">apps</mat-icon>
      </a>

      <span class="h-px w-7 bg-gray-300" aria-hidden="true"></span>

      <ul class="flex flex-col items-center gap-3">
        @for (module of menu.modules(); track module.id) {
          <li>
            <a
              [attr.aria-label]="module.name"
              [matTooltip]="module.name"
              matTooltipPosition="right"
              [class]="railLink"
              [routerLink]="module.link"
              routerLinkActive="border-primary! bg-primary! text-white!"
              [ariaCurrentWhenActive]="true"
            >
              <menu-icon [item]="module" />
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  host: { class: 'block h-full border-e border-gray-200 bg-gray-50' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleRailComponent {
  protected readonly menu = inject(MenuService);
  protected readonly homeUrl = inject(LAYOUT_CONFIG).homeUrl;
  protected readonly railLink = RAIL_LINK;
}
