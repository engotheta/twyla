import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatOption } from '@angular/material/core';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, switchMap } from 'rxjs';
import { FormInstance } from '../../form-engine.service';
import { Option } from '../../interfaces/form-state.interface';
import { SelectField } from '../../interfaces/control-fields.interface';
import { controlStatus } from '../../helpers/control-status.helpers';
import { injectMessages } from '@services/i18n/message-bundle';
import { FORM_MESSAGES } from '../../form.messages';
import { firstErrorMessage } from '../../helpers/field-errors.helpers';
import { OptionsSource } from './options-source';
import { ScrollEndDirective } from './scroll-end.directive';

function defaultCompare(a: unknown, b: unknown): boolean {
  return a === b;
}

/** keys the open list answers to itself: they pass on from the search box to it */
const LIST_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab']);

/** what makes Material's panel the select's listbox, besides its role (`adoptListbox`) */
const PANEL_ATTRIBUTES = ['id', 'aria-label', 'aria-labelledby', 'aria-multiselectable'];

@Component({
  selector: 'select-field',
  imports: [
    ReactiveFormsModule,
    ScrollingModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    MatButtonToggleModule,
    MatTooltipModule,
    ScrollEndDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-field.component.html',
})
export class SelectFieldComponent {
  readonly field = input.required<SelectField>();
  readonly instance = input.required<FormInstance>();

  protected readonly t = injectMessages(FORM_MESSAGES);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly state = computed(() => this.instance().fieldState(this.field())());
  protected readonly control = computed(() => this.instance().control(this.field()) as FormControl);
  protected readonly status = controlStatus(this.control);

  protected readonly appearance = computed(
    () => this.state().appearance ?? this.instance().params().appearance ?? 'outline',
  );
  protected readonly showSubscript = computed(
    () => this.state().showSubscript ?? this.instance().params().showSubscript ?? true,
  );

  protected readonly required = computed(
    () =>
      this.state().showRequiredMarker !== false &&
      !!this.state().validations?.some((v) => v.name === 'required'),
  );

  protected readonly errorMessage = computed(() =>
    this.status().touched
      ? firstErrorMessage(this.status().errors, this.state().validations, this.t())
      : null,
  );

  protected readonly compare = computed(() => this.state().compareWith ?? defaultCompare);

  // ── the options ──────────────────────────────────────────────────────────────────────────────
  // Either the field's own `options`, or what `optionsParameter.optionsFunction` gives (SPEC §17).
  // The parameter is read as the engine resolves it, so one built from other controls
  // (`observe()`) arrives here as a new object — and the source starts over.

  private readonly optionsParameter = computed(() => {
    const params = this.state().optionsParameter;
    return typeof params?.optionsFunction === 'function' ? params : undefined;
  });
  private readonly remote = computed(() => !!this.optionsParameter());
  protected readonly paginated = computed(() => this.optionsParameter()?.paginated === true);
  private readonly serverSearch = computed(() => this.optionsParameter()?.searchMode === 'server');

  private readonly source = new OptionsSource<unknown>(
    this.optionsParameter,
    () => this.instance().formState(),
    () => this.compare(),
  );
  protected readonly remoteState = this.source.state;

  private readonly loadedOptions = computed<Option<unknown>[]>(() => {
    if (this.remote()) return this.remoteState().options;
    const options = this.state().options;
    return Array.isArray(options) ? options : [];
  });

  protected readonly resolvedOptions = computed<Option<unknown>[]>(() => {
    const loaded = this.loadedOptions();
    return this.state().hasNoneOption
      ? [{ label: this.t().select.none, value: null }, ...loaded]
      : loaded;
  });

  // ── the dropdown's list ──────────────────────────────────────────────────────────────────────

  /** a source searched by the server has a search box whatever `searchable` says */
  protected readonly searchable = computed(
    () => this.state().searchable === true || this.serverSearch(),
  );
  protected readonly search = signal('');
  private readonly opened = signal(false);

  protected readonly filteredOptions = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.resolvedOptions();
    // the server narrowed its own: what it answered with is the list
    if (this.serverSearch()) return this.loadedOptions();
    return this.resolvedOptions().filter((o) => o.label.toLowerCase().includes(query));
  });

  /** a long list rendered a window at a time; a paged source renders a page at a time instead */
  protected readonly virtual = computed(
    () => this.state().virtualScroll === true && !this.paginated(),
  );
  protected readonly viewportHeight = computed(() =>
    Math.min(this.filteredOptions().length * 42, 256),
  );

  private readonly viewport = viewChild(CdkVirtualScrollViewport);
  /** the slice of the list the virtual viewport has mounted; nothing before the list first opens */
  private readonly renderedRange = toSignal(
    toObservable(this.viewport).pipe(
      switchMap((viewport) => viewport?.renderedRangeStream ?? of(undefined)),
    ),
  );

  /** the options that are in the DOM: the whole list, or the window a virtual viewport rendered */
  private readonly mountedOptions = computed(() => {
    const options = this.filteredOptions();
    if (!this.virtual()) return options;
    const range = this.renderedRange();
    return range ? options.slice(range.start, range.end) : [];
  });

  private readonly selectedValues = computed<unknown[]>(() => {
    const value = this.status().value;
    if (this.state().multiple) return Array.isArray(value) ? value : [];
    return value === null || value === undefined ? [] : [value];
  });

  /**
   * The options of selected values that are not mounted: left out by a search, on a page not
   * loaded yet, or scrolled out of a virtual viewport's window. `mat-select` reads its value —
   * and the label it shows — from the options it has, so without these a multiple select would
   * drop what was already picked as soon as something else was searched for or scrolled to, and
   * a value from far down a list would show nothing.
   */
  protected readonly retainedOptions = computed<Option<unknown>[]>(() => {
    const same = this.compare();
    const listed = this.mountedOptions();
    const remote = this.remote();
    const known = remote ? this.source.remembered() : this.resolvedOptions();
    // a value its source never showed is shown as it is, once the source has had its say
    const asItIs = remote && !this.remoteState().loading;

    const retained: Option<unknown>[] = [];
    for (const value of this.selectedValues()) {
      if (listed.some((option) => same(option.value, value))) continue;
      const option = known.find((candidate) => same(candidate.value, value));
      if (option) retained.push(option);
      else if (asItIs && typeof value !== 'object') retained.push({ label: String(value), value });
    }
    return retained;
  });

  /** shown ahead of the list while nothing is searched for; hidden, but still there, during a
   *  search — and always in a virtual list, where they are only out of its window */
  protected readonly retainedShown = computed(() => !this.virtual() && !this.search().trim());

  /**
   * `mat-select` orders a multiple select's value by where its options are in the DOM, and the
   * retained ones are ahead of the rest. This keeps the value in the order of the list instead,
   * wherever each option happens to be mounted.
   */
  protected readonly sortSelected = (a: MatOption, b: MatOption): number => {
    const same = this.compare();
    const all = this.remote() ? this.source.remembered() : this.resolvedOptions();
    const position = (option: MatOption): number => {
      const index = all.findIndex((known) => same(known.value, option.value));
      return index === -1 ? all.length : index;
    };
    return position(a) - position(b);
  };

  /**
   * Whether the end of the list asks for the next page. Not while the select itself narrows a
   * paged list: a search that leaves little on screen keeps the end in view, and would pull page
   * after page looking for matches the browser, not the server, is deciding.
   */
  protected readonly pagesOnScroll = computed(() => {
    const remote = this.remoteState();
    if (!this.paginated() || !remote.hasMore || remote.loading) return false;
    return this.serverSearch() || !this.search().trim();
  });

  /** where the list stands, when that is what there is to show */
  protected readonly statusRow = computed<string | null>(() => {
    const remote = this.remoteState();
    const text = this.t().select;
    if (remote.failed) return text.loadFailed;
    if (remote.searchNeeded) return text.typeToSearch(remote.searchNeeded);
    if (remote.loading) return remote.options.length ? null : text.loading;
    const shown =
      this.filteredOptions().length + (this.retainedShown() ? this.retainedOptions().length : 0);
    return shown ? null : text.noOptions;
  });

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly listbox = viewChild<ElementRef<HTMLElement>>('listbox');
  private readonly select = viewChild(MatSelect);

  constructor() {
    // the labels of values held from before any page that has them was loaded
    effect(() => {
      const values = this.selectedValues();
      if (!this.remote() || this.remoteState().loading) return;
      untracked(() => this.source.remember(values));
    });

    // WCAG 4.1.3: what a search or a new page brought is said, not only shown. Opening the list
    // says nothing of its own — the select has just been announced.
    let said: string | undefined;
    effect(() => {
      const remote = this.remoteState();
      const text = this.t().select;
      if (!this.opened() || !this.remote()) {
        said = undefined;
        return;
      }
      if (remote.loading || remote.loadingMore) return;

      const message = remote.failed
        ? text.loadFailed
        : remote.searchNeeded
          ? text.typeToSearch(remote.searchNeeded)
          : remote.options.length
            ? text.found(remote.options.length)
            : text.noOptions;
      const first = said === undefined;
      const changed = message !== said;
      said = message;
      if (!first && changed) void this.announcer.announce(message, 'polite');
    });

    // the list under the search box changed: its first option is the one Enter now picks
    effect(() => {
      this.filteredOptions();
      if (!this.opened() || !this.search()) return;
      untracked(() =>
        afterNextRender(() => this.select()?._keyManager?.setFirstItemActive(), {
          injector: this.injector,
        }),
      );
    });
  }

  protected onOpenedChange(opened: boolean): void {
    this.opened.set(opened);
    if (opened) {
      if (this.remoteState().failed) this.source.retry();
      // once the click that opened the list is through: the form field answers that click too,
      // by focusing the select, and would take the focus straight back
      afterNextRender(
        () => {
          this.adoptListbox();
          this.searchInput()?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    } else {
      this.setSearch('');
      // the search box goes with the list: focus returns to the select, not to nowhere
      const active = this.document.activeElement;
      const box = this.searchInput()?.nativeElement;
      if (!active || active === this.document.body || active === box) this.select()?.focus();
    }
  }

  /**
   * Material's panel is the `listbox` the select controls, and everything in the select's
   * content lands inside it — the search box too, which a listbox may not hold (it holds
   * options). So where there is a search box, the options' own wrapper takes the panel's place:
   * its id (what the select's `aria-controls` names), its name and its multi-select flag move
   * over, and the panel becomes a plain container. Done on every open: each one is a new panel.
   */
  private adoptListbox(): void {
    const list = this.listbox()?.nativeElement;
    const panel = list?.closest<HTMLElement>('.mat-mdc-select-panel');
    if (!list || !panel || !this.searchable()) return;

    for (const name of PANEL_ATTRIBUTES) {
      const value = panel.getAttribute(name);
      if (value !== null) list.setAttribute(name, value);
      panel.removeAttribute(name);
    }
    panel.setAttribute('role', 'presentation');
  }

  protected onSearchInput(event: Event): void {
    this.setSearch((event.target as HTMLInputElement).value);
  }

  /**
   * Keys pressed in the search box. The box sits inside the list, and the list inside the
   * select: a key left to bubble is answered by both, so none is. The keys the list answers to
   * (arrows, Enter, Tab) are handed to the select once; Esc closes it; the rest is typing, which
   * the select would take for type-ahead — or, a space, for a pick.
   */
  protected onSearchKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    const select = this.select();
    if (!select || !LIST_KEYS.has(event.key)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      select.close();
    } else {
      select._handleKeydown(event);
    }
  }

  protected loadMore(): void {
    this.source.loadMore();
  }

  private setSearch(term: string): void {
    this.search.set(term);
    this.source.search(term);
  }

  protected isChecked(value: unknown): boolean {
    const current = this.status().value;
    const eq = this.compare();
    return Array.isArray(current) ? current.some((v) => eq(v, value)) : false;
  }

  protected toggleValue(value: unknown): void {
    const eq = this.compare();
    const current = Array.isArray(this.status().value)
      ? [...(this.status().value as unknown[])]
      : [];
    const index = current.findIndex((v) => eq(v, value));
    if (index === -1) current.push(value);
    else current.splice(index, 1);
    this.control().setValue(current);
    this.control().markAsDirty();
  }
}
