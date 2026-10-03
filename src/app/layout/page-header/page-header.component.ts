import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { ActionButton } from '@components/action-buttons/action-button.interface';
import { ActionButtonsComponent } from '@components/action-buttons/action-buttons.component';
import { LAYOUT_CONFIG } from '../layout-config.token';
import { urlPath } from '../menu/menu.helpers';
import { MenuService } from '../menu/menu.service';
import { pageName } from '../page-title.strategy';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { Breadcrumb, PageHeaderParameter, PageHeaderToggle } from './page-header.interface';

/**
 * A page's heading block (GASCO's page-header): the `<h1>`, breadcrumbs, an optional Back
 * button and icon, then the page's toggles and action buttons, plus anything projected (filters,
 * search). Takes a `params` object or the same props as inputs; inputs win.
 */
@Component({
  selector: 'page-header',
  imports: [
    MatIcon,
    MatIconButton,
    MatTooltip,
    MatButtonToggleGroup,
    MatButtonToggle,
    ActionButtonsComponent,
    BreadcrumbsComponent,
  ],
  template: `
    <div
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl bg-white px-4 py-3 ring-1 ring-gray-200 {{
        boxClass()
      }}"
    >
      <div class="flex min-w-0 items-center gap-3">
        @if (showBackBtn_()) {
          <button
            mat-icon-button
            type="button"
            aria-label="Back"
            matTooltip="Back"
            class="shrink-0"
            (click)="goBack()"
          >
            <mat-icon aria-hidden="true">arrow_back</mat-icon>
          </button>
        }
        @if (icon_(); as icon) {
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
          >
            <mat-icon aria-hidden="true">{{ icon }}</mat-icon>
          </span>
        }
        <div class="min-w-0">
          @if (crumbs().length > 1) {
            <breadcrumbs class="mb-0.5 block" [items]="crumbs()" [label]="crumbsLabel()" />
          }
          @if (headingLevel_() === 1) {
            <h1 class="truncate text-xl font-semibold text-gray-900">{{ title_() }}</h1>
          } @else {
            <h2 class="truncate text-lg font-semibold text-gray-900">{{ title_() }}</h2>
          }
          @if (subtitle_(); as subtitle) {
            <p class="text-sm text-gray-600">{{ subtitle }}</p>
          }
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <ng-content />
        @if (toggles().length) {
          <mat-button-toggle-group
            hideSingleSelectionIndicator
            [attr.aria-label]="toggleLabel_()"
            [value]="value_()"
            (change)="onToggle($event.value)"
          >
            @for (toggle of toggles(); track $index) {
              <mat-button-toggle [value]="toggle.value" [disabled]="toggle.disabled ?? false">
                @if (toggle.icon) {
                  <mat-icon class="me-1 align-middle" aria-hidden="true">{{
                    toggle.icon
                  }}</mat-icon>
                }
                {{ toggle.label }}
              </mat-button-toggle>
            }
          </mat-button-toggle-group>
        }
        @if (actions().length) {
          <action-buttons [buttons]="actions()" [data]="data_()" />
        }
      </div>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent<D = unknown> {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly menu = inject(MenuService);
  private readonly homeUrl = inject(LAYOUT_CONFIG).homeUrl;

  readonly params = input<PageHeaderParameter<D>>();
  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
  readonly nav = input<(string | Breadcrumb)[]>();
  readonly showBreadcrumb = input<boolean>();
  readonly showBackBtn = input<boolean>();
  readonly goBackUrl = input<string>();
  readonly data = input<D>();
  readonly actionButtons = input<ActionButton<D>[]>();
  readonly toggleButtons = input<PageHeaderToggle[]>();
  readonly value = input<unknown>();
  readonly toggleLabel = input<string>();
  readonly headingLevel = input<1 | 2>();

  /** the picked toggle's value */
  readonly toggleValue = output<unknown>();
  /** the picked toggle */
  readonly toggleOption = output<PageHeaderToggle>();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** the current route's menu name / title, re-read on each navigation */
  private readonly routeName = computed(() => {
    this.url();
    return pageName(this.router.routerState.snapshot.root);
  });

  protected readonly title_ = computed(
    () => this.title() ?? this.params()?.title ?? this.routeName() ?? '',
  );
  protected readonly subtitle_ = computed(() => this.subtitle() ?? this.params()?.subtitle);
  protected readonly icon_ = computed(() => this.icon() ?? this.params()?.icon);
  protected readonly showBackBtn_ = computed(
    () => this.showBackBtn() ?? this.params()?.showBackBtn ?? false,
  );
  private readonly goBackUrl_ = computed(() => this.goBackUrl() ?? this.params()?.goBackUrl);
  protected readonly data_ = computed(() => this.data() ?? this.params()?.data);
  protected readonly actions = computed(
    () => this.actionButtons() ?? this.params()?.actionButtons ?? [],
  );
  protected readonly toggles = computed(
    () => this.toggleButtons() ?? this.params()?.toggleButtons ?? [],
  );
  protected readonly value_ = computed(() => this.value() ?? this.params()?.value);
  protected readonly toggleLabel_ = computed(
    () => this.toggleLabel() ?? this.params()?.toggleLabel ?? 'View',
  );
  protected readonly boxClass = computed(() => this.params()?.class ?? '');
  protected readonly headingLevel_ = computed(
    () => this.headingLevel() ?? this.params()?.headingLevel ?? 1,
  );

  /** the page's own trail is "Breadcrumb"; a section header's names its section */
  protected readonly crumbsLabel = computed(() =>
    this.headingLevel_() === 1 ? 'Breadcrumb' : `${this.title_()} breadcrumb`,
  );

  /** explicit `nav`, else module › groups › page from the side menu (a detail page under its list) */
  protected readonly crumbs = computed<Breadcrumb[]>(() => {
    if (!(this.showBreadcrumb() ?? this.params()?.showBreadcrumb ?? true)) return [];
    const nav = this.nav() ?? this.params()?.nav;
    if (nav) return nav.map((crumb) => (typeof crumb === 'string' ? { label: crumb } : crumb));

    const module = this.menu.module();
    const trail = this.menu.trail();
    const crumbs: Breadcrumb[] = module ? [{ label: module.name, route: module.link }] : [];
    for (const node of trail) {
      crumbs.push({ label: node.name, route: node.type === 'link' ? node.link : undefined });
    }
    const last = trail.at(-1);
    if (last && last.link !== urlPath(this.url())) crumbs.push({ label: this.title_() });
    return crumbs;
  });

  protected goBack(): void {
    const target = this.goBackUrl_();
    if (target) {
      void this.router.navigateByUrl(target);
    } else if (this.hasInAppHistory()) {
      this.location.back();
    } else {
      // opened directly: go up to the list a detail page belongs to, else home
      const listLink = this.menu.trail().at(-1)?.link;
      const here = urlPath(this.url());
      void this.router.navigateByUrl(listLink && listLink !== here ? listLink : this.homeUrl);
    }
  }

  protected onToggle(value: unknown): void {
    this.toggleValue.emit(value);
    const option = this.toggles().find((toggle) => toggle.value === value);
    if (option) this.toggleOption.emit(option);
  }

  /** the router numbers its history entries; anything past the first came from in-app navigation */
  private hasInAppHistory(): boolean {
    const id = (this.location.getState() as { navigationId?: unknown } | null)?.navigationId;
    return typeof id === 'number' && id > 1;
  }
}
