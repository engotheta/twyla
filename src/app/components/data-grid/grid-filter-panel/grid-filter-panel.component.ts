import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FormInstance, FormParameter, GenericFormComponent } from '@components/generic-form';
import { GridInstance } from '../grid-engine.service';
import { cloneFormFields } from '../helpers/grid-search-bar.helpers';

/**
 * Wraps `gridFilters` (a `FormField[]`) in `<generic-form>` — 'manual' mode (default) shows
 * an Apply button that calls the form instance's `submitValue()`; 'live' mode wires generic-form's
 * `onChange` straight into `GridState.filters`, debounced via `filterConfig.changeDebounce`.
 */
@Component({
  selector: 'grid-filter-panel',
  imports: [GenericFormComponent, MatButtonModule],
  templateUrl: './grid-filter-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridFilterPanelComponent<RowType = any> {
  readonly instance = input.required<GridInstance<RowType>>();
  /** true when rendered directly in the toolbar row (`GridFilterConfig.filtersMode: 'inline'`)
   *  rather than inside the overlay panel — drops the floating-panel box chrome (width cap,
   *  scroll, border/shadow) in favor of a plain flex row matching the toolbar's own layout */
  readonly inline = input(false);

  protected formInstance?: FormInstance;

  protected readonly isLive = computed(
    () => (this.instance().params().filterConfig?.filtersTrigger ?? 'manual') === 'live',
  );

  // The form engine writes resolved values over observed props (`visible: obs(…)`) on the field
  // objects it's given — built from the declared `gridFilters` themselves, a panel opened a
  // second time (or the unified search bar, building its own form from the same config) would
  // find plain values and nothing left to observe. Copies, made once per `gridFilters` array.
  private readonly declaredFilters = computed(() => this.instance().params().gridFilters);
  private readonly fields = computed(() => cloneFormFields(this.declaredFilters() ?? []));

  protected readonly formParams = computed<FormParameter>(() => {
    const cfg = this.instance().params().filterConfig;
    const live = this.isLive();

    return {
      fields: this.fields(),
      showFooter: false,
      // inline mode sits in the toolbar's own flex row — lay fields out the same way
      // grid-search-fields does, instead of generic-form's default vertical stack, and free the
      // vertical space every mat-form-field otherwise reserves for a hint/error strip (the
      // overlay panel has room to spare, so it keeps the reserved space)
      fieldsContainerClass: this.inline() ? 'flex flex-wrap items-center gap-2' : undefined,
      showSubscript: !this.inline(),
      onChange: live
        ? (value) => this.instance().setFilters(value as Record<string, any>)
        : undefined,
      changeDebounce: cfg?.changeDebounce,
    };
  });

  protected readonly applyLabel = computed(
    () => this.instance().params().filterConfig?.applyButtonLabel ?? 'Apply',
  );
  protected readonly clearLabel = computed(
    () => this.instance().params().filterConfig?.clearButtonLabel ?? 'Clear',
  );
  protected readonly showClear = computed(() => {
    const explicit = this.instance().params().filterConfig?.showClearButton;
    return explicit ?? Object.keys(this.instance().filters()).length > 0;
  });

  protected onFormInstance(instance: FormInstance): void {
    this.formInstance = instance;
  }

  protected async apply(): Promise<void> {
    const value = await this.formInstance?.submitValue();
    if (value) this.instance().setFilters(value as Record<string, any>);
  }

  protected clear(): void {
    this.formInstance?.form.reset();
    this.instance().clearFilters();
  }
}
