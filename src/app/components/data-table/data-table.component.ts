import { ChangeDetectionStrategy, Component, computed, input, signal, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ActionButtonsComponent } from '../action-buttons/action-buttons.component';
import { ActionButton } from '../action-buttons/action-button.interface';

export interface DataTableColumn {
  key: string;
  label: string;
}

export interface DataTableCellContext<T> {
  $implicit: T;
  column: DataTableColumn;
}

export interface DataTableRowContext<T> {
  $implicit: T;
}

/**
 * A plain, presentation-agnostic table: columns + rows in, an optional numbered index column,
 * and two ways to fill the trailing column — `rowActions` for the common case (an `ActionButton[]`
 * rendered via `<action-buttons>`), or `rowTemplate` for full custom control. `rowTemplate` wins
 * if both are set. Set `pageSize` to cap how many rows render at once, with a `mat-paginator`
 * underneath — a failsafe against unbounded scrolling for large row counts. Otherwise knows
 * nothing about where `T` comes from, so it isn't tied to any particular feature.
 */
@Component({
  selector: 'data-table',
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  imports: [NgTemplateOutlet, ActionButtonsComponent, MatPaginatorModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTableComponent<T = unknown> {
  readonly columns = input<DataTableColumn[]>([]);
  readonly rows = input<T[]>([]);
  readonly caption = input<string>();

  readonly showIndex = input(true);
  readonly indexClass = input<string>();

  /** Renders a cell's content; falls back to plain property access when omitted. */
  readonly cellTemplate = input<TemplateRef<DataTableCellContext<T>>>();

  /** Buttons rendered in a trailing column, one `<action-buttons>` per row, when provided. */
  readonly rowActions = input<ActionButton<unknown>[]>();
  /** Maps a row to the `data` each row's action buttons resolve against. Defaults to the row itself. */
  readonly rowActionsData = input<(row: T) => unknown>((row) => row);
  readonly animation = input<string>();

  /** Full control over the trailing column; takes priority over `rowActions` when both are set. */
  readonly rowTemplate = input<TemplateRef<DataTableRowContext<T>>>();

  readonly actionsLabel = input('Actions');

  /** Caps rows-per-page; a `mat-paginator` appears once `rows().length` exceeds it. */
  readonly pageSize = input<number>();

  protected readonly pageIndex = signal(0);

  protected readonly isPaginated = computed(() => {
    const size = this.pageSize();
    return !!size && this.rows().length > size;
  });

  protected readonly pagedRows = computed(() => {
    const size = this.pageSize();
    const all = this.rows();
    if (!size || all.length <= size) return all;

    const start = this.pageIndex() * size;
    return all.slice(start, start + size);
  });

  // The "#" column should show each row's true position across pages, not restart at 1.
  protected readonly indexOffset = computed(() => {
    const size = this.pageSize();
    return size ? this.pageIndex() * size : 0;
  });

  protected readonly hasActionsColumn = computed(
    () => !!(this.rowTemplate() || this.rowActions()?.length),
  );

  protected cellValue(row: T, key: string): unknown {
    return (row as Record<string, unknown> | null)?.[key];
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
  }
}
