import { InjectionToken, Type } from '@angular/core';

/** Data shape passed to whatever component `ROW_DETAILS_COMPONENT` resolves to — mirrors
 *  `MatDialog.open(Component, { data })`'s `data` for `DataGridComponent`'s built-in
 *  click-to-view-details affordance (`GridParameter.viewDetailsClicks`). */
export interface RowDetailsDialogData<RowType = any> {
  entity: RowType;
}

/**
 * The dialog component `DataGridComponent` opens for its click-to-view-details affordance,
 * resolved via DI instead of a direct import. `details/details.component` (the natural choice)
 * can't be imported here at compile time: `field-group.component` — a descendant of
 * `details.component` — renders `<data-grid>` for tabular array columns, so a static import
 * back from data-grid to details.component would form `data-grid -> details -> data-grid`, a
 * circular standalone-component dependency that fails at runtime (see the analogous note on
 * `FieldGroupComponent`'s own recursion). Provide a value app-wide, e.g. in `app.config.ts`:
 * `{ provide: ROW_DETAILS_COMPONENT, useValue: DetailsComponent }`.
 */
export const ROW_DETAILS_COMPONENT = new InjectionToken<Type<unknown>>('ROW_DETAILS_COMPONENT');
