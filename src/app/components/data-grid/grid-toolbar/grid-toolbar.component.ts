import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FormInstance } from '../../generic-form';
import { ActionButtonsComponent } from '../../action-buttons/action-buttons.component';
import { GridExportService } from '../grid-export.service';
import { GridInstance } from '../grid-engine.service';
import { GridColumnPanelComponent } from '../grid-column-panel/grid-column-panel.component';
import { GridFilterPanelComponent } from '../grid-filter-panel/grid-filter-panel.component';
import { GridRenderMode } from '../grid-render-mode.interface';
import { GridSearchDialogComponent } from '../grid-search-dialog/grid-search-dialog.component';
import { GridSearchFieldsComponent } from '../grid-search-fields/grid-search-fields.component';

const RENDER_MODE_ICONS: Record<GridRenderMode, string> = { table: 'table_rows', list: 'view_list', cards: 'grid_view' };

@Component({
  selector: 'grid-toolbar',
  imports: [
    OverlayModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatMenuModule,
    ActionButtonsComponent,
    GridColumnPanelComponent,
    GridFilterPanelComponent,
    GridSearchFieldsComponent,
  ],
  templateUrl: './grid-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridToolbarComponent<RowType = any> {
  readonly instance = input.required<GridInstance<RowType>>();
  readonly showSearch = input(false);

  private readonly exportService = inject(GridExportService);
  private readonly dialog = inject(MatDialog);

  protected readonly renderModeIcons = RENDER_MODE_ICONS;

  protected readonly filtersOpen = signal(false);
  protected readonly columnsOpen = signal(false);

  private searchFormInstance?: FormInstance<any>;
  protected onSearchFormInstance(formInstance: FormInstance<any>): void {
    this.searchFormInstance = formInstance;
  }

  /** searchFieldsMode: 'modal' — grid-search-fields emits this once an add should surface the
   *  dialog (space beyond the first instance) instead of growing inline in the toolbar row */
  protected openSearchDialog(): void {
    if (!this.searchFormInstance) return;
    this.dialog.open(GridSearchDialogComponent, {
      data: { instance: this.instance(), formInstance: this.searchFormInstance },
      width: '480px',
    });
  }

  protected readonly renderModes = computed(() => this.instance().params.renderMode?.modes ?? []);
  protected readonly exportFormats = computed(() => this.instance().params.export?.formats ?? []);

  protected selectOption(slug: string): void {
    this.instance().selectOption(slug);
  }

  protected setRenderMode(mode: GridRenderMode): void {
    this.instance().setRenderMode(mode);
  }

  protected export(format: 'csv' | 'excel' | 'pdf'): void {
    void this.exportService.export(format, this.instance());
  }
}
