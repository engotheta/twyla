import { DestroyRef, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  catchError,
  concat,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  finalize,
  map,
  merge,
  Observable,
  of,
  skip,
  Subject,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  FormState,
  Option,
  OptionsParameter,
  OptionsRequest,
} from '../../interfaces/form-state.interface';
import {
  DEFAULT_OPTIONS_PAGE_SIZE,
  DEFAULT_SEARCH_DEBOUNCE,
  hasMoreOptions,
  mapRawOptions,
  mergeOptions,
  optionsRequest,
  resolveOptionsSource,
  toOptionsPage,
} from './options.helpers';

/** What a select's options source holds right now. */
export interface OptionsState<V = unknown> {
  /** what has been loaded, mapped to options */
  options: Option<V>[];
  /** a list is on its way: the first, or the one a new search asked for */
  loading: boolean;
  /** the next page is on its way */
  loadingMore: boolean;
  /** the last request failed */
  failed: boolean;
  /** a `paginated` source has another page */
  hasMore: boolean;
  /** `minSearchLength`, while less than that is typed and so nothing was asked for; else 0 */
  searchNeeded: number;
}

const IDLE: OptionsState<never> = {
  options: [],
  loading: false,
  loadingMore: false,
  failed: false,
  hasMore: false,
  searchNeeded: 0,
};

/** before the parameter has been read (the select's first render): there may be a list to load */
const PENDING: OptionsState<never> = { ...IDLE, loading: true };

type Params<V> = OptionsParameter<any, V>;

/**
 * A select's options as its `optionsParameter.optionsFunction` gives them (SPEC §17): asked for
 * when the parameter is a new object, again with what is typed where the search is the
 * server's, and page by page where the source is paginated — the latest request wins.
 *
 * One per select, created in its injection context and gone with it, like `GridSearchFilters`.
 * It subscribes to no control: what another field changes reaches it as a new parameter, which
 * the form engine resolves.
 */
export class OptionsSource<V = unknown> {
  private readonly destroyRef = inject(DestroyRef);

  private readonly current = signal<OptionsState<V>>(PENDING);
  readonly state = this.current.asReadonly();

  private readonly seen = signal<Option<V>[]>([]);
  /** every option shown so far: what gives a held value its label once its own option has been
   *  searched or paged away */
  readonly remembered = this.seen.asReadonly();

  private readonly term$ = new BehaviorSubject('');
  private readonly more$ = new Subject<void>();
  private readonly again$ = new Subject<void>();
  /** values `selectedFunction` was already asked about */
  private readonly asked: V[] = [];

  constructor(
    private readonly params: Signal<Params<V> | undefined>,
    private readonly formState: () => FormState,
    private readonly same: () => (a: V, b: V) => boolean,
  ) {
    toObservable(params)
      .pipe(
        switchMap((source) => this.lists(source)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** The search box's text: asked of the source where the search is the server's. */
  search(term: string): void {
    if (term !== this.term$.value) this.term$.next(term);
  }

  /** The next page, where there is one and none is on its way. */
  loadMore(): void {
    this.more$.next();
  }

  /** Asks again, from the first page, for what failed. */
  retry(): void {
    this.again$.next();
  }

  /** Asks `selectedFunction` for the options of `values` nothing shown so far covers — once each. */
  remember(values: V[]): void {
    const params = this.params();
    const load = params?.selectedFunction;
    if (!params || !load) return;

    const same = this.same();
    const known = this.seen();
    const unknown = values.filter(
      (value) =>
        !known.some((option) => same(option.value, value)) &&
        !this.asked.some((asked) => same(asked, value)),
    );
    if (!unknown.length) return;
    this.asked.push(...unknown);

    resolveOptionsSource(() => load(unknown))
      .pipe(
        take(1),
        catchError(() => EMPTY), // such a value shows as it is
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((raw) => this.keep(mapRawOptions(raw, unsorted(params))));
  }

  /** every list a source gives: one per search, the first at once */
  private lists(params: Params<V> | undefined): Observable<unknown> {
    // a new source: what the last one loaded is not this one's
    this.current.set(IDLE);
    if (typeof params?.optionsFunction !== 'function') return EMPTY;
    return this.terms(params).pipe(switchMap((term) => this.list(params, term)));
  }

  /** what to search for, each time it changes — always '' where the select narrows by itself */
  private terms(params: Params<V>): Observable<string> {
    if (params.searchMode !== 'server') return merge(of(''), this.again$.pipe(map(() => '')));

    const typed$ = concat(
      // what is in the box now, at once; what is typed after that, when the typing pauses
      of(this.term$.value),
      this.term$.pipe(skip(1), debounceTime(params.searchDebounce ?? DEFAULT_SEARCH_DEBOUNCE)),
    ).pipe(
      map((term) => term.trim()),
      distinctUntilChanged(),
    );
    return merge(typed$, this.again$.pipe(map(() => this.term$.value.trim())));
  }

  private list(params: Params<V>, term: string): Observable<unknown> {
    const needed = params.minSearchLength ?? 0;
    if (params.searchMode === 'server' && term.length < needed) {
      this.current.set({ ...IDLE, searchNeeded: needed });
      return EMPTY;
    }
    return params.paginated ? this.pages(params, term) : this.whole(params, term);
  }

  /** a source that answers with everything: each answer replaces the last */
  private whole(params: Params<V>, term: string): Observable<unknown> {
    this.asking(true);
    return resolveOptionsSource(() => params.optionsFunction!(this.request(params, term, 1))).pipe(
      tap((result) =>
        this.show({ ...IDLE, options: mapRawOptions(toOptionsPage(result).content, params) }),
      ),
      catchError(() => this.fail(true)),
      finalize(() => this.settle()),
    );
  }

  /** a source that answers page by page: the first at once, each next one when asked */
  private pages(params: Params<V>, term: string): Observable<unknown> {
    const size = params.pageSize ?? DEFAULT_OPTIONS_PAGE_SIZE;
    let page = 0;
    let loaded = 0;
    let more = true;

    return merge(of(undefined), this.more$).pipe(
      exhaustMap(() => {
        if (!more) return EMPTY;
        const first = page === 0;
        this.asking(first);

        return resolveOptionsSource(() =>
          params.optionsFunction!(this.request(params, term, page + 1)),
        ).pipe(
          take(1),
          tap((result) => {
            const answer = toOptionsPage(result);
            page += 1;
            loaded += answer.content.length;
            more = hasMoreOptions(answer, loaded, size);

            const options = mapRawOptions(answer.content, unsorted(params));
            this.show({
              ...IDLE,
              options: first ? options : mergeOptions(this.current().options, options, this.same()),
              hasMore: more,
            });
          }),
          // a page that failed is asked for again the next time the end of the list is reached
          catchError(() => this.fail(first)),
          finalize(() => this.settle()),
        );
      }),
    );
  }

  private request(params: Params<V>, term: string, page: number): OptionsRequest {
    return optionsRequest(params, this.formState(), term, page);
  }

  /** a request goes out: what is shown stays until its answer is in */
  private asking(first: boolean): void {
    this.current.update((state) => ({
      ...state,
      loading: first,
      loadingMore: !first,
      failed: false,
      searchNeeded: 0,
    }));
  }

  private show(state: OptionsState<V>): void {
    this.current.set(state);
    this.keep(state.options);
  }

  private keep(options: Option<V>[]): void {
    this.seen.update((seen) => mergeOptions(seen, options, this.same()));
  }

  /** a list that failed shows nothing; a further page that failed leaves what came before it */
  private fail(first: boolean): Observable<never> {
    this.current.update((state) =>
      first ? { ...IDLE, failed: true } : { ...state, loadingMore: false, failed: true },
    );
    return EMPTY;
  }

  /** a request that ended with no answer (a cancelled call) leaves nothing loading */
  private settle(): void {
    this.current.update((state) =>
      state.loading || state.loadingMore ? { ...state, loading: false, loadingMore: false } : state,
    );
  }
}

/** a paginated source's order, and that of options asked for by value, is the server's */
function unsorted<V>(params: Params<V>): Params<V> {
  return params.sortBy ? { ...params, sortBy: undefined } : params;
}
