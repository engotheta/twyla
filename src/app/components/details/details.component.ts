import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { DetailsHeaderComponent } from './details-header/details-header.component';
import { FieldGroupComponent } from './field/field-group/field-group.component';
import { DetailsDialogData, DetailsParameter } from './detail.interface';
import { resolveDetailGroups, toObservableSource } from './detail.helpers';
import { MergeClassesPipe } from './util/class-name/merge-classes.pipe';

/**
 * Renders a resolved `DetailsParameter` — as a plain embeddable component (`[parameter]`), or as
 * a dialog (`dialog.open(DetailsComponent, { data: {...} })`, matching `DetailsDialogData`).
 * Detects dialog mode via `MAT_DIALOG_DATA` and adds its own dialog chrome (title/close button)
 * only when opened that way — mirrors `FieldGroupComponent`'s own dual-mode pattern.
 */
@Component({
  selector: 'all-details',
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatDialogModule,
    MatIcon,
    MatProgressBarModule,
    MatTabsModule,
    DetailsHeaderComponent,
    FieldGroupComponent,
    MergeClassesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsComponent<Entity = Record<string, unknown>> {
  readonly parameter = input<DetailsParameter<Entity>>();

  // Set only when this instance was created via `dialog.open(DetailsComponent, { data })` instead
  // of being used as a normal embedded component.
  protected dialogData = inject<DetailsDialogData<Entity>>(MAT_DIALOG_DATA, { optional: true });

  protected readonly dialogRef = inject(MatDialogRef<DetailsComponent<Entity>>, { optional: true });

  protected readonly resolvedParameter = computed<DetailsParameter<Entity>>(
    () => this.dialogData ?? this.parameter() ?? {},
  );

  // a DEDICATED computed the fetch effect depends on, not `resolvedParameter()` directly — a
  // fresh `DetailsParameter` object reference (e.g. an inline literal on `[parameter]`) must not
  // refetch when `fetchFn` itself is referentially stable (mirrors `GridEngineService`'s
  // `dataSourceParams` dedup for the same reason, grid-engine.service.ts).
  private readonly fetchFn = computed(() => this.resolvedParameter().fetchFn);
  private readonly fetchedEntity = signal<Entity | undefined>(undefined);
  protected readonly loading = signal(false);
  protected readonly error = signal<unknown>(undefined);

  constructor() {
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

  protected readonly showHeader = computed(() => {
    const header = this.resolvedParameter().header;
    return header?.show !== false && !!header?.title;
  });
}
