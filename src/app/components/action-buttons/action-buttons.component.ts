import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { ActionButton, ActionButtonsParameter, DynamicValue } from './action-button.interface';
import { resolveDynamicValue$ } from '@utils/dynamic-value.helpers';
import { DividedEntry, tidyDividers } from './action-button.helpers';
import { ActionButtonComponent } from './action-button/action-button.component';

@Component({
  selector: 'action-buttons',
  imports: [ActionButtonComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (button of buttons_(); track button.slug ?? $index) {
        @if (button.divider) {
          <!-- a rule between two groups of buttons — when both have a button showing -->
          @if (dividers().has(button)) {
            <span
              class="h-6 shrink-0 border-s border-gray-300"
              role="separator"
              aria-orientation="vertical"
            ></span>
          }
        } @else {
          <action-button [button]="button" [parentData]="data_()" />
        }
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

  /** every entry with whether it shows — watched only while there is a divider to place */
  private readonly entries = toSignal(
    combineLatest([toObservable(this.buttons_), this.data$]).pipe(
      switchMap(([buttons, data]) =>
        buttons.some((button) => button.divider)
          ? combineLatest(
              buttons.map((button) =>
                resolveDynamicValue$(button.visible, (button.data ?? data) as D).pipe(
                  map((visible): DividedEntry & { button: ActionButton<D> } => ({
                    button,
                    divider: button.divider === true,
                    visible: visible ?? true,
                    heading: false,
                  })),
                ),
              ),
            )
          : of([]),
      ),
    ),
    { initialValue: [] },
  );

  /** the dividers with something to divide: a visible button on either side */
  protected readonly dividers = computed(
    () => new Set(tidyDividers(this.entries()).map((row) => row.entry.button)),
  );
}
