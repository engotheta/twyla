import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormArray } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  controlStatus,
  FieldComponent,
  FieldType,
  FormEngineService,
  FormField,
  FormInstance,
  ObjectField,
  Option,
  observe,
  SelectField,
} from '../../generic-form';
import { GridInstance } from '../grid-engine.service';
import {
  DEFAULT_ENABLED_SEARCH_TYPES,
  SearchField,
  SearchType,
} from '../interfaces/grid-search.interface';

const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  equals: 'Equals',
  notEquals: 'Not equals',
  like: 'Contains',
  in: 'In',
  notIn: 'Not in',
  greaterThan: 'Greater than',
  greaterThanOrEqual: 'Greater than or equal',
  lessThan: 'Less than',
  lessThanOrEqual: 'Less than or equal',
  between: 'Between',
  isNull: 'Is empty',
  isNotNull: 'Is not empty',
};

/**
 * The compound multi-field search UI (grid-search.interface.ts): a dropdown of `searchable`
 * columns + a value input per instance, addable/removable, with an optional per-instance
 * searchType override. One `FormInstance` (built via `FormEngineService` directly — not
 * `<generic-form>`, since the "remove" button placement rule (every instance except the
 * first) needs bespoke per-item chrome the stock isList rendering doesn't offer) backs BOTH the
 * toolbar's inline mount and, in `searchFieldsMode: 'modal'`, grid-search-dialog's mount — see
 * `existingInstance`, which is how the two stay in sync instead of diverging into two forms.
 */
@Component({
  selector: 'grid-search-fields',
  imports: [FieldComponent, MatBadgeModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './grid-search-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridSearchFieldsComponent<RowType = any> implements OnInit {
  readonly instance = input.required<GridInstance<RowType>>();
  /** provided only by grid-search-dialog, reusing the toolbar mount's own instance rather than
   *  building (and diverging from) a second one */
  readonly existingInstance = input<FormInstance>();
  readonly instanceChange = output<FormInstance>();
  /** fired after an add that, per `searchFieldsMode: 'modal'`, should surface the dialog instead
   *  of growing inline — the toolbar (which already knows about grid-search-dialog) owns opening
   *  it, so this component never needs to import that component itself (avoids a circular
   *  import: dialog -> this component -> dialog) */
  readonly openDialogRequested = output<void>();

  private readonly engine = inject(FormEngineService);
  private readonly destroyRef = inject(DestroyRef);

  protected formInstance!: FormInstance;
  protected objectField!: ObjectField;
  private searchableColumns: { key: string; label?: string; searchType?: SearchType }[] = [];
  private searchConfig: GridInstance<RowType>['params']['searchConfig'];

  protected readonly typeOverrideOn = signal(false);
  protected readonly searchTypeLabel = (t: SearchType): string => SEARCH_TYPE_LABELS[t];

  // `AbstractControl`/`FormArray` are plain RxJS-backed objects, not signals — reading
  // `.length`/`.value` off one directly inside a `computed()` creates NO reactive dependency, so
  // `items` would compute once and then never again reflect `addListItem`/`removeListItem`
  // (confirmed bug: the "+" button appeared to do nothing). `controlStatus` bridges the
  // FormArray's `valueChanges` into a real signal — the same mechanism `ObjectFieldComponent`
  // itself relies on for the stock isList UI (generic-form/SPEC.md §13).
  private readonly arrayControlSig = signal<FormArray | undefined>(undefined);
  protected readonly arrayStatus = controlStatus(this.arrayControlSig);

  /** in 'modal' mode, the toolbar's OWN mount (not reusing an instance — i.e. not inside the
   *  dialog) shows only the first instance; everything else lives in the dialog */
  protected readonly onlyFirstVisible = computed(
    () => (this.searchConfig?.searchFieldsMode ?? 'inline') === 'modal' && !this.existingInstance(),
  );

  ngOnInit(): void {
    this.searchConfig = this.instance().params.searchConfig;
    const existing = this.existingInstance();
    if (existing) {
      this.formInstance = existing;
      this.objectField = this.formInstance.fields.find(
        (f) => f.key === 'searchFields',
      ) as ObjectField;
      this.searchableColumns = this.instance()
        .leafColumns()
        .filter((c) => c.searchable)
        .map((c) => ({ key: c.key, label: c.label, searchType: c.searchType }));
      this.arrayControlSig.set(this.formInstance.control(this.objectField) as FormArray);
      return;
    }
    this.buildForm();
    this.arrayControlSig.set(this.formInstance.control(this.objectField) as FormArray);
    this.instanceChange.emit(this.formInstance);
    this.destroyRef.onDestroy(() => this.formInstance.destroy());
  }

  private buildForm(): void {
    const inst = this.instance();
    const cfg = this.searchConfig;
    this.searchableColumns = inst
      .leafColumns()
      .filter((c) => c.searchable)
      .map((c) => ({ key: c.key, label: c.label, searchType: c.searchType }));
    const hasSearchable = this.searchableColumns.length > 0;
    const enabledTypes = cfg?.enabledSearchTypes ?? DEFAULT_ENABLED_SEARCH_TYPES;
    const showTypeToggle = hasSearchable && !!cfg?.searchTypeChangeable;

    const itemFields: FormField[] = [];
    if (hasSearchable) {
      itemFields.push({
        type: FieldType.select,
        key: 'key',
        showLabel: false,
        placeholder: 'Column',
        options: observe(
          ['searchFields', './key'],
          (allItems: SearchField[], ownKey: string | undefined) =>
            this.columnOptions(allItems, ownKey),
        ),
      } as SelectField);
    }
    itemFields.push({
      type: FieldType.input,
      key: 'value',
      showLabel: false,
      placeholder: hasSearchable ? 'Value…' : 'Search…',
    });
    if (showTypeToggle) {
      itemFields.push({
        type: FieldType.select,
        key: 'searchType',
        showLabel: false,
        placeholder: 'Operator',
        value: observe('./key', (key: string | undefined) => this.resolveDefaultSearchType(key)),
        options: enabledTypes.map((t) => ({ label: SEARCH_TYPE_LABELS[t], value: t })),
      } as SelectField);
    }

    this.objectField = {
      type: FieldType.object,
      key: 'searchFields',
      isList: true,
      minItems: 1,
      maxItems: hasSearchable ? this.searchableColumns.length : 1,
      showFormLabel: false,
      value: inst.searchFields() as unknown as Record<string, unknown>,
      canAddItem: hasSearchable
        ? observe('searchFields', (items: SearchField[]) => {
            if (!items.at(-1)?.value) return false;
            const used = new Set(items.map((i) => i.key).filter((k): k is string => !!k));
            return used.size < this.searchableColumns.length;
          })
        : false,
      fields: itemFields,
    };

    this.formInstance = this.engine.build({
      fields: [this.objectField],
      // compound search fields sit in the toolbar row (or a compact dialog) — free the vertical
      // space every mat-form-field otherwise reserves for a hint/error that's never shown here
      showSubscript: false,
      onChange: (value) =>
        this.pushSearchFields((value as { searchFields?: SearchField[] }).searchFields ?? []),
      changeDebounce: cfg?.changeDebounce ?? 300,
    });
  }

  private columnOptions(allItems: SearchField[], ownKey: string | undefined): Option<string>[] {
    return this.searchableColumns
      .filter((c) => c.key === ownKey || !allItems.some((f) => f.key === c.key))
      .map((c) => ({ label: c.label ?? c.key, value: c.key }));
  }

  private resolveDefaultSearchType(key: string | undefined): SearchType {
    const column = this.searchableColumns.find((c) => c.key === key);
    return column?.searchType ?? this.searchConfig?.defaultSearchType ?? 'like';
  }

  private pushSearchFields(
    rawItems: { key?: string; value: string; searchType?: SearchType }[],
  ): void {
    const fields: SearchField[] = rawItems.map((item) => ({
      key: item.key,
      value: item.value ?? '',
      searchType: item.searchType ?? this.resolveDefaultSearchType(item.key),
    }));
    this.instance().setSearchFields(fields);
  }

  // ── item list ──

  private readonly rawItems = computed(
    () => (this.arrayStatus().value as { key?: string; value: string }[] | null) ?? [],
  );

  /** true count, including items hidden by `onlyFirstVisible` — drives the "N more, reopen"
   *  affordance (§5) independently of how many items THIS mount actually renders */
  protected readonly itemCount = computed(() => this.rawItems().length);

  protected readonly items = computed(() => {
    const count = this.itemCount();
    const visible = this.onlyFirstVisible() ? Math.min(count, 1) : count;
    return Array.from({ length: visible }, (_, i) => ({
      index: i,
      fields: this.formInstance.listItemFields(this.objectField, i),
    }));
  });

  protected readonly canClear = computed(() => {
    const items = this.rawItems();
    return items.length > 1 || !!items[0]?.value;
  });

  /** resets to a single empty instance — mirrors grid-filter-panel's Clear button */
  protected clearAll(): void {
    const arr = this.formInstance.control(this.objectField) as FormArray | undefined;
    if (!arr) return;
    while (arr.length > 1) this.formInstance.removeListItem('searchFields', arr.length - 1);

    const firstFields = this.formInstance.listItemFields(this.objectField, 0);
    const valueField = firstFields.find((f) => f.key === 'value');
    if (valueField) this.formInstance.control(valueField)?.setValue('');
    const keyField = firstFields.find((f) => f.key === 'key');
    if (keyField && this.searchableColumns.length) {
      this.formInstance.control(keyField)?.setValue(this.searchableColumns[0].key);
    }
  }

  protected showTypeField(field: FormField): boolean {
    return field.key !== 'searchType' || this.typeOverrideOn();
  }

  protected readonly showTypeToggleButton = computed(
    () => !!this.searchConfig?.searchTypeChangeable && this.searchableColumns.length > 0,
  );

  protected toggleTypeOverride(): void {
    this.typeOverrideOn.update((on) => !on);
  }

  protected canRemove(index: number): boolean {
    return index > 0;
  }

  protected removeItem(index: number): void {
    this.formInstance.removeListItem('searchFields', index);
  }

  /** true once the last VISIBLE instance has a value and searchable columns remain unused —
   *  the actual add/remove-item-count gating lives in `canAddItem` (Dynamic, resolved on the
   *  field itself); this also hides the button entirely once the list is capped */
  protected readonly canAdd = computed(() => {
    const state = this.formInstance.fieldState(this.objectField)() as { canAddItem?: boolean };
    return !!state.canAddItem;
  });

  /** in 'modal' mode, the toolbar's own "+" opens (or grows, then opens) the dialog instead of
   *  adding inline — grid-search-dialog reuses this SAME formInstance, so the item just added
   *  here is what the dialog opens already showing */
  protected addItem(): void {
    const arr = this.formInstance.control(this.objectField) as FormArray | undefined;
    const newIndex = arr?.length ?? 0;
    this.formInstance.addListItem('searchFields');
    const nextKey = this.nextUnusedKey();
    if (nextKey !== undefined) {
      const keyField = this.formInstance
        .listItemFields(this.objectField, newIndex)
        .find((f) => f.key === 'key');
      if (keyField) this.formInstance.control(keyField)?.setValue(nextKey);
    }

    if (this.onlyFirstVisible()) this.openDialogRequested.emit();
  }

  private nextUnusedKey(): string | undefined {
    const used = new Set(
      ((this.formInstance.control(this.objectField) as FormArray)?.value as SearchField[]).map(
        (f) => f.key,
      ),
    );
    return this.searchableColumns.find((c) => !used.has(c.key))?.key;
  }
}
