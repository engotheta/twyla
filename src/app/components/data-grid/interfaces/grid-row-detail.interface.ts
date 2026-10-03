// row master-detail expansion: a row expands to reveal nested detail content

import { Type } from '@angular/core';
import { DynamicValue } from '@components/action-buttons/action-button.interface';

export interface GridRowDetailConfig<RowType = any> {
  /** dynamic component rendered as the expanded row's content */
  component?: Type<any>;
  /** template/component reference instead of `component` — caller's choice, same convention as GridColumn_.template */
  template?: any;
  /** declarative input mapping for `component`, e.g. { row: 'row', gridData: 'gridData' } */
  inputs?: Record<string, 'row' | 'index' | 'gridData'>;

  class?: DynamicValue<string, RowType>;
  /** default true */
  expandable?: DynamicValue<boolean, RowType>;
  /** default false: only one row expanded at a time (accordion) */
  multiExpand?: boolean;
  /** rows or identifierKey values, expanded on init */
  initialExpanded?: RowType[];
  onExpandChange?: (expandedRows: RowType[]) => void;
  /** default false: expansion is triggered by a dedicated toggle icon, not a click anywhere on the row */
  expandOnRowClick?: boolean;
}
