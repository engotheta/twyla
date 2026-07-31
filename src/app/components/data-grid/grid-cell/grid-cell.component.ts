import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, isObservable, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { mergeClasses } from '../../details/util/class-name/class-name.helpers';
import { resolveDynamicValue$ } from '../../action-buttons/dynamic-value.util';
import { FormField, FormInstance, FormParameters, GenericFormComponent } from '../../generic-form';
import { GridInstance } from '../grid-engine.service';
import { GridColumn_ } from '../grid-column.interface';
import { GridCell, GridRow } from '../grid-cell.interface';
import { formatCellValue, resolveClassMap } from '../grid-format.helpers';
import { getCellValue } from '../grid-row.helpers';

interface ResolvedCellProps {
  value: unknown;
  columnClass: string | undefined;
  contentClass: string | undefined;
  overrideClass: string | undefined;
  icon: string | undefined;
  iconClass: string | undefined;
  tooltip: string | undefined;
  editable: boolean | undefined;
}

function resolveCellValue$<RowType>(override: GridCell<RowType> | undefined, row: RowType, data: RowType[]): Observable<unknown> {
  if (override?.value === undefined) return of(undefined);
  const raw = typeof override.value === 'function' ? override.value(row, data) : override.value;
  return isObservable(raw) ? raw : of(raw);
}

/** Renders one real data column's cell content for one row (synthetic columns — index/select/expand/actions — render inline in the shell). */
@Component({
  selector: 'grid-cell',
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatTooltipModule, GenericFormComponent],
  templateUrl: './grid-cell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '[class]': 'resolved().contentClass',
  },
})
export class GridCellComponent<RowType = any> {
  readonly instance = input.required<GridInstance<RowType>>();
  readonly column = input.required<GridColumn_<RowType>>();
  readonly row = input.required<RowType>();

  protected readonly override = computed<GridCell<RowType> | undefined>(
    () => (this.row() as GridRow<RowType>)?._cellsProps?.[this.column().key],
  );

  private readonly trigger = computed(() => ({
    row: this.row(),
    column: this.column(),
    override: this.override(),
    data: this.instance().rows(),
  }));

  protected readonly resolved = toSignal(
    toObservable(this.trigger).pipe(
      switchMap(({ row, column, override, data }) =>
        combineLatest({
          value: override?.value !== undefined ? resolveCellValue$(override, row, data) : of(getCellValue(row, column)),
          columnClass: resolveDynamicValue$(column.class, row),
          contentClass: resolveDynamicValue$(column.contentClass, row),
          overrideClass: resolveDynamicValue$(override?.class, row),
          icon: resolveDynamicValue$(column.icon, row),
          iconClass: resolveDynamicValue$(column.iconClass, row),
          tooltip: resolveDynamicValue$(override?.tooltip, row),
          editable: resolveDynamicValue$(override?.editable ?? column.editable, row),
        }),
      ),
    ),
    {
      initialValue: {
        value: undefined,
        columnClass: undefined,
        contentClass: undefined,
        overrideClass: undefined,
        icon: undefined,
        iconClass: undefined,
        tooltip: undefined,
        editable: undefined,
      } as ResolvedCellProps,
    },
  );

  protected readonly cellClass = computed(() => {
    const conditional = resolveClassMap(this.column().conditionalFormat, this.row());
    return mergeClasses(mergeClasses(this.resolved().columnClass ?? '', conditional), this.resolved().overrideClass ?? '');
  });

  protected readonly type = computed(() => this.override()?.type ?? this.column().type);
  protected readonly template = computed(() => this.override()?.template ?? this.column().template);
  protected readonly templateContext = computed(() => ({
    $implicit: this.row(),
    row: this.row(),
    column: this.column(),
    value: this.resolved().value,
    context: this.override()?.templateContext ?? this.column().templateContext,
  }));

  protected readonly displayValue = computed(() => {
    const value = this.resolved().value;
    const truncate = this.column().truncate;
    const formatted = formatCellValue(value, this.type());
    return truncate && formatted.length > truncate ? `${formatted.slice(0, truncate)}…` : formatted;
  });

  protected readonly canEdit = computed(() => {
    const editingCfg = this.instance().params.editing;
    return !!editingCfg?.editable && this.resolved().editable !== false && !!this.column().editField;
  });
  protected readonly trigger_ = computed(() => this.instance().params.editing?.trigger ?? 'dblclick');

  protected readonly isEditing = signal(false);
  protected readonly editError = signal<string | undefined>(undefined);
  private editFormInstance?: FormInstance;

  protected readonly editFormParams = computed<FormParameters>(() => {
    const field = this.column().editField;
    const key = this.column().key;
    if (!field) return { fields: [] };
    const seeded = { ...field, key: field.key || key, value: this.resolved().value } as FormField;
    return { fields: [seeded], showFooter: false };
  });

  protected onCellClick(): void {
    if (this.canEdit() && this.trigger_() === 'click') this.startEdit();
  }

  protected onCellDblClick(): void {
    if (this.canEdit() && this.trigger_() === 'dblclick') this.startEdit();
  }

  protected startEdit(): void {
    this.editError.set(undefined);
    this.isEditing.set(true);
  }

  protected onEditButtonClick(event: Event): void {
    event.stopPropagation();
    this.startEdit();
  }

  protected cancelEdit(): void {
    this.isEditing.set(false);
    this.editError.set(undefined);
  }

  protected onEditFormInstance(instance: FormInstance): void {
    this.editFormInstance = instance;
  }

  protected async commitEdit(): Promise<void> {
    const value = await this.editFormInstance?.submitValue();
    if (value === null || value === undefined) return;

    const key = this.column().key;
    const newValue = (value as Record<string, unknown>)[key];
    const previous = this.resolved().value;
    const editingCfg = this.instance().params.editing;

    const validationError = await editingCfg?.validateFn?.(this.row(), key, newValue);
    if (validationError) {
      this.editError.set(validationError);
      return;
    }

    const result = await editingCfg?.onCellEdit?.(this.row(), key, newValue, previous);
    if (result === false) return;

    this.isEditing.set(false);
    this.editError.set(undefined);
  }
}
