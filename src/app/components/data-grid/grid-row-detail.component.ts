import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GridRowDetailConfig } from './interfaces/grid-row-detail.interface';

/** Renders an expanded row's detail content — a dynamic `component`, or a `template`, caller's choice. */
@Component({
  selector: 'grid-row-detail',
  imports: [NgComponentOutlet, NgTemplateOutlet],
  template: `
    @if (config()?.component; as cmp) {
      <ng-container [ngComponentOutlet]="cmp" [ngComponentOutletInputs]="resolvedInputs()" />
    } @else if (config()?.template; as tpl) {
      <ng-container
        [ngTemplateOutlet]="tpl"
        [ngTemplateOutletContext]="{
          $implicit: row(),
          row: row(),
          index: index(),
          gridData: gridData(),
        }"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridRowDetailComponent<RowType = any> {
  readonly config = input<GridRowDetailConfig<RowType>>();
  readonly row = input.required<RowType>();
  readonly index = input<number>();
  readonly gridData = input<RowType[]>();

  protected readonly resolvedInputs = computed(() => {
    const mapping = this.config()?.inputs ?? {};
    const values: Record<string, unknown> = {};
    for (const [inputName, source] of Object.entries(mapping)) {
      values[inputName] =
        source === 'row' ? this.row() : source === 'index' ? this.index() : this.gridData();
    }
    return values;
  });
}
