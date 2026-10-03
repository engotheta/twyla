import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, switchMap } from 'rxjs';
import { ActionButton, ActionButtonsParameter, DynamicValue } from './action-button.interface';
import { resolveDynamicValue$ } from '@utils/dynamic-value.helpers';
import { ActionButtonComponent } from './action-button/action-button.component';

@Component({
  selector: 'action-buttons',
  imports: [ActionButtonComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (button of buttons_(); track button.slug ?? $index) {
        <action-button [button]="button" [parentData]="data_()" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionButtonsComponent<D = unknown> {
  /** Accepts either a full parameter object, or the individual props below. */
  readonly parameter = input<ActionButtonsParameter<D>>();

  readonly data = input<D>();
  readonly animation = input<unknown>();
  readonly buttons = input<DynamicValue<ActionButton<D>[], D>>();

  protected readonly data_ = computed(() => (this.data() ?? this.parameter()?.data) as D);
  private readonly source = computed(() => this.buttons() ?? this.parameter()?.buttons);
  private readonly source$ = toObservable(this.source);
  private readonly data$ = toObservable(this.data_);

  protected readonly buttons_ = toSignal(
    combineLatest([this.source$, this.data$]).pipe(
      switchMap(([source, data]) => resolveDynamicValue$(source, data)),
      map((buttons) => buttons ?? []),
    ),

    { initialValue: [] as ActionButton<D>[] },
  );
}
