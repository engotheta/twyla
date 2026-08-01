import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { labelFromFieldString } from '../../details/field/field-labels.helpers';
import { GridInstance, SYNTHETIC_COLUMN_KEYS } from '../grid-engine.service';
import { GridColumn_ } from '../interfaces/grid-column.interface';
import { GridExportFormat } from '../interfaces/grid-export.interface';

export interface GridExportPanelData<RowType = any> {
  instance: GridInstance<RowType>;
  format: GridExportFormat;
}

interface ExportEntry {
  key: string;
  label: string;
  selected: boolean;
}

const HIDDEN_ROW_KEYS = new Set(['_cellsProps', '_rowProps']);

/** every top-level key present on the current page's rows that ISN'T already a declared leaf
 *  column — "all the fields in the object... not just the ones defined as grid columns" */
function discoverExtraKeys(rows: unknown[], knownKeys: Set<string>): string[] {
  const extra = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      if (HIDDEN_ROW_KEYS.has(key) || knownKeys.has(key)) continue;
      extra.add(key);
    }
  }
  return Array.from(extra);
}

/**
 * Column picker shown before every export (any format) — mirrors `grid-column-panel`'s look
 * (checkbox + drag-to-reorder list) but the candidate set is wider: every declared leaf column
 * PLUS any raw field present on the actual row data that isn't a declared column at all (e.g.
 * an auto-generated grid capped at `maxAutoColumns`, or a column deliberately left undefined).
 * Initial selection/order = `GridExportConfig.initialKeys` when set, else the grid's own current
 * visible columns, in their current order; everything else is appended after, unselected.
 */
@Component({
  selector: 'grid-export-panel',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './grid-export-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridExportPanelComponent<RowType = any> {
  protected readonly data = inject<GridExportPanelData<RowType>>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<GridExportPanelComponent<RowType>, GridColumn_[] | undefined>);

  private readonly columnByKey = new Map(this.data.instance.leafColumns().map((c) => [c.key, c]));

  protected readonly entries = signal<ExportEntry[]>(this.buildInitialEntries());

  protected readonly selectedCount = computed(() => this.entries().filter((e) => e.selected).length);

  private buildInitialEntries(): ExportEntry[] {
    const inst = this.data.instance;
    const visibleKeys = inst
      .visibleColumns()
      .filter((c) => !SYNTHETIC_COLUMN_KEYS.has(c.key))
      .map((c) => c.key);
    const allLeafKeys = inst.leafColumns().map((c) => c.key);
    const extraKeys = discoverExtraKeys(inst.rows(), new Set(allLeafKeys));
    const hiddenDeclaredKeys = allLeafKeys.filter((k) => !visibleKeys.includes(k));

    const label = (key: string): string => this.columnByKey.get(key)?.label ?? labelFromFieldString(key);

    const initialKeys = inst.params.export?.initialKeys;
    const preselected = initialKeys?.length
      ? initialKeys
      : visibleKeys;
    const preselectedSet = new Set(preselected);
    const rest = [...visibleKeys, ...hiddenDeclaredKeys, ...extraKeys].filter(
      (k) => !preselectedSet.has(k),
    );

    return [
      ...preselected.map((key) => ({ key, label: label(key), selected: true })),
      ...rest.map((key) => ({ key, label: label(key), selected: false })),
    ];
  }

  protected toggle(entry: ExportEntry): void {
    this.entries.update((list) =>
      list.map((e) => (e.key === entry.key ? { ...e, selected: !e.selected } : e)),
    );
  }

  protected drop(event: CdkDragDrop<ExportEntry[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.entries.update((list) => {
      const next = [...list];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
  }

  protected selectAll(): void {
    this.entries.update((list) => list.map((e) => ({ ...e, selected: true })));
  }

  protected selectNone(): void {
    this.entries.update((list) => list.map((e) => ({ ...e, selected: false })));
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  /** selected entries, in their (possibly reordered) sequence — reuses the real `GridColumn_`
   *  for declared columns (keeps type/formatting), synthesizes a minimal one for raw extra keys */
  protected confirm(): void {
    const columns: GridColumn_[] = this.entries()
      .filter((e) => e.selected)
      .map((e) => this.columnByKey.get(e.key) ?? { key: e.key, label: e.label });
    this.dialogRef.close(columns);
  }
}
