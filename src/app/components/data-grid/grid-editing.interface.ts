// inline cell editing

export interface GridEditingConfig<RowType = any> {
  /** master switch, default false; column/cell `editable` still layers on top of this */
  editable?: boolean;
  /** default 'dblclick' */
  trigger?: 'click' | 'dblclick' | 'button';

  /** returning/resolving false cancels the commit */
  onCellEdit?: (
    row: RowType,
    key: string,
    value: any,
    previousValue: any,
  ) => boolean | void | Promise<boolean | void>;

  /** returning a string blocks the commit and shows it as a validation message */
  validateFn?: (row: RowType, key: string, value: any) => string | undefined | Promise<string | undefined>;
}
