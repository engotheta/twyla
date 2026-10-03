import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, untracked, WritableSignal } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  concat,
  defer,
  EMPTY,
  finalize,
  firstValueFrom,
  map,
  merge,
  Observable,
  of,
  retry,
  share,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  throwError,
  timer,
} from 'rxjs';
import { LoadingService } from '@services/loading';
import { FETCH_CONFIG } from './fetch-config.token';
import { FetchFailedError } from './fetch-failed.error';
import { FETCH_NOTIFIER } from './fetch-notifier.token';
import {
  appendQueryParams,
  defaultResFn,
  httpErrorMessage,
  isRetryable,
  resolveMessage,
  resolveUrl,
  responseMessage,
  stableStringify,
  toHttpError,
  toHttpParams,
} from './fetch.helpers';
import {
  CacheEntry,
  CustomTransport,
  FetchLoadingOptions,
  FetchNotifyOptions,
  FetchParameter,
  FetchPolicy,
  GraphqlMutationTransport,
  GraphqlQueryTransport,
  RestTransport,
  UnwrapData,
} from './fetch.interface';
import {
  applyFieldSelection,
  graphqlSource,
  GraphqlResponse,
  unwrapGraphqlResponse,
} from './graphql.helpers';

/** A transport resolved into what the pipeline needs. */
interface ResolvedRequest<TRes> {
  /** This exact request (transport + variables): cache entry and 'share' identity. */
  key: string;
  /** The operation whatever the variables: 'switch' / 'exhaust' identity. */
  operation: string;
  /** Mutations and non-GET REST: toast on success by default, never cached. */
  write: boolean;
  url?: string;
  send: () => Observable<TRes>;
}

type Concurrency = NonNullable<FetchParameter['concurrency']>;
type LoadingFlag = WritableSignal<boolean> | BehaviorSubject<boolean>;

const noop = () => undefined;

/**
 * Runs `FetchParameter`s — REST, GraphQL (plain HttpClient, no client library) or a custom
 * `fetchFn` — with caching, request sharing/cancellation, retries, loading overlays and toasts.
 *
 * `fetch()` suits `await` call sites: it never rejects for a failed request, resolving
 * `undefined` once callbacks and toasts have reported it. `fetch$()` fails like HttpClient does
 * (after the same reporting), so pipelines — e.g. a data grid's `fetchFn` — can react.
 */
@Injectable({ providedIn: 'root' })
export class FetchService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(FETCH_CONFIG);
  private readonly notifier = inject(FETCH_NOTIFIER);
  private readonly loading = inject(LoadingService);

  private readonly cache = new Map<string, CacheEntry>();
  /** The latest in-flight call per operation, with the subject that cancels it ('switch'). */
  private readonly operations = new Map<string, Subject<void>>();
  /** How many in-flight calls currently hold each loading `signal` / `subject$` true. */
  private readonly flagCounts = new Map<LoadingFlag, number>();
  /** Stable ids for custom `fetchFn`s: identity, not `toString()`. */
  private readonly fnIds = new WeakMap<object, number>();
  private nextFnId = 0;

  /**
   * Emits the request's data — once; twice for a 'cache-and-network' hit (cached, then fresh);
   * and again on every `refetchOn$` emission. Fails with `HttpErrorResponse`, or
   * `FetchFailedError` for a failed payload, after callbacks and toasts have run. Cancelled or
   * ignored calls complete without emitting. Cold: nothing happens until subscribed.
   */
  fetch$<TVariables = Record<string, unknown>, TRes = unknown, TData = UnwrapData<TRes>>(
    params: FetchParameter<TVariables, TRes, TData>,
  ): Observable<TData> {
    const source$ = params.refetchOn$?.length
      ? merge(...params.refetchOn$).pipe(
          map(() => true),
          startWith(false),
          // one failed run must not end a long-lived stream — it was already reported
          switchMap((background) => this.run(params, background).pipe(catchError(ignoreReported))),
        )
      : this.run(params, false);

    // subscribing does work synchronously (cache hits, loaders, callbacks) — when that happens
    // inside a caller's `effect`, none of the signals it touches may become the effect's dependencies
    return new Observable<TData>((subscriber) => untracked(() => source$.subscribe(subscriber)));
  }

  /**
   * Promise flavour of `fetch$()` for `await` call sites: resolves the first data emitted, or
   * `undefined` when the call failed (already reported), was cancelled, or was ignored.
   */
  fetch<TVariables = Record<string, unknown>, TRes = unknown, TData = UnwrapData<TRes>>(
    params: FetchParameter<TVariables, TRes, TData>,
  ): Promise<TData | undefined> {
    return firstValueFrom(this.fetch$(params).pipe(catchError(ignoreReported)), {
      defaultValue: undefined,
    });
  }

  /** Drops cached responses: all of them, one key, or the keys a predicate matches. */
  clearCache(match?: string | ((key: string) => boolean)): void {
    for (const [key, entry] of this.cache) {
      const hit = match === undefined || (typeof match === 'string' ? key === match : match(key));
      if (!hit) continue;

      // an in-flight request stays joinable; only its stored data goes
      if (entry.inFlight$) this.cache.set(key, { ...entry, data: undefined, expiresAt: 0 });
      else this.cache.delete(key);
    }
  }

  private run<TVariables, TRes, TData>(
    p: FetchParameter<TVariables, TRes, TData>,
    background: boolean,
  ): Observable<TData> {
    return defer(() => {
      const request = this.resolve(p);
      const concurrency = p.concurrency ?? 'share';
      if (concurrency === 'exhaust' && this.operations.has(request.operation)) return EMPTY;

      const policy: FetchPolicy = request.write ? 'no-cache' : (p.cache?.policy ?? 'no-cache');
      const readsCache = policy === 'cache-first' || policy === 'cache-and-network';
      const cached = readsCache && !background ? this.readCache<TRes>(request.key) : undefined;

      const cached$ = cached
        ? defer(() => {
            p.res$?.next(cached.data);
            return of(this.deliver(p, request, cached.data, false));
          })
        : EMPTY;

      const network$ =
        cached && policy === 'cache-first'
          ? EMPTY
          : this.network(p, request, policy, concurrency, background || !!cached);

      return concat(cached$, network$).pipe(finalize(() => p.finalFn?.()));
    });
  }

  private network<TVariables, TRes, TData>(
    p: FetchParameter<TVariables, TRes, TData>,
    request: ResolvedRequest<TRes>,
    policy: FetchPolicy,
    concurrency: Concurrency,
    background: boolean,
  ): Observable<TData> {
    return defer(() => {
      const silent = background && p.loading?.silentRefetch !== false;
      const stopLoading = silent ? noop : this.startLoading(p.loading);
      const cancel$ = this.beginOperation(request.operation, concurrency);

      return this.send(request, p.retry ?? 0, concurrency).pipe(
        // transport errors only: anything thrown while handling the response is a bug, not a failed request
        catchError((err: unknown) => this.reportException(p, request, err)),
        map((res) => this.handleResponse(p, request, res, policy)),
        takeUntil(cancel$),
        finalize(() => {
          stopLoading();
          this.endOperation(request.operation, cancel$);
        }),
      );
    });
  }

  /** The request itself, retried when asked, and shared with identical in-flight calls ('share'). */
  private send<TRes>(
    request: ResolvedRequest<TRes>,
    retries: number,
    concurrency: Concurrency,
  ): Observable<TRes> {
    const attempt$ = defer(() => request.send());

    const source$ =
      retries > 0
        ? attempt$.pipe(
            retry({
              count: retries,
              delay: (err: unknown, attempt) =>
                isRetryable(err) ? timer(this.config.retryDelay(attempt)) : throwError(() => err),
            }),
          )
        : attempt$;

    if (concurrency !== 'share') return source$;

    const entry = this.cache.get(request.key);
    if (entry?.inFlight$) return entry.inFlight$ as Observable<TRes>;

    const inFlight$: Observable<TRes> = source$.pipe(
      finalize(() => this.clearInFlight(request.key, inFlight$)),
      share(),
    );

    this.cache.set(request.key, { createdAt: Date.now(), expiresAt: 0, ...entry, inFlight$ });
    return inFlight$;
  }

  private handleResponse<TVariables, TRes, TData>(
    p: FetchParameter<TVariables, TRes, TData>,
    request: ResolvedRequest<TRes>,
    res: TRes,
    policy: FetchPolicy,
  ): TData {
    p.res$?.next(res);

    if (!this.config.isSuccess(res)) {
      p.failedFn?.(res);

      const message =
        resolveMessage(p.errorMessage, res) ?? responseMessage(res) ?? this.config.messages.failed;

      if (shouldNotify(p.notify, 'error', request.write)) this.notifier.error(message);
      throw new FetchFailedError(res, message);
    }

    if (policy !== 'no-cache') this.writeCache(request.key, res, p.cache?.ttl);
    return this.deliver(p, request, res, true);
  }

  /** Maps a successful response and hands it to the sinks and `successFn` (plus a toast, if due). */
  private deliver<TVariables, TRes, TData>(
    p: FetchParameter<TVariables, TRes, TData>,
    request: ResolvedRequest<TRes>,
    res: TRes,
    fromNetwork: boolean,
  ): TData {
    const data = p.resFn ? p.resFn(res) : (defaultResFn(res) as TData);
    p.data$?.next(data);
    p.data?.set(data);
    p.successFn?.(data, res);

    if (fromNetwork && shouldNotify(p.notify, 'success', request.write)) {
      this.notifier.success(
        resolveMessage(p.successMessage, res) ??
          responseMessage(res) ??
          this.config.messages.success,
      );
    }
    return data;
  }

  private reportException<TVariables, TRes, TData>(
    p: FetchParameter<TVariables, TRes, TData>,
    request: ResolvedRequest<TRes>,
    err: unknown,
  ): Observable<never> {
    const error = toHttpError(err, request.url);

    const handled =
      p.notify?.handleException !== false && this.config.onException?.(error) === true;

    p.exceptionFn?.(error);

    if (!handled && shouldNotify(p.notify, 'error', request.write)) {
      this.notifier.error(
        resolveMessage(p.errorMessage, error) ?? httpErrorMessage(error, this.config.messages),
      );
    }
    return throwError(() => error);
  }

  private resolve<TVariables, TRes, TData>(
    p: FetchParameter<TVariables, TRes, TData>,
  ): ResolvedRequest<TRes> {
    const variables = p.variables === undefined ? '' : stableStringify(p.variables);
    const explicitKey = p.cache?.key;

    if (isRest(p)) {
      const method = p.method ?? (p.variables === undefined ? 'GET' : 'POST');
      const url = resolveUrl(this.config.apiBaseUrl, p.url);
      const inQuery = method === 'GET' || method === 'DELETE';

      const params = inQuery
        ? appendQueryParams(toHttpParams(p.params), p.variables)
        : toHttpParams(p.params);

      const body = inQuery ? null : (p.variables ?? null);
      const headers = p.headers;
      const operation = `${method} ${url}`;

      return {
        key: explicitKey ?? `${operation}?${params.toString()}${inQuery ? '' : `#${variables}`}`,
        operation: explicitKey ?? operation,
        write: method !== 'GET',
        url,
        send: () => this.http.request<TRes>(method, url, { body, headers, params }),
      };
    }

    if (isGraphql(p)) {
      const kind = p.mutation !== undefined ? 'mutation' : 'query';
      const source = graphqlSource(p.mutation ?? p.query);

      const query = p.fieldSelection?.length
        ? applyFieldSelection(source, p.fieldSelection)
        : source;

      const url = resolveUrl(this.config.apiBaseUrl, this.config.graphqlUrl);
      const body = { query, variables: p.variables ?? {} };
      const operation = `${kind} ${query}`;

      return {
        key: explicitKey ?? `${operation}#${variables}`,
        operation: explicitKey ?? operation,
        write: kind === 'mutation',
        url,
        send: () =>
          this.http
            .post<GraphqlResponse | null>(url, body)
            .pipe(map((response) => unwrapGraphqlResponse<TRes>(response, url))),
      };
    }

    if (isCustom(p)) {
      const { fetchFn } = p;
      const operation = `custom#${this.fnId(fetchFn)}`;

      return {
        key: explicitKey ?? `${operation}#${variables}`,
        operation: explicitKey ?? operation,
        write: false,
        send: () => fetchFn(p.variables),
      };
    }

    throw new Error('FetchParameter needs one transport: `url`, `query`, `mutation` or `fetchFn`.');
  }

  private readCache<TRes>(key: string): { data: TRes } | undefined {
    const entry = this.cache.get(key);
    if (!entry || entry.data === undefined) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.clearCache(key);
      return undefined;
    }

    return { data: entry.data as TRes };
  }

  private writeCache(key: string, res: unknown, ttl?: number): void {
    const now = Date.now();
    const expiresAt = ttl === undefined ? Infinity : now + ttl;
    this.cache.set(key, { ...this.cache.get(key), data: res, createdAt: now, expiresAt });
  }

  private clearInFlight(key: string, inFlight$: Observable<unknown>): void {
    const entry = this.cache.get(key);
    if (entry?.inFlight$ !== inFlight$) return;

    if (entry.data === undefined) this.cache.delete(key);
    else this.cache.set(key, { ...entry, inFlight$: undefined });
  }

  /** Registers a call as its operation's latest in-flight one; 'switch' cancels the previous. */
  private beginOperation(operation: string, concurrency: Concurrency): Subject<void> {
    if (concurrency === 'switch') this.operations.get(operation)?.next();

    const cancel$ = new Subject<void>();
    this.operations.set(operation, cancel$);
    return cancel$;
  }

  private endOperation(operation: string, cancel$: Subject<void>): void {
    if (this.operations.get(operation) === cancel$) this.operations.delete(operation);
    cancel$.complete();
  }

  /** Raises every loader the call asked for; the returned function lowers them again. */
  private startLoading(options: FetchLoadingOptions | undefined): () => void {
    if (!options) return noop;

    const hideOverlay = options.on ? this.loading.show(options.on) : noop;
    const flags = [options.signal, options.subject$].filter((flag): flag is LoadingFlag => !!flag);
    flags.forEach((flag) => this.raiseFlag(flag));

    return () => {
      hideOverlay();
      flags.forEach((flag) => this.lowerFlag(flag));
    };
  }

  private raiseFlag(flag: LoadingFlag): void {
    const count = (this.flagCounts.get(flag) ?? 0) + 1;
    this.flagCounts.set(flag, count);
    if (count === 1) setFlag(flag, true);
  }

  private lowerFlag(flag: LoadingFlag): void {
    const count = (this.flagCounts.get(flag) ?? 0) - 1;

    if (count > 0) {
      this.flagCounts.set(flag, count);
      return;
    }

    this.flagCounts.delete(flag);
    setFlag(flag, false);
  }

  private fnId(fn: object): number {
    let id = this.fnIds.get(fn);

    if (id === undefined) {
      id = ++this.nextFnId;
      this.fnIds.set(fn, id);
    }
    return id;
  }
}

function isRest<V, R, D>(p: FetchParameter<V, R, D>): p is FetchParameter<V, R, D> & RestTransport {
  return p.url !== undefined;
}

function isGraphql<V, R, D>(
  p: FetchParameter<V, R, D>,
): p is FetchParameter<V, R, D> & (GraphqlQueryTransport | GraphqlMutationTransport) {
  return p.query !== undefined || p.mutation !== undefined;
}

function isCustom<V, R, D>(
  p: FetchParameter<V, R, D>,
): p is FetchParameter<V, R, D> & CustomTransport<V, R> {
  return p.fetchFn !== undefined;
}

function shouldNotify(
  notify: FetchNotifyOptions | undefined,
  kind: 'success' | 'error',
  write: boolean,
): boolean {
  if (notify?.enabled === false) return false;
  return kind === 'success' ? (notify?.success ?? write) : notify?.error !== false;
}

function setFlag(flag: LoadingFlag, value: boolean): void {
  if (flag instanceof BehaviorSubject) flag.next(value);
  else flag.set(value);
}

/** Swallows failures FetchService already reported (callbacks + toast); anything else is a bug and rethrows. */
function ignoreReported(err: unknown): Observable<never> {
  return err instanceof HttpErrorResponse || err instanceof FetchFailedError
    ? EMPTY
    : throwError(() => err);
}
