import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FetchMessages } from './fetch-config.token';

type ParamsInput = HttpParams | Record<string, string | number | boolean> | undefined;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAbsoluteUrl(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/** Resolves a slug against `base` ('' leaves it as is); absolute URLs pass through untouched. */
export function resolveUrl(base: string, url: string): string {
  if (!base || isAbsoluteUrl(url)) return url;
  return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

/** JSON with object keys sorted at every depth: equal values give equal strings, whatever the key order. */
export function stableStringify(value: unknown): string {
  return (
    JSON.stringify(value, (_key, val: unknown) =>
      isRecord(val)
        ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : val,
    ) ?? ''
  );
}

export function toHttpParams(params: ParamsInput): HttpParams {
  return params instanceof HttpParams ? params : new HttpParams({ fromObject: params ?? {} });
}

/** Adds `variables` as query params: null/undefined skipped, arrays repeated, Dates as ISO, objects as JSON. */
export function appendQueryParams(params: HttpParams, variables: unknown): HttpParams {
  if (!isRecord(variables)) return params;

  for (const [key, value] of Object.entries(variables)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined || item === null) continue;
      params = params.append(key, toQueryValue(item));
    }
  }
  return params;
}

function toQueryValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** The default `resFn`: `res?.data ?? res`. */
export function defaultResFn(res: unknown): unknown {
  return isRecord(res) && res['data'] !== undefined && res['data'] !== null ? res['data'] : res;
}

/** The payload's own `message`, when it has a usable one. */
export function responseMessage(res: unknown): string | undefined {
  const message = isRecord(res) ? res['message'] : undefined;
  return typeof message === 'string' && message ? message : undefined;
}

/** A literal message, or one derived from the value it describes. */
export function resolveMessage<T>(
  message: string | ((value: T) => string) | undefined,
  value: T,
): string | undefined {
  return typeof message === 'function' ? message(value) : message;
}

/** Wraps whatever a transport threw as an `HttpErrorResponse`, so `exceptionFn` sees one type. */
export function toHttpError(err: unknown, url?: string): HttpErrorResponse {
  if (err instanceof HttpErrorResponse) return err;
  return new HttpErrorResponse({
    error: err,
    url,
    statusText: err instanceof Error ? err.message : String(err),
  });
}

/** The most useful message for an exception — the server's own words first. */
export function httpErrorMessage(err: HttpErrorResponse, messages: FetchMessages): string {
  const body: unknown = err.error;

  if (isRecord(body) || body instanceof Error) {
    const fields = body as unknown as Record<string, unknown>;
    for (const key of ['message', 'error_description', 'error']) {
      const value = fields[key];
      if (typeof value === 'string' && value) return value;
    }
  }

  // plain-text error bodies are fine to show; HTML error pages are not
  if (typeof body === 'string' && body && !body.trimStart().startsWith('<')) return body;

  return err.status === 0 ? messages.network : messages.error;
}

/** Network failures and 5xx are worth retrying; 4xx, GraphQL errors and custom errors are not. */
export function isRetryable(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500);
}
