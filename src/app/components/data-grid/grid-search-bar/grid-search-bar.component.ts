import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GridInstance } from '../grid-engine.service';
import {
  GRID_SEARCH_OPERATORS,
  GRID_SEARCH_TEXT_VALUE,
} from '../helpers/grid-search-bar.constants';
import {
  fieldSuggestions,
  hasValuePart,
  inputText,
  isEmptyValue,
  isItemComplete,
  itemLabel,
  operatorSuggestions,
  parseValue,
  sameFilterValue,
  searchItemsFromFields,
  searchTokensFromColumns,
  suggestedValue,
  toSearchFields,
  valueSuggestions,
} from '../helpers/grid-search-bar.helpers';
import { GridFilterOperator } from '../interfaces/grid-filter.interface';
import {
  GridSearchBarItem,
  GridSearchPart,
  GridSearchSegmentEvent,
  GridSearchSuggestion,
  GridSearchToken,
} from '../interfaces/grid-search-bar.interface';
import { SearchField } from '../interfaces/grid-search.interface';
import { GridSearchFilters } from './grid-search-filters';
import { GridSearchSegmentComponent } from './grid-search-segment.component';
import { GridSearchTokenComponent } from './grid-search-token.component';

/** what's being edited: one part of one token, the bar's own text box, or nothing */
type Active = { id: number; part: GridSearchPart } | 'input' | null;

/** the entries that actually search — what two `searchFields` arrays are compared by */
function searchKey(fields: SearchField[]): string {
  return JSON.stringify(
    fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== ''),
  );
}

/**
 * The unified search bar (`GridParameter.unifiedSearch`, SPEC.md §12): one box doing the job of
 * both the search fields and the filter panel, modelled on GitLab's filtered search — field /
 * operator / value tokens, free-text pills, and a list guiding each step.
 *
 * A front end only: it holds what's in the box (`items`, `text`) and writes the SAME engine state
 * the classic pair writes, `setSearchFields` and `setFilters`. Three things flow:
 *  - bar → engine: `apply()`, at once per finished token and debounced per keystroke
 *    (`searchTrigger: 'live'`), or only on Enter / the search button (`'manual'`);
 *  - engine → bar: a `setSearchFields` / `setFilters` / `clearFilters` made from code shows up as
 *    tokens (`followSearch`, and the filters effect);
 *  - filters ⇄ a headless generic-form built from `gridFilters` (`GridSearchFilters`). A filter
 *    token IS its control's value: `syncFilterControls` writes the tokens into the form,
 *    `reconcile` turns what the form holds back into tokens.
 */
@Component({
  selector: 'grid-search-bar',
  imports: [MatIconModule, MatTooltipModule, GridSearchSegmentComponent, GridSearchTokenComponent],
  templateUrl: './grid-search-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'search',
    class:
      'flex min-h-10 min-w-0 items-stretch overflow-hidden rounded-md border border-(--mat-sys-outline) bg-white focus-within:border-primary focus-within:ring-1 focus-within:ring-primary',
    '[attr.aria-label]': 'regionLabel()',
  },
})
export class GridSearchBarComponent<RowType = any> {
  readonly instance = input.required<GridInstance<RowType>>();
  /** free text and column tokens are offered — the grid's `showSearch`. false: filters only */
  readonly search = input(true);

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly params = computed(() => this.instance().params());
  private readonly cfg = computed(() => this.params().searchConfig);
  private readonly live = computed(() => (this.cfg()?.searchTrigger ?? 'live') === 'live');

  // ── what's in the box ──

  protected readonly items = signal<GridSearchBarItem[]>([]);
  /** the bar's own text box */
  protected readonly text = signal('');
  protected readonly active = signal<Active>(null);
  /** the text in the part being edited… */
  protected readonly query = signal('');
  /** …and what it was when the part was opened: typing past it is what narrows a value list */
  private readonly opened = signal('');
  /** where the caret lands in the part `flush()` focuses next — `all` selects its text, so that
   *  typing over a picked part (a field, an operator, a listed value) replaces it */
  private cursor: 'start' | 'end' | 'all' = 'end';
  /** bumped each time a part is opened — see the segment's `session` */
  protected readonly session = signal(0);
  /** the text in the box counts as a search even though it reads as a field's name — set by
   *  leaving the box or submitting, dropped by the next keystroke (see `textIsSearch`) */
  private readonly textCommitted = signal(false);
  protected readonly announcement = signal('');
  /** the filter form refused the last apply (a validator failed) */
  private readonly refused = signal(false);
  /** how the token being edited read when it was opened (null: it had no value yet) — what
   *  leaving it is announced against */
  private before?: { id: number; label: string | null };
  private nextId = 1;

  /** the headless form behind the filter tokens */
  private readonly filters = new GridSearchFilters<RowType>(this.instance, inject(Injector));

  // ── what the engine was last told, so a change made from code can be told apart ──

  private lastSearch = '[]';
  private lastFilters = '{}';
  /** the `filters.version` those were recorded under */
  private formVersion = 0;

  private timer?: ReturnType<typeof setTimeout>;
  private applyQueued = false;
  private applyExplicit = false;
  private applyRun = 0;
  private destroyed = false;
  /** `flush()` is rendering */
  private flushing = false;

  // ── what the bar offers ──

  private readonly searchTokens = computed(() =>
    this.search() ? searchTokensFromColumns(this.instance().leafColumns(), this.cfg()) : [],
  );
  protected readonly tokens = computed(() => [...this.searchTokens(), ...this.filters.tokens()]);
  private readonly tokenMap = computed(
    () => new Map(this.tokens().map((token) => [token.id, token])),
  );
  /** with nothing to pick, the bar is a plain search box: no list, no pills */
  protected readonly canTokenize = computed(() => this.tokens().length > 0);
  /** one token per column or filter */
  private readonly used = computed(
    () => new Set(this.items().flatMap((item) => (item.token ? [item.token] : []))),
  );

  // ── texts ──

  protected readonly placeholder = computed(
    () =>
      this.cfg()?.searchPlaceholder ??
      (!this.canTokenize() ? 'Search…' : this.search() ? 'Search or filter…' : 'Filter…'),
  );
  protected readonly inputLabel = computed(() => this.placeholder().replace(/…$/, ''));
  protected readonly regionLabel = computed(() => {
    const label = this.params().label;
    return label ? `Search ${label}` : 'Search';
  });
  protected readonly hasContent = computed(() => this.items().length > 0 || this.text() !== '');

  // ── lists ──

  protected readonly inputSuggestions = computed(() =>
    this.canTokenize()
      ? fieldSuggestions(this.tokens(), this.used(), this.text(), this.search())
      : null,
  );
  protected readonly inputHighlight = computed(() =>
    suggestedValue(this.inputSuggestions() ?? [], this.text()),
  );

  /**
   * Whether the text being typed is searched as it's typed. Not while it reads as the start of
   * a field's name: Enter would pick that field then, not search — and the grid would empty
   * out under someone typing "dep" on their way to Department. With no field matching (or none
   * to pick at all) Enter means "search this", and so does typing.
   */
  private readonly textIsSearch = computed(
    () => !this.canTokenize() || this.inputHighlight() === GRID_SEARCH_TEXT_VALUE,
  );

  private readonly editing = computed(() => {
    const active = this.active();
    if (!active || active === 'input') return undefined;
    const item = this.items().find((i) => i.id === active.id);
    if (!item) return undefined;
    return { item, token: this.tokenOf(item), part: active.part };
  });

  protected readonly partSuggestions = computed<GridSearchSuggestion[] | null>(() => {
    const editing = this.editing();
    if (!editing?.token) return null;
    const { token, part } = editing;
    switch (part) {
      case 'field': {
        // every field still free, plus this token's own — not narrowed by typing (GitLab's
        // title segment doesn't), only re-highlighted
        const others = new Set(this.used());
        others.delete(token.id);
        return fieldSuggestions(this.tokens(), others, '', false);
      }
      case 'operator':
        return operatorSuggestions(token);
      case 'value':
        return token.valueKind === 'options'
          ? valueSuggestions(token, this.query(), this.query() !== this.opened())
          : null;
    }
  });

  protected readonly partHighlight = computed<unknown>(() => {
    const editing = this.editing();
    const rows = this.partSuggestions();
    if (!editing?.token || !rows) return undefined;
    const { item, token, part } = editing;
    switch (part) {
      case 'field':
        return suggestedValue(rows, this.query(), token.id);
      case 'operator':
        return suggestedValue(rows, this.query(), item.operator ?? token.defaultOperator);
      case 'value': {
        if (this.query() !== this.opened()) return suggestedValue(rows, this.query());
        const first = rows.find((row) => !row.disabled)?.value;
        return token.multiple || isEmptyValue(item.value) ? first : item.value;
      }
    }
  });

  /** a refused filter with no token to flag — the user still needs to see why nothing applied */
  protected readonly problem = computed(() => {
    if (!this.refused()) return null;
    const used = this.used();
    const entry = Object.entries(this.filters.errors()).find(([id]) => !used.has(id));
    if (!entry) return null;
    const title = this.tokenMap().get(entry[0])?.title ?? entry[0].replace(/^filter:/, '');
    return `${title}: ${entry[1]}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.timer);
    });

    // engine → bar: search made from code (and the search this bar starts with)
    effect(() => {
      const fields = this.instance().searchFields();
      this.tokenMap();
      untracked(() => this.followSearch(fields));
    });

    // engine → form: filters made from code. A form just (re)built has already taken the
    // engine's filters, so that is only recorded.
    effect(() => {
      const filters = this.instance().filters();
      const version = this.filters.version();
      untracked(() => {
        const json = JSON.stringify(filters);
        const rebuilt = version !== this.formVersion;
        this.formVersion = version;
        if (!rebuilt && json !== this.lastFilters)
          this.filters.write((token) => filters[token.key]);
        this.lastFilters = json;
      });
    });

    // form → bar: a filter token is its control's value
    effect(() => {
      const value = this.filters.value();
      const tokens = this.filters.tokens();
      untracked(() => this.reconcile(value, tokens));
    });

    // a column or filter the grid no longer offers takes its token with it
    effect(() => {
      const tokens = this.tokenMap();
      untracked(() => {
        const list = this.items();
        const kept = list.filter((item) => !item.token || tokens.has(item.token));
        if (kept.length !== list.length) this.items.set(kept);
      });
    });
  }

  // ── template helpers ──

  protected tokenOf(item: GridSearchBarItem): GridSearchToken | undefined {
    return item.token ? this.tokenMap().get(item.token) : undefined;
  }

  protected partOf(item: GridSearchBarItem): GridSearchPart | null {
    const active = this.active();
    return active && active !== 'input' && active.id === item.id ? active.part : null;
  }

  protected isLoading(item: GridSearchBarItem): boolean {
    const token = this.tokenOf(item);
    return token?.source === 'filter' && this.filters.isLoading(token.key);
  }

  protected errorOf(item: GridSearchBarItem): string | null {
    return this.refused() && item.token ? (this.filters.errors()[item.token] ?? null) : null;
  }

  // ── the bar's own text box ──

  protected onInputEvent(event: GridSearchSegmentEvent): void {
    if (this.isOwnBlur(event)) return;
    switch (event.type) {
      case 'activate':
        this.setActive('input');
        break;
      case 'query':
        this.text.set(event.text);
        this.textCommitted.set(false);
        this.changed('typing');
        break;
      case 'pick':
        if (event.value === GRID_SEARCH_TEXT_VALUE) {
          // one Enter: the text becomes a pill AND the search runs
          this.commitText();
          this.submit();
        } else {
          this.startToken(String(event.value));
        }
        break;
      case 'submit':
        this.commitText();
        this.submit();
        break;
      case 'backspace':
        this.stepBack(true);
        break;
      case 'previous':
        this.stepBack(false);
        break;
      case 'leave':
        this.active.set(null);
        // what the box shows is what's searched: text left behind counts, whatever it reads as
        if (this.text().trim() && !this.textCommitted()) {
          this.textCommitted.set(true);
          this.changed('items');
        }
        break;
    }
    this.flush();
  }

  /** a click on the box's empty space lands in the text box, as in any input */
  protected onBoxMouseDown(event: MouseEvent): void {
    if (event.target !== event.currentTarget || event.button !== 0) return;
    event.preventDefault();
    this.cursor = 'end';
    this.setActive('input');
    this.flush();
  }

  /** the typed text becomes a pill — unless there's nothing to pick here, where it just stays */
  private commitText(): void {
    const value = this.text().trim();
    if (!value || !this.search() || !this.canTokenize()) return;
    const item: GridSearchBarItem = { id: this.nextId++, value };
    this.items.update((list) => [...list, item]);
    this.text.set('');
    this.announce(`Added ${itemLabel(item, undefined)}`);
  }

  private startToken(id: string): void {
    const token = this.tokenMap().get(id);
    if (!token) return;
    const item: GridSearchBarItem = {
      id: this.nextId++,
      token: token.id,
      operator: token.defaultOperator,
      value: token.valueKind === 'flag' ? true : null,
    };
    this.items.update((list) => [...list, item]);
    // what was typed was the field's name, not a search (GitLab replaces the term)
    this.text.set('');
    this.advance(item, token);
    this.changed('items');
  }

  /** Backspace peels the last token open (a flag, having nothing to peel, goes whole); ← only
   *  opens it */
  private stepBack(peel: boolean): void {
    const last = this.items().at(-1);
    if (!last) return;
    const part = this.partsOf(this.tokenOf(last)).at(-1)!;
    if (peel && part !== 'value') {
      this.removeItem(last);
      this.changed('items');
      return;
    }
    this.editPart(last, part, 'end');
  }

  // ── a token's parts ──

  protected onTokenEvent(
    target: GridSearchBarItem,
    part: GridSearchPart,
    event: GridSearchSegmentEvent,
  ): void {
    const item = this.itemById(target.id);
    if (!item || this.isOwnBlur(event)) return;
    const token = this.tokenOf(item);

    switch (event.type) {
      case 'activate':
        this.editPart(
          item,
          part,
          token && (part !== 'value' || token.valueKind === 'options') ? 'all' : 'end',
        );
        break;
      case 'query':
        this.onPartQuery(item, token, part, event.text);
        break;
      case 'pick':
        this.onPartPick(item, token, part, event.value, event.carry);
        break;
      case 'overflow':
        // typed straight past the operator list: the operator stays, the text is the value's
        this.editPart(item, 'value', 'end');
        this.onPartQuery(item, token, 'value', `${this.query()}${event.text}`);
        break;
      case 'submit':
        // Enter with nothing highlighted: done with this token — and, like GitLab, search
        this.cursor = 'end';
        this.setActive('input');
        this.submit();
        break;
      case 'backspace':
        this.onPartBackspace(item, token, part);
        break;
      case 'previous':
        this.move(item, token, part, -1);
        break;
      case 'next':
        this.move(item, token, part, 1);
        break;
      case 'escape':
        this.cursor = 'end';
        this.setActive('input');
        break;
      case 'leave':
        this.setActive(null);
        break;
    }
    this.flush();
  }

  protected onRemove(item: GridSearchBarItem): void {
    this.removeItem(item);
    this.cursor = 'end';
    this.setActive('input');
    this.changed('items');
    this.flush();
  }

  private onPartQuery(
    item: GridSearchBarItem,
    token: GridSearchToken | undefined,
    part: GridSearchPart,
    text: string,
  ): void {
    this.query.set(text);
    // a field, an operator or a listed value is only ever PICKED: typing just moves the highlight
    if (part !== 'value' || token?.valueKind === 'options') return;
    const value = parseValue(token, text);
    this.updateItem(item.id, { value: typeof value === 'string' ? value.trim() : value });
    this.changed('typing');
  }

  private onPartPick(
    item: GridSearchBarItem,
    token: GridSearchToken | undefined,
    part: GridSearchPart,
    value: unknown,
    carry: string | undefined,
  ): void {
    if (!token) return;

    if (part === 'field') {
      this.changeField(item, token, String(value));
      return;
    }

    if (part === 'operator') {
      this.updateItem(item.id, { operator: value as GridFilterOperator });
      const next = this.itemById(item.id)!;
      this.editPart(next, 'value', 'end');
      // a character typed past the operator list belongs to the value
      if (carry) this.onPartQuery(next, token, 'value', `${this.query()}${carry}`);
      else if (isItemComplete(next, token)) this.changed('items');
      return;
    }

    if (token.multiple) {
      const same = token.compare ?? ((a: unknown, b: unknown) => a === b);
      const held = Array.isArray(item.value) ? item.value : [];
      this.updateItem(item.id, {
        value: held.some((v) => same(v, value))
          ? held.filter((v) => !same(v, value))
          : [...held, value],
      });
      // the list stays open, showing every option again
      this.query.set('');
      this.opened.set('');
      this.changed('items');
      return;
    }

    this.updateItem(item.id, { value });
    this.cursor = 'end';
    this.setActive('input');
  }

  private onPartBackspace(
    item: GridSearchBarItem,
    token: GridSearchToken | undefined,
    part: GridSearchPart,
  ): void {
    if (part === 'value' && token?.multiple && Array.isArray(item.value) && item.value.length) {
      this.updateItem(item.id, { value: item.value.slice(0, -1) });
      this.changed('items');
      return;
    }
    // an emptied value steps back to the operator, opened empty so the next Backspace removes
    // the token (GitLab turns it back into its field's name as text, which would run as a search)
    if (part === 'value' && token && token.operators.length > 1) {
      this.editPart(item, 'operator', 'end', '');
      return;
    }
    this.removeItem(item);
    this.cursor = 'end';
    this.setActive('input');
    this.changed('items');
  }

  /** ← / → past the end of a part: the next part of this token, then the neighbouring token,
   *  then the text box */
  private move(
    item: GridSearchBarItem,
    token: GridSearchToken | undefined,
    part: GridSearchPart,
    direction: 1 | -1,
  ): void {
    const cursor = direction < 0 ? 'end' : 'start';
    const parts = this.partsOf(token);
    const sibling = parts[parts.indexOf(part) + direction];
    if (sibling) {
      this.editPart(item, sibling, cursor);
      return;
    }

    const list = this.items();
    const neighbour = list[list.findIndex((i) => i.id === item.id) + direction];
    if (neighbour) {
      const theirs = this.partsOf(this.tokenOf(neighbour));
      this.editPart(neighbour, direction < 0 ? theirs.at(-1)! : theirs[0], cursor);
    } else if (direction > 0) {
      this.cursor = 'start';
      this.setActive('input');
    }
  }

  private changeField(item: GridSearchBarItem, token: GridSearchToken, id: string): void {
    const next = this.tokenMap().get(id);
    if (!next || next.id === token.id) {
      this.advance(item, token);
      return;
    }
    // a typed value survives the move to another field that is also typed into
    const keeps =
      token.valueKind === 'text' && next.valueKind === 'text' && typeof item.value === 'string';
    this.updateItem(item.id, {
      token: next.id,
      operator:
        item.operator && next.operators.includes(item.operator)
          ? item.operator
          : next.defaultOperator,
      value: next.valueKind === 'flag' ? true : keeps ? item.value : null,
    });
    this.advance(this.itemById(item.id)!, next);
    this.changed('items');
  }

  /** from the field part onwards: the operator when there is one to choose and no value yet
   *  (opened empty, its default highlighted — typing a value from there just works), else the
   *  value; a flag is done */
  private advance(item: GridSearchBarItem, token: GridSearchToken): void {
    if (!hasValuePart(token)) {
      this.announce(`Added ${itemLabel(item, token)}`);
      this.cursor = 'end';
      this.setActive('input');
    } else if (token.operators.length > 1 && isEmptyValue(item.value)) {
      this.editPart(item, 'operator', 'end', '');
    } else {
      this.editPart(item, 'value', 'end');
    }
  }

  /** the parts of a token that can be edited, in order; a text pill has just its text */
  private partsOf(token: GridSearchToken | undefined): GridSearchPart[] {
    if (!token) return ['value'];
    const parts: GridSearchPart[] = ['field'];
    if (token.operators.length > 1) parts.push('operator');
    if (hasValuePart(token)) parts.push('value');
    return parts;
  }

  private editPart(
    item: GridSearchBarItem,
    part: GridSearchPart,
    cursor: 'start' | 'end' | 'all',
    text?: string,
  ): void {
    const token = this.tokenOf(item);
    const shown = text ?? this.partText(item, token, part);
    this.setActive({ id: item.id, part });
    this.opened.set(shown);
    this.query.set(shown);
    this.cursor = cursor;
  }

  /** what a part's input holds when it's opened */
  private partText(
    item: GridSearchBarItem,
    token: GridSearchToken | undefined,
    part: GridSearchPart,
  ): string {
    if (!token) return String(item.value ?? '');
    switch (part) {
      case 'field':
        return token.title;
      case 'operator':
        return GRID_SEARCH_OPERATORS[item.operator ?? token.defaultOperator].text;
      case 'value':
        // several values: an empty box to find the next one in (GitLab clears it too)
        return token.multiple ? '' : inputText(token, item.value);
    }
  }

  /**
   * A box that `flush()`'s own render takes away while it holds the focus (the value part of a
   * token stepping back to its operator, a token being removed) blurs as it goes. That is not
   * the user leaving the bar, and must not be handled as one — it would close, and so drop, the
   * very token being moved within.
   */
  private isOwnBlur(event: GridSearchSegmentEvent): boolean {
    return this.flushing && event.type === 'leave';
  }

  // ── state ──

  private itemById(id: number): GridSearchBarItem | undefined {
    return this.items().find((item) => item.id === id);
  }

  private updateItem(id: number, patch: Partial<GridSearchBarItem>): void {
    this.items.update((list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  /** moving on from a token (to another, to the text box, out of the bar) tidies it first */
  private setActive(next: Active): void {
    const current = this.active();
    if (current && current !== 'input' && (!next || next === 'input' || next.id !== current.id)) {
      this.finish(current.id);
    }
    if (next && next !== 'input' && this.before?.id !== next.id) {
      const item = this.itemById(next.id);
      const token = item && this.tokenOf(item);
      this.before = {
        id: next.id,
        label: item && isItemComplete(item, token) ? itemLabel(item, token) : null,
      };
    }
    this.active.set(next);
    if (next) this.session.update((session) => session + 1);
  }

  /**
   * Renders now, and puts the focus where `active` says. Every handled event ends here, so the
   * next one — a key pressed straight after — meets a list and a focused box that already
   * reflect this one. Left to the scheduled render, keys typed in between would be decided on
   * the previous list (type a field's name, Enter) or land in the box being left.
   */
  private flush(): void {
    if (this.destroyed || this.flushing) return;
    this.flushing = true;
    try {
      this.cdr.detectChanges();
    } finally {
      this.flushing = false;
    }
    const input = this.host.querySelector<HTMLInputElement>('input[data-grid-search-active]');
    if (!input || this.document.activeElement === input) return;

    input.focus({ preventScroll: true });
    try {
      const at = this.cursor === 'start' ? 0 : input.value.length;
      input.setSelectionRange(this.cursor === 'all' ? 0 : at, at);
    } catch {
      // a date / time input has no selection to set
    }
    // jsdom has no scrollIntoView
    input.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** typed text is already in the item (see `onPartQuery`), so all that's left on leaving a
   *  token: one without a value goes */
  private finish(id: number): void {
    const item = this.itemById(id);
    if (!item) return;
    const token = this.tokenOf(item);
    const was = this.before?.id === id ? this.before.label : null;
    this.before = undefined;

    if (isItemComplete(item, token)) {
      const label = itemLabel(item, token);
      if (label !== was) this.announce(`${was ? 'Changed to' : 'Added'} ${label}`);
    } else {
      this.items.update((list) => list.filter((i) => i.id !== id));
      if (was) this.announce(`Removed ${was}`);
    }
    this.changed('items');
  }

  private removeItem(item: GridSearchBarItem): void {
    const active = this.active();
    if (active && active !== 'input' && active.id === item.id) this.active.set(null);
    if (this.before?.id === item.id) this.before = undefined;
    const token = this.tokenOf(item);
    this.items.update((list) => list.filter((i) => i.id !== item.id));
    if (isItemComplete(item, token)) this.announce(`Removed ${itemLabel(item, token)}`);
  }

  private announce(message: string): void {
    this.announcement.set(message);
  }

  // ── applying ──

  /** Clear all: empties the box and the filter form, and applies at once in either mode */
  protected clear(): void {
    this.active.set(null);
    this.items.set([]);
    this.text.set('');
    this.textCommitted.set(false);
    this.query.set('');
    this.refused.set(false);
    this.syncFilterControls();
    this.announce('Search cleared');
    this.cursor = 'end';
    this.setActive('input');
    this.requestApply();
    this.flush();
  }

  /** Enter, or the search button: apply now — and, with nothing new to apply, run it again */
  protected submit(): void {
    this.textCommitted.set(true);
    this.syncFilterControls();
    this.requestApply(true);
  }

  /**
   * Something in the box changed. The filter form hears about it at once in either mode (so a
   * dependent filter shows up as soon as the one it depends on has a value); the grid hears
   * about it only when live — at once for a token, after the debounce for a keystroke.
   */
  private changed(kind: 'typing' | 'items'): void {
    this.syncFilterControls();
    if (!this.live()) return;
    if (kind === 'items') {
      this.requestApply();
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.requestApply(), this.cfg()?.changeDebounce ?? 300);
  }

  /** several changes in one turn (leave a token, commit text, submit) are one apply */
  private requestApply(explicit = false): void {
    this.applyExplicit ||= explicit;
    if (this.applyQueued) return;
    this.applyQueued = true;
    queueMicrotask(() => {
      const wasExplicit = this.applyExplicit;
      this.applyQueued = false;
      this.applyExplicit = false;
      void this.apply(wasExplicit);
    });
  }

  private async apply(explicit: boolean): Promise<void> {
    if (this.destroyed) return;
    clearTimeout(this.timer);
    const run = ++this.applyRun;
    const instance = this.instance();
    const tokens = this.tokenMap();

    const counts = this.search() && (this.textIsSearch() || this.textCommitted());
    const searchFields = toSearchFields(
      this.items(),
      tokens,
      counts ? this.text() : '',
      this.cfg()?.defaultSearchType,
    );

    let filters: Record<string, unknown> | undefined;
    if (this.filters.present()) {
      this.syncFilterControls();
      const filtering = this.items().some((item) => {
        const token = this.tokenOf(item);
        return token?.source === 'filter' && isItemComplete(item, token);
      });
      if (!filtering) {
        // no filter token: the same `{}` the filter panel's Clear leaves
        filters = {};
        this.refused.set(false);
      } else {
        // the panel's Apply: everything the form holds, through `toSubmit`; null when invalid
        const value = await this.filters.submit();
        if (run !== this.applyRun || this.destroyed) return;
        this.refused.set(value === null);
        if (value) filters = value;
      }
    }

    const search = searchKey(searchFields);
    const searchChanged = search !== searchKey(instance.searchFields());
    const filtersJson = filters && JSON.stringify(filters);
    const filtersChanged =
      filtersJson !== undefined && filtersJson !== JSON.stringify(instance.filters());

    // both in one turn: one fetch, not two
    if (searchChanged) {
      this.lastSearch = search;
      instance.setSearchFields(searchFields);
    }
    if (filtersChanged) {
      this.lastFilters = filtersJson;
      if (filtersJson === '{}') instance.clearFilters();
      else instance.setFilters(filters!);
    }
    if (explicit && !searchChanged && !filtersChanged && instance.params().fetchFn) {
      instance.refetch();
    }
  }

  // ── engine → bar ──

  /** `searchFields` that didn't come from this bar: show them — free text as pills, the rest as
   *  their columns' tokens */
  private followSearch(fields: SearchField[]): void {
    const key = searchKey(fields);
    if (key === this.lastSearch) return;
    this.lastSearch = key;

    const tokens = this.tokenMap();
    const found = searchItemsFromFields(fields, tokens).map((rest) => ({
      id: this.nextId++,
      ...rest,
    }));
    this.items.update((list) => [
      ...found,
      ...list.filter((item) => this.tokenOf(item)?.source === 'filter'),
    ]);
    this.text.set('');
  }

  // ── filters ⇄ the form ──

  /** bar → form: each offered filter's control holds its token's value, or nothing */
  private syncFilterControls(): void {
    const items = this.items();
    this.filters.write((token) => {
      const item = items.find((i) => i.token === token.id);
      return item && isItemComplete(item, token) ? item.value : undefined;
    });
  }

  /**
   * form → bar: a control that has a value has a token, and one that lost its value (a
   * `clearOnHide` field hidden, `clearFilters()` called from code) loses its token. The token
   * being edited is left alone — its control only follows once it's finished.
   */
  private reconcile(value: Record<string, unknown>, tokens: GridSearchToken[]): void {
    const active = this.active();
    const editing = active && active !== 'input' ? active.id : undefined;
    let list = this.items();
    let touched = false;

    for (const token of tokens) {
      const held = value[token.key];
      const index = list.findIndex((item) => item.token === token.id);
      const item = list[index];

      if (!isEmptyValue(held)) {
        if (!item) {
          list = [
            ...list,
            { id: this.nextId++, token: token.id, operator: token.defaultOperator, value: held },
          ];
          touched = true;
        } else if (item.id !== editing && !sameFilterValue(item.value, held)) {
          list = list.map((i) => (i === item ? { ...i, value: held } : i));
          touched = true;
        }
      } else if (item && item.id !== editing && isItemComplete(item, token)) {
        list = list.filter((i) => i !== item);
        touched = true;
      }
    }

    if (touched) this.items.set(list);

    // the form's own initial values, shown as the bar's first tokens: applied whatever the
    // trigger. Anything later is a change like any other.
    if (this.filters.takeUnapplied()) {
      if (touched) this.requestApply();
    } else if (touched) {
      this.changed('items');
    }
  }
}
