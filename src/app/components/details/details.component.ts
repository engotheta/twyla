import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TabNavClasses } from '@components/tab-nav/tab-nav.interface';
import { TabPanelsComponent } from '@components/tab-nav/tab-panels.component';
import { injectMessages } from '@services/i18n/message-bundle';
import { registerShortcuts } from '@services/shortcuts/shortcuts.service';
import { DetailsHeaderComponent } from './details-header/details-header.component';
import { DETAILS_MESSAGES } from './details.messages';
import { DETAILS_SCOPE, detailsShortcuts } from './details.shortcuts';
import { FieldGroupComponent } from './field-group/field-group.component';
import { DetailsParameter } from './interfaces/details.interface';
import { resolveDetailGroups, toObservableSource } from './helpers/details.helpers';
import { groupTabs } from './helpers/field-group.helpers';
import { MergeClassesPipe } from '@utils/pipes/merge-classes.pipe';

/**
 * Renders a resolved `DetailsParameter` (`[params]`). To show it in a dialog, host it with
 * `ViewService` — `view.openModal(DetailsComponent, params, '640px')` or
 * `view.open(DetailsComponent, { title, inputs: { params } })` — whose shell supplies the title
 * bar, so this component has no dialog mode of its own.
 */
@Component({
  selector: 'all-details',
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss',
  imports: [
    MatProgressBarModule,
    TabPanelsComponent,
    DetailsHeaderComponent,
    FieldGroupComponent,
    MergeClassesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsComponent<Entity = Record<string, unknown>> {
  readonly params = input<DetailsParameter<Entity>>();

  protected readonly t = injectMessages(DETAILS_MESSAGES);

  /** what the component's shortcuts switched, laid over the params while it is on screen */
  private readonly overrides = signal<Partial<DetailsParameter<Entity>>>({});

  protected readonly resolvedParameter = computed<DetailsParameter<Entity>>(() => ({
    ...this.params(),
    ...this.overrides(),
  }));

  // a DEDICATED computed the fetch effect depends on, not `resolvedParameter()` directly — a
  // fresh `DetailsParameter` object reference (e.g. an inline literal on `[parameter]`) must not
  // refetch when `fetchFn` itself is referentially stable (mirrors `GridEngineService`'s
  // `dataSourceParams` dedup for the same reason, grid-engine.service.ts).
  private readonly fetchFn = computed(() => this.resolvedParameter().fetchFn);
  private readonly fetchedEntity = signal<Entity | undefined>(undefined);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(undefined);

  constructor() {
    // D, six times in a quick run, lists the shortcuts: a layout per digit, and what is shown
    registerShortcuts(
      DETAILS_SCOPE,
      () =>
        detailsShortcuts(
          {
            params: this.resolvedParameter,
            overrides: this.overrides,
            override: (patch) =>
              this.overrides.update((current) => ({
                ...current,
                ...(patch as Partial<DetailsParameter<Entity>>),
              })),
            reset: () => this.overrides.set({}),
            groupCount: () => this.fieldGroups().length,
          },
          this.t,
        ),
      {
        label: () => this.t().shortcuts.scope,
        name: () => this.resolvedParameter().header?.title,
        enabled: () => this.params()?.shortcuts !== false,
      },
    );

    effect((onCleanup) => {
      const fn = this.fetchFn();
      if (!fn) {
        // a param swap away from fetchFn must drop stale fetched data, not just skip re-fetching
        this.fetchedEntity.set(undefined);
        this.loading.set(false);
        this.error.set(undefined);
        return;
      }
      this.loading.set(true);
      this.error.set(undefined);
      const sub = toObservableSource(fn()).subscribe({
        next: (entity) => {
          this.fetchedEntity.set(entity);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err);
          this.loading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** `fetchedEntity` once resolved; falls back to a static `entity` (if provided) while loading
   *  or when no `fetchFn` is set at all — e.g. a skeleton/cached value. */
  protected readonly resolvedEntity = computed<Entity | undefined>(
    () => this.fetchedEntity() ?? this.resolvedParameter().entity,
  );

  // every dynamic (icon/class/tooltip/etc.) resolver in field-group.component.ts reads its data
  // off the parameter's `entity` too — routing everything through ONE combined parameter (rather
  // than only swapping `entity` into `fieldGroups` below) keeps those resolvers in sync with a
  // fetched entity as well, not just the field VALUES.
  protected readonly effectiveParameter = computed<DetailsParameter<Entity>>(() => ({
    ...this.resolvedParameter(),
    entity: this.resolvedEntity(),
  }));

  protected readonly fieldGroups = computed(() => resolveDetailGroups(this.effectiveParameter()));

  /** the groups as tabs (`showGroupsInTabs`) */
  protected readonly groupTabs = computed(() => groupTabs(this.fieldGroups(), this.t().group));

  /** `tabsContainerClass` and its three companions, as `tab-nav` takes them */
  protected readonly tabsClasses = computed<TabNavClasses>(() => {
    const p = this.resolvedParameter();
    return {
      container: p.tabsContainerClass,
      tab: p.tabClass,
      activeTab: p.activeTabClass,
      indicator: p.tabIndicatorClass,
    };
  });

  protected readonly showHeader = computed(() => {
    const header = this.resolvedParameter().header;
    return header?.show !== false && !!header?.title;
  });
}
