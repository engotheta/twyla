import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { effect, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { provideLoadingConfig } from '../loading';
import { provideFetchConfig } from './fetch-config.token';
import { FetchFailedError } from './fetch-failed.error';
import { FETCH_NOTIFIER } from './fetch-notifier.token';
import { FetchService } from './fetch.service';

describe('FetchService', () => {
  let api: FetchService;
  let http: HttpTestingController;
  const notifier = { success: vi.fn(), error: vi.fn() };
  const onException = vi.fn();

  // retries wait on `timer(0)`: one macrotask lets the next attempt go out
  const tick = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    notifier.success.mockReset();
    notifier.error.mockReset();
    onException.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLoadingConfig({ delay: 0, minDuration: 0 }),
        provideFetchConfig({ apiBaseUrl: 'https://api.test', retryDelay: () => 0, onException }),
        { provide: FETCH_NOTIFIER, useValue: notifier },
      ],
    });
    api = TestBed.inject(FetchService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('GETs a slug against the api base and hands the unwrapped data to every sink', async () => {
    const data = signal<unknown>(null);
    const successFn = vi.fn();
    const result = api.fetch({ url: 'users', data, successFn });

    const req = http.expectOne('https://api.test/users');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [{ id: 1 }] });

    await expect(result).resolves.toEqual([{ id: 1 }]);
    expect(data()).toEqual([{ id: 1 }]);
    expect(successFn).toHaveBeenCalledWith([{ id: 1 }], { success: true, data: [{ id: 1 }] });
    expect(notifier.success).not.toHaveBeenCalled(); // reads don't toast by default
  });

  it('POSTs variables as the body by default, and toasts writes', async () => {
    const result = api.fetch({ url: 'users', variables: { name: 'Ada' }, successMessage: 'Saved' });

    const req = http.expectOne('https://api.test/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Ada' });
    req.flush({ id: 7 });

    await expect(result).resolves.toEqual({ id: 7 });
    expect(notifier.success).toHaveBeenCalledWith('Saved');
  });

  it('merges variables into the query string on GET', () => {
    api.fetch({ url: 'users', method: 'GET', variables: { q: 'ada', skip: undefined } });

    const req = http.expectOne((r) => r.url === 'https://api.test/users');
    expect(req.request.params.get('q')).toBe('ada');
    expect(req.request.params.has('skip')).toBe(false);
    req.flush([]);
  });

  it('treats `success: false` as failed: failedFn, a toast, then FetchFailedError', async () => {
    const failedFn = vi.fn();
    const stream = firstValueFrom(api.fetch$({ url: 'a', failedFn }));
    http.expectOne('https://api.test/a').flush({ success: false, message: 'Nope' });

    await expect(stream).rejects.toBeInstanceOf(FetchFailedError);
    expect(failedFn).toHaveBeenCalledWith({ success: false, message: 'Nope' });
    expect(notifier.error).toHaveBeenCalledWith('Nope');

    const promise = api.fetch({ url: 'a' });
    http.expectOne('https://api.test/a').flush({ success: false });
    await expect(promise).resolves.toBeUndefined();
  });

  it('reports exceptions to onException, then exceptionFn, then a toast with the server message', async () => {
    const exceptionFn = vi.fn();
    const promise = api.fetch({ url: 'boom', exceptionFn });
    http
      .expectOne('https://api.test/boom')
      .flush({ message: 'Server exploded' }, { status: 500, statusText: 'Server Error' });

    await expect(promise).resolves.toBeUndefined();
    expect(onException.mock.invocationCallOrder[0]).toBeLessThan(
      exceptionFn.mock.invocationCallOrder[0],
    );
    expect(exceptionFn.mock.calls[0][0]).toBeInstanceOf(HttpErrorResponse);
    expect(notifier.error).toHaveBeenCalledWith('Server exploded');
  });

  it('lets onException mark an error handled, suppressing the toast', async () => {
    onException.mockReturnValue(true);
    const promise = api.fetch({ url: 'private' });
    http.expectOne('https://api.test/private').flush(null, { status: 401, statusText: 'Unauthorized' });

    await promise;
    expect(notifier.error).not.toHaveBeenCalled();
  });

  it('retries network/5xx errors, but not 4xx', async () => {
    const flaky = api.fetch({ url: 'flaky', retry: 2 });
    http.expectOne('https://api.test/flaky').flush(null, { status: 503, statusText: 'Unavailable' });
    await tick();
    http.expectOne('https://api.test/flaky').flush({ data: 'ok' });
    await expect(flaky).resolves.toBe('ok');

    const denied = api.fetch({ url: 'denied', retry: 2 });
    http.expectOne('https://api.test/denied').flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(denied).resolves.toBeUndefined(); // http.verify() proves no second attempt
  });

  it('serves cache-first hits without a request until the TTL runs out', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const params = { url: 'cached', cache: { policy: 'cache-first' as const, ttl: 1000 } };

    const first = api.fetch(params);
    http.expectOne('https://api.test/cached').flush({ data: 1 });
    await expect(first).resolves.toBe(1);

    await expect(api.fetch(params)).resolves.toBe(1); // no request

    now += 1001;
    const third = api.fetch(params);
    http.expectOne('https://api.test/cached').flush({ data: 2 });
    await expect(third).resolves.toBe(2);
  });

  it('cache-and-network emits the cached value, then the fresh one without a loader', async () => {
    const params = { url: 'feed', cache: { policy: 'cache-and-network' as const } };
    const seed = api.fetch(params);
    http.expectOne('https://api.test/feed').flush({ data: 'old' });
    await seed;

    const loading = signal(false);
    const values: unknown[] = [];
    api.fetch$({ ...params, loading: { signal: loading } }).subscribe((value) => values.push(value));

    expect(values).toEqual(['old']);
    expect(loading()).toBe(false);
    http.expectOne('https://api.test/feed').flush({ data: 'new' });
    expect(values).toEqual(['old', 'new']);
  });

  it("'share' joins an identical in-flight request", async () => {
    const a = api.fetch({ url: 'same' });
    const b = api.fetch({ url: 'same' });
    http.expectOne('https://api.test/same').flush({ data: 'x' });

    await expect(Promise.all([a, b])).resolves.toEqual(['x', 'x']);
  });

  it("'switch' cancels the previous call of the same operation", async () => {
    const first = api.fetch({ url: 'search', method: 'GET', variables: { q: 'a' }, concurrency: 'switch' });
    const second = api.fetch({ url: 'search', method: 'GET', variables: { q: 'ab' }, concurrency: 'switch' });

    const [cancelled, live] = http.match((r) => r.url === 'https://api.test/search');
    expect(cancelled.cancelled).toBe(true);
    live.flush({ data: 'ab' });

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBe('ab');
  });

  it("'exhaust' ignores calls while one of the same operation is in flight", async () => {
    const finalFn = vi.fn();
    const first = api.fetch({ url: 'submit', variables: { n: 1 }, concurrency: 'exhaust' });
    const ignored = api.fetch({ url: 'submit', variables: { n: 2 }, concurrency: 'exhaust', finalFn });

    await expect(ignored).resolves.toBeUndefined();
    expect(finalFn).not.toHaveBeenCalled();
    http.expectOne('https://api.test/submit').flush({ data: 1 });
    await expect(first).resolves.toBe(1);
  });

  it('refetches silently on refetchOn$ and survives a failed run', () => {
    const refetch$ = new Subject<void>();
    const loading = signal(false);
    const values: unknown[] = [];
    const sub = api
      .fetch$({ url: 'live', refetchOn$: [refetch$], loading: { signal: loading } })
      .subscribe((value) => values.push(value));

    expect(loading()).toBe(true);
    http.expectOne('https://api.test/live').flush({ data: 1 });
    expect(loading()).toBe(false);

    refetch$.next();
    expect(loading()).toBe(false); // background run: no loader
    http.expectOne('https://api.test/live').flush(null, { status: 500, statusText: 'Down' });

    refetch$.next();
    http.expectOne('https://api.test/live').flush({ data: 3 });

    expect(values).toEqual([1, 3]);
    expect(sub.closed).toBe(false);
    sub.unsubscribe();
  });

  it('keeps a shared loading signal true until the last call finishes', () => {
    const loading = signal(false);
    api.fetch({ url: 'one', loading: { signal: loading } });
    api.fetch({ url: 'two', loading: { signal: loading } });

    http.expectOne('https://api.test/one').flush({});
    expect(loading()).toBe(true);
    http.expectOne('https://api.test/two').flush({});
    expect(loading()).toBe(false);
  });

  it('covers `loading.on` targets while the request runs', () => {
    const card = document.createElement('div');
    card.className = 'fetch-card';
    document.body.appendChild(card);

    api.fetch({ url: 'x', loading: { on: 'fetch-card' } });
    expect(card.querySelector('loading-overlay')).not.toBeNull();
    expect(card.getAttribute('aria-busy')).toBe('true');

    http.expectOne('https://api.test/x').flush({});
    expect(card.querySelector('loading-overlay')).toBeNull();
    card.remove();
  });

  it('can be called from an effect without the effect tracking what the call reads', async () => {
    const params = { url: 'cached', cache: { policy: 'cache-first' as const } };
    const seed = api.fetch(params);
    http.expectOne('https://api.test/cached').flush({ data: 1 });
    await seed;

    const trigger = signal(0);
    const readInCallback = signal(0);
    const loading = signal(false);
    let runs = 0;
    TestBed.runInInjectionContext(() =>
      effect(() => {
        trigger();
        runs++;
        // a cache hit delivers synchronously, so successFn runs inside the effect
        api.fetch({ ...params, loading: { signal: loading }, successFn: () => readInCallback() });
      }),
    );
    TestBed.tick();

    readInCallback.set(1);
    TestBed.tick();
    expect(runs).toBe(1);

    trigger.set(1);
    TestBed.tick();
    expect(runs).toBe(2);
  });

  it('sends GraphQL with a field selection and unwraps the root field', async () => {
    const promise = api.fetch({ query: 'query { users { id } }', fieldSelection: ['id', 'name'] });

    const req = http.expectOne('https://api.test/graphql');
    expect(req.request.body.query).toContain('users { id name }');
    req.flush({ data: { users: [{ id: 1, name: 'Ada' }] } });

    await expect(promise).resolves.toEqual([{ id: 1, name: 'Ada' }]);
  });

  it('turns GraphQL errors into a reported exception', async () => {
    const exceptionFn = vi.fn();
    const promise = api.fetch({ mutation: 'mutation { save }', exceptionFn });
    http.expectOne('https://api.test/graphql').flush({ errors: [{ message: 'Denied' }] });

    await expect(promise).resolves.toBeUndefined();
    expect(exceptionFn).toHaveBeenCalled();
    expect(notifier.error).toHaveBeenCalledWith('Denied');
  });
});
