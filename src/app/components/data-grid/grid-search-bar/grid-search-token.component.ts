import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GRID_SEARCH_OPERATORS } from '../helpers/grid-search-bar.constants';
import {
  hasValuePart,
  inputTypeFor,
  isEmptyValue,
  itemLabel,
  valueLabel,
} from '../helpers/grid-search-bar.helpers';
import {
  GridSearchBarItem,
  GridSearchPart,
  GridSearchSegmentEvent,
  GridSearchSuggestion,
  GridSearchToken,
} from '../interfaces/grid-search-bar.interface';
import { GridSearchSegmentComponent } from './grid-search-segment.component';

/**
 * One thing in the unified search bar: a token — its field, operator and value parts — or a
 * free-text pill (no `token`), each followed by its remove button. Lays the parts out and names
 * them; what the keys and picks mean is the bar's business, which hears every part through
 * `segment`.
 *
 * A fixed operator (one choice) and a flag's "Yes" are plain text, not parts: there is nothing
 * to edit. The value part only shows once it has a value or is being edited, like GitLab's.
 */
@Component({
  selector: 'grid-search-token',
  imports: [GridSearchSegmentComponent, MatIconModule],
  template: `
    @let t = token();
    @if (t) {
      <grid-search-segment
        variant="field"
        [active]="part() === 'field'"
        [text]="t.title"
        [query]="query()"
        [label]="t.title + ', field'"
        [viewLabel]="'Change the field of ' + name()"
        [suggestions]="part() === 'field' ? suggestions() : null"
        [highlight]="highlight()"
        [session]="session()"
        (event)="segment.emit({ part: 'field', event: $event })"
      />

      @if (t.operators.length > 1) {
        <grid-search-segment
          variant="operator"
          [strict]="true"
          [overflow]="empty()"
          [active]="part() === 'operator'"
          [text]="operatorText()"
          [query]="query()"
          [label]="t.title + ', operator'"
          [viewLabel]="'Change the operator of ' + name()"
          [suggestions]="part() === 'operator' ? suggestions() : null"
          [highlight]="highlight()"
          [session]="session()"
          (event)="segment.emit({ part: 'operator', event: $event })"
        />
      } @else {
        <span class="inline-block h-6 bg-gray-100 text-sm leading-6 text-gray-900 px-1.5">{{
          operatorText()
        }}</span>
      }

      @if (!editable()) {
        @if (valueText()) {
          <span class="inline-block h-6 bg-gray-100 text-sm leading-6 text-gray-900 pr-1 pl-2">{{
            valueText()
          }}</span>
        }
      } @else if (part() === 'value' || !empty()) {
        <grid-search-segment
          variant="value"
          [active]="part() === 'value'"
          [text]="valueText()"
          [query]="query()"
          [label]="t.title + ', value'"
          [viewLabel]="'Change the value of ' + name()"
          [suggestions]="part() === 'value' ? suggestions() : null"
          [highlight]="highlight()"
          [selected]="selected()"
          [compare]="t.compare"
          [loading]="loading()"
          [inputType]="inputType()"
          [inputMode]="inputMode()"
          [session]="session()"
          (event)="segment.emit({ part: 'value', event: $event })"
        />
      }
    } @else {
      <grid-search-segment
        variant="term"
        [active]="part() === 'value'"
        [text]="valueText()"
        [query]="query()"
        label="Search text"
        [viewLabel]="'Change the text ' + valueText()"
        [session]="session()"
        (event)="segment.emit({ part: 'value', event: $event })"
      />
    }

    <button
      type="button"
      class="-ml-px inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border-0 bg-gray-100 text-gray-700 hover:bg-gray-300 hover:text-gray-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      [attr.aria-label]="'Remove ' + name()"
      (click)="remove.emit()"
    >
      <mat-icon aria-hidden="true" class="!text-base">close</mat-icon>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    class: 'inline-flex h-6 shrink-0 items-stretch gap-px overflow-hidden rounded',
    '[class.ring-2]': '!!error()',
    '[class.ring-red-600]': '!!error()',
    '[attr.aria-label]': 'error() ? name() + ". " + error() : name()',
    '[attr.title]': 'error() ?? null',
  },
})
export class GridSearchTokenComponent {
  readonly item = input.required<GridSearchBarItem>();
  /** what the item is a token of; undefined for a free-text pill */
  readonly token = input<GridSearchToken>();
  /** the part being edited, if any */
  readonly part = input<GridSearchPart | null>(null);
  /** the text in that part's input */
  readonly query = input('');
  /** see `GridSearchSegmentComponent.session` */
  readonly session = input(0);
  /** that part's list */
  readonly suggestions = input<GridSearchSuggestion[] | null>(null);
  readonly highlight = input<unknown>(undefined);
  /** the value part's options are still loading */
  readonly loading = input(false);
  /** why the filter's value was refused — the token is flagged and not applied */
  readonly error = input<string | null>(null);

  readonly segment = output<{ part: GridSearchPart; event: GridSearchSegmentEvent }>();
  readonly remove = output<void>();

  protected readonly name = computed(() => itemLabel(this.item(), this.token()));
  protected readonly operatorText = computed(() => {
    const operator = this.item().operator ?? this.token()?.defaultOperator;
    return operator ? GRID_SEARCH_OPERATORS[operator].text : '';
  });
  protected readonly valueText = computed(() => valueLabel(this.token(), this.item().value));
  protected readonly empty = computed(() => isEmptyValue(this.item().value));
  /** a flag has no value part: it's complete the moment its field is picked */
  protected readonly editable = computed(() => hasValuePart(this.token()));

  /** several values: the picked ones show a check in the list */
  protected readonly selected = computed(() => {
    if (!this.token()?.multiple) return null;
    const value = this.item().value;
    return Array.isArray(value) ? value : [];
  });

  protected readonly inputType = computed(() => inputTypeFor(this.token()?.valueKind));
  protected readonly inputMode = computed(() => {
    const kind = this.token()?.valueKind;
    return kind === 'number' ? 'decimal' : kind === 'year' ? 'numeric' : null;
  });
}
