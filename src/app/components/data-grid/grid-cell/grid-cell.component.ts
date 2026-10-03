import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, isObservable, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { mergeClasses } from '@utils/class-name.helpers';
import { ActionButtonsComponent } from '@components/action-buttons/action-buttons.component';
import { resolveDynamicValue$ } from '@utils/dynamic-value.helpers';
import {
  FormField,
  FormInstance,
  FormParameter,
  GenericFormComponent,
} from '@components/generic-form';
import { GridInstance } from '../grid-engine.service';
import { GridColumn_ } from '../interfaces/grid-column.interface';
import { GridCell, GridRow } from '../interfaces/grid-cell.interface';
import { formatCellValue, resolveClassMap } from '../helpers/grid-format.helpers';
import { getCellValue } from '../helpers/grid-row.helpers';
import { MergeClassesPipe } from '@utils/pipes/merge-classes.pipe';

interface ResolvedCellProps {
  value: unknown;
  columnClass: string | undefined;
  contentClass: string | undefined;
  overrideClass: string | undefined;
  icon: string | undefined;
  iconClass: string | undefined;
  imageClass: string | undefined;
  tooltip: string | undefined;
  editable: boolean | undefined;
}

function resolveCellValue$<RowType>(
  override: GridCell<RowType> | undefined,
  row: RowType,
  data: RowType[],
): Observable<unknown> {
  if (override?.value === undefined) return of(undefined);
  const raw = typeof override.value === 'function' ? override.value(row, data) : override.value;
  return isObservable(raw) ? raw : of(raw);
}

/** Renders one real data column's cell content for one row (synthetic columns — index/select/expand/actions — render inline in the shell). */
@Component({
  selector: 'grid-cell',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ActionButtonsComponent,
    GenericFormComponent,
    MergeClassesPipe,
  ],
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
          value:
            override?.value !== undefined
              ? resolveCellValue$(override, row, data)
              : of(getCellValue(row, column)),
          columnClass: resolveDynamicValue$(column.class, row),
          contentClass: resolveDynamicValue$(column.contentClass, row),
          overrideClass: resolveDynamicValue$(override?.class, row),
          icon: resolveDynamicValue$(column.icon, row),
          iconClass: resolveDynamicValue$(column.iconClass, row),
          imageClass: resolveDynamicValue$(column.imageClass, row),
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
        imageClass: undefined,
        tooltip: undefined,
        editable: undefined,
      } as ResolvedCellProps,
    },
  );

  protected readonly cellClass = computed(() => {
    const conditional = resolveClassMap(this.column().conditionalFormat, this.row());
    return mergeClasses(
      mergeClasses(this.resolved().columnClass ?? '', conditional),
      this.resolved().overrideClass ?? '',
    );
  });

  protected readonly type = computed(() => this.override()?.type ?? this.column().type);
  protected readonly template = computed(() => this.override()?.template ?? this.column().template);
  protected readonly templateContext = computed(() => {
    const row = this.row();
    const raw = this.override()?.templateContext ?? this.column().templateContext;
    const context =
      typeof raw === 'function'
        ? raw(row)
        : (raw ?? { row, column: this.column(), value: this.resolved().value });
    return { $implicit: row, ...context };
  });

  protected readonly buttons = computed(() => this.override()?.buttons ?? this.column().buttons);

  protected readonly displayValue = computed(() => {
    const value = this.resolved().value;
    const truncate = this.column().truncate;
    const formatted = formatCellValue(value, this.type());
    return truncate && formatted.length > truncate ? `${formatted.slice(0, truncate)}…` : formatted;
  });

  protected readonly canEdit = computed(() => {
    const editingCfg = this.instance().params().editing;
    return (
      !!editingCfg?.editable && this.resolved().editable !== false && !!this.column().editField
    );
  });
  protected readonly trigger_ = computed(
    () => this.instance().params().editing?.trigger ?? 'dblclick',
  );

  protected readonly isEditing = signal(false);
  protected readonly editError = signal<string | undefined>(undefined);
  private editFormInstance?: FormInstance;

  protected readonly editFormParams = computed<FormParameter>(() => {
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
    const editingCfg = this.instance().params().editing;

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
