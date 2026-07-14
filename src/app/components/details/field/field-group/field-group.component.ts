import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ArrayConfig, FieldConfig, FieldGroupConfig } from '../../detail.interface';
import { ActionButtonsComponent } from '../../../action-buttons/action-buttons.component';
import { resolveDynamicValue$ } from '../../../action-buttons/dynamic-value.util';
import { DataTableComponent } from '../../../data-table/data-table.component';
import { BgIconMarkComponent } from '../../bg-icon-mark/bg-icon-mark.component';
import { mergeClasses } from '../../util/class-name/class-name.helpers';
import { MergeClassesPipe } from '../../util/class-name/merge-classes.pipe';
import { FieldValueComponent } from '../field-value/field-value.component';
import { FieldGroupData } from '../field-group.interface';
import { FieldData, FieldLayout, FieldType } from '../field.interface';
import { getFieldType } from '../fields.helper';
import {
  DEFAULT_PAGE_SIZE,
  LAYOUT_PRESETS,
  mergeArrayConfig,
  mergeFieldConfig,
} from './field-group.constants';
import {
  FieldGroupDialogData,
  FieldGroupParameter,
  FieldRow,
  FieldRowViewModel,
  DEFAULT_VIEW_MODEL,
} from './field-group.interface';

/**
 * Renders a resolved `FieldGroupData` — as a plain embeddable component (bind `[group]`
 * and friends, or a single `[parameter]` bundling them — handy when recursing, see
 * `childParameter`), or as a dialog (`dialog.open(FieldGroupComponent, { data: {...} })`,
 * matching `FieldGroupDialogData`). It detects dialog mode via `MAT_DIALOG_DATA` and adds its
 * own dialog chrome (title/close button) only when opened that way.
 *
 * Resolution priority for every setting: dialog data > `parameter` > the individual `@Input`.
 */
@Component({
  selector: 'field-group',
  templateUrl: './field-group.component.html',
  styleUrl: './field-group.component.scss',
  imports: [
    NgTemplateOutlet,
    MatIcon,
    MatPaginatorModule,
    MatTabsModule,
    MatTooltipModule,
    MatButtonModule,
    MatDialogModule,
    ActionButtonsComponent,
    DataTableComponent,
    BgIconMarkComponent,
    MergeClassesPipe,
    FieldValueComponent,
    FieldGroupComponent,
    CommonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldGroupComponent<D = unknown> {
  /** Accepts either a full parameter object, or the individual props below. */
  readonly parameter = input<FieldGroupParameter<D>>();

  readonly group = input<FieldGroupData>();
  readonly layout = input<FieldLayout>('list');
  readonly data = input<D>();
  readonly animation = input<string>();

  readonly isArrayItem = input<boolean>(false);
  /** Only meaningful when `isArrayItem` — starts the card expanded instead of collapsed. */
  readonly expanded = input<boolean>(false);
  readonly fieldConfig = input<FieldConfig>();
  readonly groupConfig = input<FieldGroupConfig>();
  readonly arrayConfig = input<ArrayConfig>();

  readonly showBgIconMark = input(false);
  readonly showGroupsInTabs = input(false);

  private readonly dialog = inject(MatDialog);

  // Set only when this instance was created via `dialog.open(FieldGroupComponent, { data })`
  // instead of being used as a normal embedded component.
  protected dialogData = inject<FieldGroupDialogData<D>>(MAT_DIALOG_DATA, { optional: true });
  protected readonly dialogRef = inject(MatDialogRef<FieldGroupComponent<D>>, { optional: true });

  protected readonly resolvedGroup = computed(
    () => this.dialogData?.group ?? this.parameter()?.group ?? this.group() ?? {},
  );

  protected readonly resolvedLayout = computed(
    () => this.dialogData?.layout ?? this.parameter()?.layout ?? this.layout(),
  );

  protected readonly resolvedData = computed(
    () => this.dialogData?.data ?? this.parameter()?.data ?? this.data(),
  );

  protected readonly resolvedAnimation = computed(
    () => this.dialogData?.animation ?? this.parameter()?.animation ?? this.animation(),
  );

  protected readonly resolvedIsArrayItem = computed(
    () => this.dialogData?.isArrayItem ?? this.parameter()?.isArrayItem ?? this.isArrayItem(),
  );

  private readonly resolvedExpanded = computed(
    () => this.dialogData?.expanded ?? this.parameter()?.expanded ?? this.expanded(),
  );

  // Only the *initial* state comes from `resolvedExpanded` — once open, a manual toggle
  // shouldn't get clobbered if the parent happens to re-render with the same input.
  protected readonly isOpen = signal(this.resolvedExpanded());
  protected readonly bodyId = `field-group-body-${Math.random().toString(36).slice(2)}`;

  // The caller's *raw* override — kept undiluted by any layout preset, because this is exactly
  // what gets propagated to children (via `childParameter`/dialog data), and each nesting level
  // may resolve a different layout and must apply its own preset fresh. See `effectiveFieldConfig`
  // for the version actually used to render this instance.
  protected readonly resolvedFieldConfig = computed(
    () => this.dialogData?.fieldConfig ?? this.parameter()?.fieldConfig ?? this.fieldConfig(),
  );

  protected readonly resolvedGroupConfig = computed(
    () => this.dialogData?.groupConfig ?? this.parameter()?.groupConfig ?? this.groupConfig(),
  );

  protected readonly resolvedArrayConfig = computed(
    () => this.dialogData?.arrayConfig ?? this.parameter()?.arrayConfig ?? this.arrayConfig(),
  );

  // This instance's resolved layout's preset, merged with the caller's raw override — what
  // rendering actually uses. Class-like props combine (mergeClasses); everything else, the
  // caller's value wins.
  protected readonly effectiveFieldConfig = computed(() =>
    mergeFieldConfig(LAYOUT_PRESETS[this.resolvedLayout()].fieldConfig, this.resolvedFieldConfig()),
  );

  protected readonly effectiveArrayConfig = computed(() =>
    mergeArrayConfig(LAYOUT_PRESETS[this.resolvedLayout()].arrayConfig, this.resolvedArrayConfig()),
  );

  // A field can request its own layout (`field.layout`) independent of the group's — reuses the
  // already-computed `effectiveFieldConfig` for the common case, only re-merging when it differs.
  private fieldConfigFor(fieldLayout?: FieldLayout): FieldConfig {
    if (!fieldLayout || fieldLayout === this.resolvedLayout()) return this.effectiveFieldConfig();
    return mergeFieldConfig(LAYOUT_PRESETS[fieldLayout].fieldConfig, this.resolvedFieldConfig());
  }

  protected readonly resolvedShowBgIconMark = computed(
    () =>
      this.dialogData?.showBgIconMark ?? this.parameter()?.showBgIconMark ?? this.showBgIconMark(),
  );

  protected readonly resolvedShowGroupsInTabs = computed(
    () =>
      this.dialogData?.showGroupsInTabs ??
      this.parameter()?.showGroupsInTabs ??
      this.showGroupsInTabs(),
  );

  // Bundles this instance's resolved cross-cutting settings (everything but `group`, which is
  // always call-site-specific) so recursive `<field-group>` calls in the template can pass
  // `[parameter]="{ ...childParameter(), group: x }"` instead of repeating every binding.
  protected readonly childParameter = computed<FieldGroupParameter<D>>(() => ({
    layout: this.resolvedLayout(),
    data: this.resolvedData(),
    animation: this.resolvedAnimation(),
    fieldConfig: this.resolvedFieldConfig(),
    groupConfig: this.resolvedGroupConfig(),
    arrayConfig: this.resolvedArrayConfig(),
    showBgIconMark: this.resolvedShowBgIconMark(),
    showGroupsInTabs: this.resolvedShowGroupsInTabs(),
  }));

  protected readonly fields = computed(() => {
    let fields = this.resolvedGroup().fields as FieldData[] | undefined;
    return fields?.filter((f) => f.visible !== false) ?? [];
  });

  protected readonly subGroups = computed(() => this.resolvedGroup().groups ?? []);

  protected readonly showHeader = computed(() => {
    const g = this.resolvedGroup();
    return g.showHeader !== false && !!(g.label || g.icon);
  });

  protected readonly inTabs = computed(
    () => this.resolvedGroup().showGroupsInTabs ?? this.resolvedShowGroupsInTabs(),
  );

  private readonly fields$ = toObservable(this.fields);

  private readonly data$ = toObservable(this.resolvedData);

  // One combined stream resolving every field's DynamicValue props (class/icon/tooltip/...) at
  // once, keeping each field paired with its own view model — avoids building a fresh
  // RxJS pipeline per template call, and avoids a separate per-field component (which would
  // need to import FieldGroupComponent back for nested recursion, forming a circular
  // standalone-component dependency that fails at runtime with NG0919).
  protected readonly rows = toSignal(
    combineLatest([this.fields$, this.data$]).pipe(
      switchMap(([fields, data]) =>
        fields.length
          ? combineLatest(
              fields.map((field) =>
                this.buildViewModel$(field, data).pipe(map((vm) => ({ field, vm }))),
              ),
            )
          : of([] as FieldRow[]),
      ),
    ),
    { initialValue: [] as FieldRow[] },
  );

  protected hasLabel(field: FieldData): boolean {
    return (
      this.resolvedGroupConfig()?.showLabels !== false && field.showLabel !== false && !!field.label
    );
  }

  protected showColon(field: FieldData): boolean {
    return field.showColon ?? this.fieldConfigFor(field.layout).showColon ?? false;
  }

  protected showUnderline(field: FieldData): boolean {
    return field.showUnderline ?? this.fieldConfigFor(field.layout).showUnderlines ?? false;
  }

  // The row's own bottom border (from its layout preset, e.g. `table`'s grid separator) is
  // structural and always present; the *conditional* underline is a separate, additive class —
  // applied to the row itself (not just the value) so it aligns across sibling columns in a
  // multi-column `containerClass` grid, and covers object fields the same as scalar ones.
  protected rowClass(row: FieldRow): string {
    const field = row.field;
    const fc = this.fieldConfigFor(field.layout);
    const underlineArrayTypes: FieldType[] = ['stringArray', 'numberArray', 'booleanArray'];
    const isArray = field.type?.toLowerCase()?.includes('array');
    const underlineArray = underlineArrayTypes.includes(field.type as FieldType);

    const line = `border-b border-dashed border-black/10`;
    const underline = (underlineArray || !isArray) && this.showUnderline(field) ? line : '';

    return [fc.class, row.vm.class, row.vm.outerClass, underline]
      .filter((c): c is string => !!c)
      .reduce((acc, cls) => mergeClasses(acc, cls), '');
  }

  protected labelClass(row: FieldRow): string {
    const base = this.fieldConfigFor(row.field.layout).labelsClass ?? '';
    return row.vm.labelClass ? mergeClasses(base, row.vm.labelClass) : base;
  }

  protected valueClass(row: FieldRow): string {
    const field = row.field;
    const fc = this.fieldConfigFor(field.layout);
    const layout = field.layout ?? this.resolvedLayout();
    const isGrid = layout === 'table' || layout === 'palletes';
    const base = !this.hasLabel(field) && isGrid ? 'col-span-12 text-sm' : (fc.valuesClass ?? '');
    return row.vm.valueClass ? mergeClasses(base, row.vm.valueClass) : base;
  }

  protected tableColumns(f: FieldData): { key: string; label: string }[] {
    const first = f.fieldGroups?.[0];

    return ((first?.fields as FieldData[] | undefined) ?? []).map((c) => ({
      key: c.key,
      label: c.label ?? c.key,
    }));
  }

  protected cellField(row: FieldGroupData, key: string): FieldData | undefined {
    return (row.fields as FieldData[] | undefined)?.find((c) => c.key === key);
  }

  /** `itemButtons` click handlers expect the raw array item, not its `FieldGroupData` wrapper. */
  protected readonly itemActionsData = (row: FieldGroupData) => row.object;

  // Card-list (non-tabular) array pagination state, keyed by field so a group with more than
  // one paginated array keeps independent pages. The tabular case doesn't need this — DataTable
  // owns its own page index internally.
  private readonly pageIndexByField = signal<Record<string, number>>({});

  protected pageSizeFor(field: FieldData): number {
    return field.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  protected isArrayPaginated(field: FieldData): boolean {
    return (field.fieldGroups?.length ?? 0) > this.pageSizeFor(field);
  }

  protected pageIndexFor(field: FieldData): number {
    return this.pageIndexByField()[field.path ?? field.key] ?? 0;
  }

  protected pagedFieldGroups(field: FieldData): FieldGroupData[] {
    const groups = field.fieldGroups ?? [];
    if (!this.isArrayPaginated(field)) return groups;

    const size = this.pageSizeFor(field);
    const start = this.pageIndexFor(field) * size;
    return groups.slice(start, start + size);
  }

  protected onArrayPage(field: FieldData, event: PageEvent): void {
    const key = field.path ?? field.key;
    this.pageIndexByField.update((m) => ({ ...m, [key]: event.pageIndex }));
  }

  /** The value shown for an `isObject` field before it's expanded: its labelField, evaluated. */
  protected labelFieldData(f: FieldData): FieldData {
    const key = f.labelField?.key || f.key;
    const value = f.labelField?.value;
    return { key, path: f.path, value, type: getFieldType({ key, value }) };
  }

  protected nestedLayout(f: FieldData): FieldLayout {
    return f.layout ?? this.resolvedLayout();
  }

  protected openObjectDialog(row: FieldRow): void {
    const f = row.field;
    if (!f.fields?.length) return;

    this.dialog.open<FieldGroupComponent<D>, FieldGroupDialogData<D>>(FieldGroupComponent, {
      autoFocus: false,
      maxWidth: '90vw',
      width: '32rem',
      data: {
        ...this.childParameter(),
        title: f.label,
        icon: row.vm.icon || row.vm.labelIcon,
        group: { fields: f.fields },
        layout: this.nestedLayout(f),
      } satisfies FieldGroupDialogData<D>,
    });
  }

  private buildViewModel$(field: FieldData, data: unknown): Observable<FieldRowViewModel> {
    return combineLatest({
      icon: resolveDynamicValue$(field.icon, data),
      class: resolveDynamicValue$(field.class, data),
      tooltip: this.resolveTooltip$(field, data),
      outerClass: resolveDynamicValue$(field.outerClass, data),
      innerClass: resolveDynamicValue$(field.innerClass, data),
      labelClass: resolveDynamicValue$(field.labelClass, data),
      valueClass: resolveDynamicValue$(field.valueClass, data),
      iconClass: resolveDynamicValue$(field.iconClass, data),
      labelIcon: resolveDynamicValue$(field.labelIcon, data),
      valueIcon: resolveDynamicValue$(field.valueIcon, data),
    }).pipe(map(({ tooltip, ...rest }) => ({ ...DEFAULT_VIEW_MODEL, ...rest, ...tooltip })));
  }

  private resolveTooltip$(field: FieldData, data: unknown) {
    return resolveDynamicValue$(field.tooltipConfig, data).pipe(
      switchMap((config) =>
        combineLatest({
          fromConfig: resolveDynamicValue$(config?.tooltip, data),
          fallback: resolveDynamicValue$(field.tooltip, data),
          position: resolveDynamicValue$(config?.position, data),
          tooltipClass: resolveDynamicValue$(config?.class, data),
        }).pipe(
          map((x) => ({
            tooltip: x.fromConfig ?? x.fallback,
            tooltipPosition: x.position ?? ('below' as const),
            tooltipClass: x.tooltipClass,
          })),
        ),
      ),
    );
  }
}
