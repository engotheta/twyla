import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
} from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GridInstance } from '../grid-engine.service';
import { GridColumnState } from '../interfaces/grid-column.interface';

/** Show/hide, reorder (drag or keyboard move-up/down), and pin/unpin columns. */
@Component({
  selector: 'grid-column-panel',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    CdkDragPreview,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './grid-column-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridColumnPanelComponent<RowType = any> {
  readonly instance = input.required<GridInstance<RowType>>();

  private readonly labelByKey = computed(
    () =>
      new Map(
        this.instance()
          .leafColumns()
          .map((c) => [c.key, c.label ?? c.key]),
      ),
  );

  protected readonly entries = computed(() => {
    const labels = this.labelByKey();
    return this.instance()
      .columnState()
      .filter((entry) => labels.has(entry.key));
  });

  protected columnLabel(entry: GridColumnState): string {
    return this.labelByKey().get(entry.key) ?? entry.key;
  }

  protected pinClass(entry: GridColumnState): string {
    return entry.pinned ? 'opacity-100' : 'opacity-40';
  }

  protected pinLabel(entry: GridColumnState): string {
    if (entry.pinned === 'left') return 'Pinned left — click to pin right';
    if (entry.pinned === 'right') return 'Pinned right — click to unpin';
    return 'Not pinned — click to pin left';
  }

  protected togglePin(entry: GridColumnState): void {
    const next = entry.pinned === 'left' ? 'right' : entry.pinned === 'right' ? undefined : 'left';
    this.instance().setColumnPinned(entry.key, next);
  }

  protected toggleVisible(entry: GridColumnState): void {
    this.instance().setColumnVisible(entry.key, !entry.visible);
  }

  protected drop(event: CdkDragDrop<GridColumnState[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.instance().moveColumn(event.previousIndex, event.currentIndex);
  }

  protected moveUp(index: number): void {
    if (index <= 0) return;
    this.instance().moveColumn(index, index - 1);
  }

  protected moveDown(index: number): void {
    if (index >= this.entries().length - 1) return;
    this.instance().moveColumn(index, index + 1);
  }

  protected reset(): void {
    this.instance().resetColumnState();
  }

  protected readonly trackByKey = (_: number, entry: GridColumnState): string => entry.key;
}
