import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  GridSearchSegmentEvent,
  GridSearchSuggestion,
} from '../interfaces/grid-search-bar.interface';
import { GRID_SEARCH_TEXT_VALUE } from '../helpers/grid-search-bar.constants';

export type GridSearchSegmentVariant = 'field' | 'operator' | 'value' | 'term' | 'input';

const VIEW =
  'inline-block h-6 max-w-64 cursor-pointer truncate border-0 text-sm leading-6 text-gray-900 hover:bg-gray-300';
const VIEWS: Record<GridSearchSegmentVariant, string> = {
  field: `${VIEW} bg-gray-200 px-2`,
  operator: `${VIEW} bg-gray-100 px-1.5`,
  value: `${VIEW} bg-gray-100 pl-2 pr-1`,
  term: `${VIEW} bg-gray-100 pl-2 pr-1`,
  input: '',
};
const INPUT =
  'h-6 min-w-0 border-0 bg-transparent p-0 text-sm text-gray-900 outline-none placeholder:text-gray-500';

/** native date/time inputs size to their own chrome, not to the text typed into them */
const NATIVE_WIDTHS: Record<string, string> = {
  date: '8.5rem',
  'datetime-local': '12.5rem',
  time: '6rem',
  month: '9.5rem',
};

let lists = 0;

/**
 * One editable part of the unified search bar — a token's field, operator or value, a text pill,
 * or the bar's own text box. Shows its text as a button until `active`; then an input, with the
 * list of `suggestions` under it. Owns the keyboard and the list only: every decision (what a
 * pick means, where focus goes next — and the focusing itself) is the bar's, reached through
 * `event`.
 *
 * Nothing here waits for a render: the open / highlighted state is derived, not set by effects,
 * and the bar re-renders synchronously after each event it handles — so a key pressed straight
 * after another (type a field's name, Enter) is decided on current inputs, not the last frame's.
 *
 * The list is a port of GitLab UI's `GlFilteredSearchTokenSegment` + suggestion list: ↓ / ↑ move
 * (wrapping), Enter takes the highlighted row or — with none — submits, `:` takes a field,
 * Backspace on empty and ← / → at the edges hand over to the neighbouring part. It differs in
 * being a real WAI-ARIA combobox (focus stays in the input; the highlighted row is its
 * `aria-activedescendant`), and in Esc closing the list first.
 */
@Component({
  selector: 'grid-search-segment',
  imports: [NgTemplateOutlet, OverlayModule, MatIconModule],
  templateUrl: './grid-search-segment.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()' },
})
export class GridSearchSegmentComponent {
  /** being edited: the input shows, holds the focus, and opens the list */
  readonly active = input(false);
  /** what the part reads when it isn't being edited */
  readonly text = input('');
  /** the input's text while it is — owned by the bar, which hears every change as a `query` */
  readonly query = input('');
  /** the input's accessible name */
  readonly label = input.required<string>();
  /** the button's accessible name: what activating it changes */
  readonly viewLabel = input<string>();
  readonly placeholder = input('');
  /** the list's rows; null for a part that is just typed into */
  readonly suggestions = input<GridSearchSuggestion[] | null>(null);
  /** the value of the row to start highlighted; re-applied whenever it or the text changes */
  readonly highlight = input<unknown>(undefined);
  /** a part holding several values: the picked ones show a check, and a pick keeps the list open */
  readonly selected = input<readonly unknown[] | null>(null);
  /** how two row values compare; default identity */
  readonly compare = input<(a: unknown, b: unknown) => boolean>();
  /** rows are on their way */
  readonly loading = input(false);
  readonly inputType = input('text');
  readonly inputMode = input<string | null>(null);
  /** changes each time the bar opens a part: a list closed by Esc is open again the next time */
  readonly session = input(0);
  /** an input even when not being edited: the bar's own text box */
  readonly persistent = input(false);
  /**
   * Only text that can still become one of the rows may be typed (the operator part): Space takes
   * the highlighted row, and a character no row starts with is dropped — or, with `overflow`,
   * handed on to the next part (see `onStrictKey`).
   */
  readonly strict = input(false);
  readonly overflow = input(false);
  readonly variant = input<GridSearchSegmentVariant>('value');

  readonly event = output<GridSearchSegmentEvent>();

  private readonly document = inject(DOCUMENT);

  protected readonly listId = `grid-search-list-${++lists}`;
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  ];

  /** the `session` Esc closed the list in — typing, an arrow key or a new session reopens it */
  private readonly dismissed = signal<number | null>(null);
  /** the row an arrow key moved to, and the session / text / highlight it was moved under: as
   *  soon as any of them changes, the highlight follows `highlight` again (GitLab's list does
   *  the same) — a row arrowed to earlier must not still be the one Enter takes */
  private readonly stepped = signal<{
    index: number;
    session: number;
    query: string;
    highlight: unknown;
  } | null>(null);

  protected readonly rows = computed(() => this.suggestions() ?? []);
  protected readonly multiple = computed(() => this.selected() !== null);
  protected readonly hasList = computed(() => this.suggestions() !== null);
  protected readonly listOpen = computed(
    () =>
      this.active() &&
      this.dismissed() !== this.session() &&
      (this.rows().length > 0 || this.loading()),
  );

  /** the rows under their headings, each keeping its place in `rows` */
  protected readonly groups = computed(() => {
    const groups: { name?: string; rows: { row: GridSearchSuggestion; index: number }[] }[] = [];
    this.rows().forEach((row, index) => {
      const last = groups.at(-1);
      if (last && last.name === row.group) last.rows.push({ row, index });
      else groups.push({ name: row.group, rows: [{ row, index }] });
    });
    return groups;
  });

  private readonly highlightIndex = computed(() => {
    const target = this.highlight();
    if (target === undefined || target === null) return -1;
    return this.rows().findIndex((row) => !row.disabled && this.same(row.value, target));
  });
  protected readonly activeIndex = computed(() => {
    const stepped = this.stepped();
    return stepped &&
      stepped.session === this.session() &&
      stepped.query === this.query() &&
      stepped.highlight === this.highlight()
      ? stepped.index
      : this.highlightIndex();
  });
  protected readonly activeRowId = computed(() => {
    const index = this.activeIndex();
    return index >= 0 && index < this.rows().length ? this.rowId(index) : null;
  });

  protected readonly hostClass = computed(() =>
    this.variant() === 'input' ? 'flex min-w-24 flex-1' : 'inline-flex shrink-0',
  );
  protected readonly viewClass = computed(() => VIEWS[this.variant()]);
  protected readonly inputClass = computed(() =>
    this.persistent() ? `${INPUT} w-full` : `${INPUT} mx-1`,
  );
  /** a part's input is as wide as what's typed into it; the bar's own box fills the row */
  protected readonly inputWidth = computed(() => {
    if (this.persistent()) return null;
    const native = NATIVE_WIDTHS[this.inputType()];
    if (native) return native;
    return `${Math.max(this.query().length, this.placeholder().length, 3) + 2}ch`;
  });

  protected rowId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected isSelected(row: GridSearchSuggestion): boolean {
    return !!this.selected()?.some((value) => this.same(value, row.value));
  }

  private same(a: unknown, b: unknown): boolean {
    return this.compare()?.(a, b) ?? a === b;
  }

  // ── the button ──

  /** on press, not on click: nothing blurs first, so the part being left isn't closed (and the
   *  row re-laid out) between the press and the release */
  protected onViewMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.event.emit({ type: 'activate' });
  }

  /** a click with no press behind it: the keyboard, or assistive technology */
  protected onViewClick(event: MouseEvent): void {
    if (event.detail === 0) this.event.emit({ type: 'activate' });
  }

  // ── the input ──

  protected onFocus(): void {
    if (!this.active()) this.event.emit({ type: 'activate' });
  }

  /** a click in a box that already has the focus brings back a list Esc closed */
  protected onInputClick(): void {
    this.dismissed.set(null);
  }

  protected onBlur(): void {
    // the bar has already moved on to another part — this isn't focus leaving the bar
    if (!this.active()) return;
    this.event.emit({ type: 'leave' });
  }

  protected onInput(event: Event): void {
    this.dismissed.set(null);
    this.event.emit({ type: 'query', text: (event.target as HTMLInputElement).value });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    const input = event.target as HTMLInputElement;
    const open = this.listOpen();
    const row = open ? this.rows()[this.activeIndex()] : undefined;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!this.rows().length) return;
        event.preventDefault();
        if (open) this.step(event.key === 'ArrowDown' ? 1 : -1);
        else this.dismissed.set(null);
        return;
      case 'ArrowLeft':
        // a date input has no caret (selectionStart is null): its arrows stay its own
        if (input.selectionStart === 0 && input.selectionEnd === 0) {
          event.preventDefault();
          this.event.emit({ type: 'previous' });
        }
        return;
      case 'ArrowRight':
        if (input.selectionStart !== null && input.selectionStart === input.value.length) {
          event.preventDefault();
          this.event.emit({ type: 'next' });
        }
        return;
      case 'Backspace':
        if (input.value === '') {
          event.preventDefault();
          this.event.emit({ type: 'backspace' });
        }
        return;
      case 'Enter':
        event.preventDefault();
        if (row) this.take(row);
        else this.event.emit({ type: 'submit', text: input.value });
        return;
      case ':':
        // GitLab's `field:` shorthand — never for the free-text row, so "10:30" can be typed
        if (row && row.value !== GRID_SEARCH_TEXT_VALUE) {
          event.preventDefault();
          this.take(row);
        }
        return;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          this.dismissed.set(this.session());
        } else {
          this.event.emit({ type: 'escape' });
        }
        return;
    }

    if (this.strict()) this.onStrictKey(event, input, row);
  }

  /**
   * GitLab's `handleOperatorKeydown`, plus one case it never meets (its operators are all
   * symbols): ours include words, so "c" could be the start of `contains` — or of "chicago".
   * The next key settles it. Once a character arrives that no operator continues with:
   *  - symbols typed so far (`!`, `>`) were an operator in the making: the highlighted row is
   *    taken, and the character carried into the value — GitLab's behaviour;
   *  - letters or digits typed so far were the value all along: everything typed goes to the
   *    value, and the operator stays as it was.
   */
  private onStrictKey(
    event: KeyboardEvent,
    input: HTMLInputElement,
    row: GridSearchSuggestion | undefined,
  ): void {
    const { key } = event;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === ' ') {
      event.preventDefault();
      if (row) this.take(row);
      return;
    }
    if (key.length !== 1) return;

    // what the box would hold after this key: the key replaces whatever is selected
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const kept = input.value.slice(0, start) + input.value.slice(end);
    const typed = input.value.slice(0, start) + key + input.value.slice(end);
    if (this.rows().some((r) => r.label.toLowerCase().startsWith(typed.toLowerCase()))) return;
    event.preventDefault();
    if (!this.overflow()) return;
    if (/[\p{L}\p{N}]/u.test(kept)) this.event.emit({ type: 'overflow', text: typed });
    else if (row) this.take(row, key);
  }

  protected take(row: GridSearchSuggestion, carry?: string): void {
    if (row.disabled) return;
    this.event.emit({ type: 'pick', value: row.value, carry });
  }

  /** GitLab's `stepIndexAndWrap`, skipping rows that can't be taken */
  private step(direction: 1 | -1): void {
    const rows = this.rows();
    const count = rows.length;
    let index = this.activeIndex();
    for (let tries = 0; tries < count; tries++) {
      if (index < 0 || index >= count) index = direction < 0 ? count : -1;
      index = (index + direction + count) % count;
      if (!rows[index].disabled) {
        this.stepped.set({
          index,
          session: this.session(),
          query: this.query(),
          highlight: this.highlight(),
        });
        const id = this.rowId(index);
        // jsdom has no scrollIntoView
        queueMicrotask(() =>
          this.document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' }),
        );
        return;
      }
    }
  }
}
