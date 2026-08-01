import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FormInstance, FormParameters, GenericFormComponent } from '../../generic-form';
import { GridInstance } from '../grid-engine.service';

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
    () => (this.instance().params.filterConfig?.filtersTrigger ?? 'manual') === 'live',
  );

  protected readonly formParams = computed<FormParameters>(() => {
    const cfg = this.instance().params.filterConfig;
    const live = this.isLive();

    return {
      fields: this.instance().params.gridFilters ?? [],
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
    () => this.instance().params.filterConfig?.applyButtonLabel ?? 'Apply',
  );
  protected readonly clearLabel = computed(
    () => this.instance().params.filterConfig?.clearButtonLabel ?? 'Clear',
  );
  protected readonly showClear = computed(() => {
    const explicit = this.instance().params.filterConfig?.showClearButton;
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
