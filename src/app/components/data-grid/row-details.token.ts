import { InjectionToken, Type } from '@angular/core';

/** What `DataGridComponent`'s click-to-view-details affordance (`GridParameter.viewDetailsClicks`)
 *  binds to the `params` input of whatever component `ROW_DETAILS_COMPONENT` resolves to — the
 *  shape `DetailsComponent`'s own `DetailsParameter` already accepts. */
export interface RowDetailsParams<RowType = any> {
  entity: RowType;
}

/**
 * The component `DataGridComponent` hosts in a `ViewService` dialog for its click-to-view-details
 * affordance, with `{ entity: row }` (`RowDetailsParams`) bound to its `params` input — resolved
 * via DI instead of a direct import. `details/details.component` (the natural choice) can't be
 * imported here at compile time: `field-group.component` — a descendant of `details.component` —
 * renders `<data-grid>` for tabular array columns, so a static import back from data-grid to
 * details.component would form `data-grid -> details -> data-grid`, a circular
 * standalone-component dependency that fails at runtime (see the analogous note on
 * `FieldGroupComponent`'s own recursion). Provide a value app-wide, e.g. in `app.config.ts`:
 * `{ provide: ROW_DETAILS_COMPONENT, useValue: DetailsComponent }`.
 */
export const ROW_DETAILS_COMPONENT = new InjectionToken<Type<unknown>>('ROW_DETAILS_COMPONENT');
