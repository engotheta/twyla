import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DetailsComponent } from '../../details/details.component';
import { DetailsParameter } from '../../details/detail.interface';

/**
 * Thin dialog host for `all-details` — `DetailsComponent.parameter` is a signal `input.required()`,
 * which `MatDialog` can't populate directly from `data` (that requires template binding), so this
 * wrapper injects `MAT_DIALOG_DATA` and binds it. Opened by the grid on `viewDetailsClicks`.
 */
@Component({
  selector: 'grid-details-dialog',
  imports: [DetailsComponent],
  template: `<all-details [parameter]="data" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridDetailsDialogComponent<RowType = any> {
  protected readonly data = inject<DetailsParameter<RowType>>(MAT_DIALOG_DATA);
}
