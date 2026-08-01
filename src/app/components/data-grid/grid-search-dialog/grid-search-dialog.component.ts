import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { FormInstance } from '../../generic-form';
import { GridInstance } from '../grid-engine.service';
import { GridSearchFieldsComponent } from '../grid-search-fields/grid-search-fields.component';

export interface GridSearchDialogData<RowType = any> {
  instance: GridInstance<RowType>;
  /** the toolbar mount's own FormInstance — reused here (not rebuilt) so the dialog and the
   *  toolbar's first-instance view never diverge into two separate forms */
  formInstance: FormInstance<any>;
}

/**
 * `searchFieldsMode: 'modal'` destination for search instances beyond the first — mirrors
 * grid-details-dialog.component.ts's thin `MAT_DIALOG_DATA` host pattern. Opened by
 * grid-toolbar.component.ts on `grid-search-fields`'s `(openDialogRequested)`. Draggable by its
 * title bar (`cdkDrag`/`cdkDragHandle`) — useful since the panel can sit over the very toolbar
 * search icon a user might still want to see/reach while search fields are open.
 */
@Component({
  selector: 'grid-search-dialog',
  imports: [GridSearchFieldsComponent, MatDialogModule, CdkDrag, CdkDragHandle],
  template: `
    <div cdkDrag cdkDragRootElement=".cdk-overlay-pane" class="contents">
      <h2 mat-dialog-title cdkDragHandle class="!cursor-move">Search</h2>
      <div mat-dialog-content class="pt-2">
        <grid-search-fields [instance]="data.instance" [existingInstance]="data.formInstance" />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridSearchDialogComponent<RowType = any> {
  protected readonly data = inject<GridSearchDialogData<RowType>>(MAT_DIALOG_DATA);
}
