import { ApplicationRef, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  FormState,
  OptionsParameter,
  OptionsRequest,
  OptionsResult,
} from '../../interfaces/form-state.interface';
import { OptionsSource } from './options-source';

interface Person {
  id: number;
  name: string;
}

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bo' },
  { id: 3, name: 'Cy' },
  { id: 4, name: 'Di' },
  { id: 5, name: 'Ed' },
];

const formState = { value: { team: 'core' } } as unknown as FormState;

describe('OptionsSource', () => {
  let appRef: ApplicationRef;
  let params: WritableSignal<OptionsParameter<Person, number> | undefined>;
  let source: OptionsSource<number>;

  /** the parameter reaches the source through an effect, as an input does */
  function start(initial: OptionsParameter<Person, number> | undefined): void {
    params = signal(initial);
    source = TestBed.runInInjectionContext(
      () =>
        new OptionsSource<number>(
          params,
          () => formState,
          () => Object.is,
        ),
    );
    appRef.tick();
  }

  const base = { labelKey: 'name', valueKey: 'id' } as const;
  const labels = () => source.state().options.map((option) => option.label);
  const requests = (fn: { mock: { calls: unknown[][] } }) =>
    fn.mock.calls.map(([request]) => request as OptionsRequest);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => vi.useRealTimers());

  it('waits for its parameter, then has nothing to load when there is no function', () => {
    params = signal(undefined);
    source = TestBed.runInInjectionContext(
      () =>
        new OptionsSource<number>(
          params,
          () => formState,
          () => Object.is,
        ),
    );
    expect(source.state().loading).toBe(true);

    appRef.tick();
    expect(source.state()).toMatchObject({ options: [], loading: false, failed: false });
  });

  it('asks once for the first page of everything, and maps the answer', () => {
    const load = vi.fn(() => of(PEOPLE.slice(0, 2)));
    start({ ...base, optionsFunction: load });

    expect(load).toHaveBeenCalledTimes(1);
    expect(requests(load)[0]).toEqual({ search: '', page: 1, size: 25, filters: {}, formState });
    expect(source.state().options).toEqual([
      { label: 'Ada', value: 1 },
      { label: 'Bo', value: 2 },
    ]);
    expect(source.state().loading).toBe(false);
  });

  it('takes a Promise for an answer, loading until it settles', async () => {
    start({ ...base, optionsFunction: () => Promise.resolve(PEOPLE.slice(0, 1)) });
    expect(source.state().loading).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    expect(labels()).toEqual(['Ada']);
    expect(source.state().loading).toBe(false);
  });

  it('sends its fixed filters with every request', () => {
    vi.useFakeTimers();
    const load = vi.fn(() => of([] as Person[]));
    start({ ...base, optionsFunction: load, filters: { active: true }, searchMode: 'server' });

    source.search('a');
    vi.advanceTimersByTime(300);

    expect(requests(load).map((request) => request.filters)).toEqual([
      { active: true },
      { active: true },
    ]);
  });

  it('leaves the search to the select unless the search is the server’s', () => {
    vi.useFakeTimers();
    const load = vi.fn(() => of(PEOPLE));
    start({ ...base, optionsFunction: load });

    source.search('ad');
    vi.advanceTimersByTime(1000);

    expect(load).toHaveBeenCalledTimes(1);
  });

  describe('searchMode: server', () => {
    it('asks again with what was typed, once the typing pauses', () => {
      vi.useFakeTimers();
      const load = vi.fn((request: OptionsRequest) =>
        of(PEOPLE.filter((person) => person.name.toLowerCase().includes(request.search))),
      );
      start({ ...base, optionsFunction: load, searchMode: 'server' });
      expect(labels()).toHaveLength(5);

      source.search('a');
      source.search('ad');
      vi.advanceTimersByTime(299);
      expect(load).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(requests(load).map((request) => request.search)).toEqual(['', 'ad']);
      expect(labels()).toEqual(['Ada']);
    });

    it('honours searchDebounce, and does not ask twice for the same text', () => {
      vi.useFakeTimers();
      const load = vi.fn(() => of(PEOPLE));
      start({ ...base, optionsFunction: load, searchMode: 'server', searchDebounce: 50 });

      source.search('bo');
      vi.advanceTimersByTime(50);
      source.search('bo '); // the same search, once trimmed
      vi.advanceTimersByTime(50);

      expect(load).toHaveBeenCalledTimes(2);
    });

    it('keeps the latest answer when an earlier one comes back late', () => {
      vi.useFakeTimers();
      const answers: Subject<Person[]>[] = [];
      const load = vi.fn((): Observable<Person[]> => {
        const answer = new Subject<Person[]>();
        answers.push(answer);
        return answer;
      });
      start({ ...base, optionsFunction: load, searchMode: 'server' });
      answers[0].next(PEOPLE);

      source.search('a');
      vi.advanceTimersByTime(300);
      source.search('b');
      vi.advanceTimersByTime(300);

      answers[2].next([PEOPLE[1]]);
      answers[1].next([PEOPLE[0]]); // the answer to 'a', after the user moved on to 'b'

      expect(labels()).toEqual(['Bo']);
    });

    it('shows the list it has while the next one is on its way', () => {
      vi.useFakeTimers();
      const answers: Subject<Person[]>[] = [];
      start({
        ...base,
        searchMode: 'server',
        optionsFunction: () => {
          const answer = new Subject<Person[]>();
          answers.push(answer);
          return answer;
        },
      });
      answers[0].next(PEOPLE);

      source.search('a');
      vi.advanceTimersByTime(300);

      expect(source.state().loading).toBe(true);
      expect(labels()).toHaveLength(5);
    });

    it('asks for nothing until minSearchLength is typed', () => {
      vi.useFakeTimers();
      const load = vi.fn(() => of(PEOPLE));
      start({ ...base, optionsFunction: load, searchMode: 'server', minSearchLength: 2 });

      expect(load).not.toHaveBeenCalled();
      expect(source.state()).toMatchObject({ searchNeeded: 2, loading: false, options: [] });

      source.search('a');
      vi.advanceTimersByTime(300);
      expect(load).not.toHaveBeenCalled();

      source.search('ad');
      vi.advanceTimersByTime(300);
      expect(load).toHaveBeenCalledTimes(1);
      expect(source.state().searchNeeded).toBe(0);
    });
  });

  describe('paginated', () => {
    /** a server holding all five people, answering two at a time */
    const paged = vi.fn((request: OptionsRequest): Observable<OptionsResult<Person>> =>
      of({
        content: PEOPLE.slice((request.page - 1) * request.size, request.page * request.size),
        totalLength: PEOPLE.length,
      }),
    );

    // (a block: a function returned from a hook is run as its cleanup, and `mockClear()` returns
    // the mock)
    beforeEach(() => {
      paged.mockClear();
    });

    it('loads the first page, then one more each time the end is reached, until it has all', () => {
      start({ ...base, optionsFunction: paged, paginated: true, pageSize: 2 });
      expect(labels()).toEqual(['Ada', 'Bo']);
      expect(source.state().hasMore).toBe(true);

      source.loadMore();
      expect(labels()).toEqual(['Ada', 'Bo', 'Cy', 'Di']);

      source.loadMore();
      expect(labels()).toEqual(['Ada', 'Bo', 'Cy', 'Di', 'Ed']);
      expect(source.state().hasMore).toBe(false);

      source.loadMore();
      expect(requests(paged).map((request) => request.page)).toEqual([1, 2, 3]);
    });

    it('stops at a short page when the server gives no total', () => {
      const load = vi.fn((request: OptionsRequest) =>
        of(PEOPLE.slice((request.page - 1) * request.size, request.page * request.size)),
      );
      start({ ...base, optionsFunction: load, paginated: true, pageSize: 3 });
      expect(source.state().hasMore).toBe(true);

      source.loadMore();
      expect(labels()).toHaveLength(5);
      expect(source.state().hasMore).toBe(false);
    });

    it('ignores the end being reached again while a page is on its way', () => {
      const answers: Subject<Person[]>[] = [];
      const load = vi.fn((): Observable<Person[]> => {
        const answer = new Subject<Person[]>();
        answers.push(answer);
        return answer;
      });
      start({ ...base, optionsFunction: load, paginated: true, pageSize: 2 });
      answers[0].next(PEOPLE.slice(0, 2));

      source.loadMore();
      source.loadMore();
      expect(load).toHaveBeenCalledTimes(2);
      expect(source.state().loadingMore).toBe(true);

      answers[1].next(PEOPLE.slice(2, 4));
      expect(source.state().loadingMore).toBe(false);
      expect(labels()).toHaveLength(4);
    });

    it('leaves out an option a later page repeats', () => {
      const load = vi.fn((request: OptionsRequest) =>
        of(request.page === 1 ? PEOPLE.slice(0, 2) : PEOPLE.slice(1, 3)),
      );
      start({ ...base, optionsFunction: load, paginated: true, pageSize: 2 });

      source.loadMore();
      expect(labels()).toEqual(['Ada', 'Bo', 'Cy']);
    });

    it('starts over from the first page when the search changes', () => {
      vi.useFakeTimers();
      start({
        ...base,
        optionsFunction: paged,
        paginated: true,
        pageSize: 2,
        searchMode: 'server',
      });
      source.loadMore();

      source.search('x');
      vi.advanceTimersByTime(300);

      expect(requests(paged).map(({ page, search }) => [page, search])).toEqual([
        [1, ''],
        [2, ''],
        [1, 'x'],
      ]);
      expect(labels()).toEqual(['Ada', 'Bo']);
    });

    it('keeps the pages it has when a further one fails, and asks for that one again', () => {
      let fail = true;
      const load = vi.fn((request: OptionsRequest): Observable<Person[]> => {
        if (request.page === 2 && fail) return throwError(() => new Error('offline'));
        return of(PEOPLE.slice((request.page - 1) * 2, request.page * 2));
      });
      start({ ...base, optionsFunction: load, paginated: true, pageSize: 2 });

      source.loadMore();
      expect(source.state()).toMatchObject({ failed: true, loadingMore: false, hasMore: true });
      expect(labels()).toEqual(['Ada', 'Bo']);

      fail = false;
      source.loadMore();
      expect(source.state().failed).toBe(false);
      expect(labels()).toEqual(['Ada', 'Bo', 'Cy', 'Di']);
    });
  });

  it('starts over when its parameter is a new object', () => {
    const load = vi.fn((request: OptionsRequest) =>
      of(request.filters['team'] === 'core' ? PEOPLE.slice(0, 2) : PEOPLE.slice(3)),
    );
    start({ ...base, optionsFunction: load, filters: { team: 'core' } });
    expect(labels()).toEqual(['Ada', 'Bo']);

    params.set({ ...base, optionsFunction: load, filters: { team: 'ops' } });
    appRef.tick();

    expect(labels()).toEqual(['Di', 'Ed']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows nothing of the last source while the new one loads', () => {
    const pending = new Subject<Person[]>();
    start({ ...base, optionsFunction: () => of(PEOPLE) });

    params.set({ ...base, optionsFunction: () => pending });
    appRef.tick();

    expect(source.state()).toMatchObject({ options: [], loading: true });
  });

  it('reports a failure, and asks again on retry', () => {
    let fail = true;
    const load = vi.fn(() => (fail ? throwError(() => new Error('offline')) : of(PEOPLE)));
    start({ ...base, optionsFunction: load });
    expect(source.state()).toMatchObject({ failed: true, loading: false, options: [] });

    fail = false;
    source.retry();
    expect(source.state().failed).toBe(false);
    expect(labels()).toHaveLength(5);
  });

  it('fails, rather than throws, when the function itself throws', () => {
    start({
      ...base,
      optionsFunction: () => {
        throw new Error('bad config');
      },
    });
    expect(source.state().failed).toBe(true);
  });

  it('stops loading when a call ends without an answer', () => {
    const cancelled = new Subject<Person[]>();
    start({ ...base, optionsFunction: () => cancelled });
    expect(source.state().loading).toBe(true);

    cancelled.complete();
    expect(source.state().loading).toBe(false);
  });

  describe('remember', () => {
    it('keeps every option it has shown, through a search that leaves them out', () => {
      vi.useFakeTimers();
      const load = vi.fn((request: OptionsRequest) =>
        of(request.search ? [PEOPLE[4]] : PEOPLE.slice(0, 2)),
      );
      start({ ...base, optionsFunction: load, searchMode: 'server' });

      source.search('ed');
      vi.advanceTimersByTime(300);

      expect(labels()).toEqual(['Ed']);
      expect(source.remembered().map((option) => option.label)).toEqual(['Ada', 'Bo', 'Ed']);
    });

    it('asks selectedFunction for the values nothing shown covers, once', () => {
      const selected = vi.fn((ids: number[]) => of(PEOPLE.filter((p) => ids.includes(p.id))));
      start({ ...base, optionsFunction: () => of(PEOPLE.slice(0, 2)), selectedFunction: selected });

      source.remember([1, 5]);
      source.remember([1, 5]);

      expect(selected).toHaveBeenCalledTimes(1);
      expect(selected).toHaveBeenCalledWith([5]);
      expect(source.remembered().map((option) => option.label)).toEqual(['Ada', 'Bo', 'Ed']);
    });
  });
});
