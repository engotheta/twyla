import { HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { WritableSignal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import type { LoadingTarget } from '@services/loading';

/* ─────────────────────────── Transports ─────────────────────────── */

/**
 * Minimal structural stand-in for graphql's `DocumentNode` (avoids a hard dependency). Documents
 * are sent as their source text, so `loc.source.body` must be there — it is for anything built
 * with `gql`.
 */
export interface GraphqlDocument {
  readonly kind: string;
  readonly definitions: readonly unknown[];
  readonly loc?: { readonly source?: { readonly body?: string } };
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RestTransport {
  kind?: 'rest';
  /** Slug (resolved against `FetchConfig.apiBaseUrl`) or an absolute URL. */
  url: string;
  /** Defaults to 'GET' when no variables are given, otherwise 'POST'. */
  method?: HttpMethod;
  headers?: HttpHeaders | Record<string, string>;
  /** Query-string params; `variables` join them on GET/DELETE (other methods send them as the body). */
  params?: HttpParams | Record<string, string | number | boolean>;
}

export interface GraphqlQueryTransport {
  kind?: 'query';
  query: GraphqlDocument | string;
  /** Replaces the root field's selection set; dotted paths nest (`'data.id'` → `data { id }`). */
  fieldSelection?: string[];
}

export interface GraphqlMutationTransport {
  kind?: 'mutation';
  mutation: GraphqlDocument | string;
  /** Replaces the root field's selection set; dotted paths nest (`'data.id'` → `data { id }`). */
  fieldSelection?: string[];
}

export interface CustomTransport<TVariables, TRes> {
  kind?: 'custom';
  /** Identified by reference for caching/concurrency — reuse one function, or set `cache.key`. */
  fetchFn: (variables?: TVariables) => Observable<TRes>;
}

/**
 * Exactly one transport must be supplied. The `never` guards make the union
 * exclusive so `{ url, mutation }` or `{ query, fetchFn }` fail to compile.
 */
export type FetchTransport<TVariables, TRes> =
  | (RestTransport & { query?: never; mutation?: never; fetchFn?: never })
  | (GraphqlQueryTransport & { url?: never; mutation?: never; fetchFn?: never })
  | (GraphqlMutationTransport & { url?: never; query?: never; fetchFn?: never })
  | (CustomTransport<TVariables, TRes> & { url?: never; query?: never; mutation?: never });

/* ─────────────────────────── Options groups ─────────────────────────── */

export type FetchPolicy = 'no-cache' | 'cache-first' | 'network-only' | 'cache-and-network';

export interface FetchCacheOptions {
  /**
   * Default: 'no-cache'. Honoured for GET requests, GraphQL queries and custom transports;
   * mutations and other REST methods are never cached. 'network-only' never reads the cache but
   * still writes it, so later 'cache-first' callers benefit.
   */
  policy?: FetchPolicy;
  /** Milliseconds a cached entry stays valid. Default: forever. */
  ttl?: number;
  /**
   * Explicit key replacing the one derived from transport + variables. It is also the key
   * `concurrency` matches calls on, so include anything that must not collide (e.g. the page).
   */
  key?: string;
}

export interface FetchNotifyOptions {
  /** Master switch. Default: true. */
  enabled?: boolean;
  /** Toast on success. Default: true for writes (mutations, non-GET REST), false for reads. */
  success?: boolean;
  /** Toast on a failed (non-2xx or `success: false`) response. Default: true. */
  error?: boolean;
  /**
   * Let the global handler (`FetchConfig.onException`: 401 redirect, 403, 5xx…) deal with the
   * HttpErrorResponse before `exceptionFn` runs. Default: true.
   */
  handleException?: boolean;
}

export interface FetchLoadingOptions {
  /**
   * Class name(s) (no leading dot) or element(s) to cover with a spinner overlay while the
   * request runs — see `LoadingService`. Nothing shown if omitted.
   */
  on?: LoadingTarget | LoadingTarget[];
  /**
   * Reactive sinks toggled true/false around the request. Reference counted, so parallel
   * requests sharing one sink keep it true until the last of them finishes.
   */
  subject$?: BehaviorSubject<boolean>;
  signal?: WritableSignal<boolean>;
  /** Skip every loader for background runs (cache-and-network refresh, refetchOn$). Default: true. */
  silentRefetch?: boolean;
}

/** What the default `resFn` (`res?.data ?? res`) turns a response into. */
export type UnwrapData<TRes> = TRes extends { data: infer D } ? D : TRes;

export type FetchParameter<
  TVariables = Record<string, unknown>,
  TRes = unknown,
  TData = UnwrapData<TRes>,
> = FetchTransport<TVariables, TRes> & {
  /** Variables sent with the request or passed to `fetchFn`. */
  variables?: TVariables;

  /**
   * Maps the raw response to the data the caller cares about.
   * Default: `(res) => res?.data ?? res`.
   */
  resFn?: (res: TRes) => TData;

  /** Reactive sinks. `res$` gets every 2xx response, `data$`/`data` only successful (or cached) data. */
  res$?: BehaviorSubject<TRes | null>;
  data$?: BehaviorSubject<TData | null>;
  data?: WritableSignal<TData | null>;

  /**
   * Any emission on any of these re-runs the request from the network (refreshing the cache when
   * the policy caches). `fetch$()` then stays open until unsubscribed, and a failed run no longer
   * ends it — failures still reach the callbacks and toasts.
   */
  refetchOn$?: Observable<unknown>[];

  /* Lifecycle callbacks — all optional, all typed. */
  /** 2xx and `FetchConfig.isSuccess` (default: `success !== false`). Also runs for cache hits. */
  successFn?: (data: TData, res: TRes) => void;
  /** 2xx but the payload says it failed (e.g. `{ success: false, message }`). */
  failedFn?: (res: TRes) => void;
  /** Network / non-2xx / GraphQL `errors` (a custom transport's error arrives wrapped). */
  exceptionFn?: (err: HttpErrorResponse) => void;
  /** Always runs last, like `finalize` — also when cancelled. Skipped for calls 'exhaust' ignored. */
  finalFn?: () => void;

  /* Messages: literal string or derived from the response. */
  successMessage?: string | ((res: TRes) => string);
  errorMessage?: string | ((res: TRes | HttpErrorResponse) => string);

  notify?: FetchNotifyOptions;
  loading?: FetchLoadingOptions;
  cache?: FetchCacheOptions;

  /** Automatic retries on network (status 0) / 5xx errors, with exponential backoff. Default: 0. */
  retry?: number;
  /**
   * 'share' (default) joins an identical in-flight request (same transport + variables).
   * 'switch' cancels the previous in-flight call of the same operation — the transport, whatever
   * the variables — for typeahead/search. 'exhaust' ignores the new call while one of the same
   * operation is in flight (submit buttons). A `cache.key` stands in for both identities.
   */
  concurrency?: 'share' | 'switch' | 'exhaust';
};

/* ─────────────────────────── Cache entry ─────────────────────────── */

export interface CacheEntry<TRes = unknown> {
  /** The raw response (before `resFn`), present once a successful response was cached. */
  data?: TRes;
  /** Epoch ms when written. */
  createdAt: number;
  /** Epoch ms after which the entry is stale; `Infinity` when no TTL, 0 while only in flight. */
  expiresAt: number;
  /** Shared in-flight request, so concurrent callers with the same key join it. */
  inFlight$?: Observable<TRes>;
}
