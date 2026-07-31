import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FormInstance, FormParameters, GenericFormComponent } from '../../generic-form';
import { GridInstance } from '../grid-engine.service';

/**
 * Wraps `gridFilters` (a `FormField[]`) in `<app-generic-form>` — 'manual' mode (default) shows
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

  protected formInstance?: FormInstance;

  protected readonly isLive = computed(
    () => (this.instance().params.filterConfig?.filtersMode ?? 'manual') === 'live',
  );

  protected readonly formParams = computed<FormParameters>(() => {
    const cfg = this.instance().params.filterConfig;
    const live = this.isLive();
    return {
      fields: this.instance().params.gridFilters ?? [],
      showFooter: false,
      onChange: live ? (value) => this.instance().setFilters(value as Record<string, any>) : undefined,
      changeDebounce: cfg?.changeDebounce,
    };
  });

  protected readonly applyLabel = computed(() => this.instance().params.filterConfig?.applyButtonLabel ?? 'Apply');
  protected readonly clearLabel = computed(() => this.instance().params.filterConfig?.clearButtonLabel ?? 'Clear');
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
