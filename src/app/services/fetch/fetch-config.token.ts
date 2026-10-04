import { HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, Provider } from '@angular/core';

export interface FetchMessages {
  /** Success toast when neither `successMessage` nor the payload's own `message` says anything. */
  success: string;
  /** Toast for a 2xx payload that reports failure without a message of its own. */
  failed: string;
  /** Toast for an exception that carries no usable message. */
  error: string;
  /** Toast when the server couldn't be reached at all (status 0). */
  network: string;
}

export interface FetchConfig {
  /** Base URL that REST slugs resolve against; '' keeps them relative to the app. */
  apiBaseUrl: string;
  /** GraphQL endpoint — a slug (resolved like REST urls) or an absolute URL. Default: the
   *  `graphql` slug, so queries only ever go to the app's own `apiBaseUrl` unless it says otherwise. */
  graphqlUrl: string;
  /** Whether a 2xx payload succeeded. Default: anything except `{ success: false }`. */
  isSuccess: (res: unknown) => boolean;
  /**
   * Global exception hook (401 → login, 403 → error page, …). Runs before the call's own
   * `exceptionFn` unless it opted out with `notify.handleException: false`. Return `true` to mark
   * the error handled, which suppresses the error toast.
   */
  onException?: (err: HttpErrorResponse) => boolean | void;
  /** Ms to wait before retry number `attempt` (1-based). Default: 500 ms doubling, capped at 8 s. */
  retryDelay: (attempt: number) => number;
  /** An app's own wording for the fallback toasts. What is left out is `FETCH_MESSAGES`, in the
   *  user's language. */
  messages: Partial<FetchMessages>;
}

export const DEFAULT_FETCH_CONFIG: FetchConfig = {
  apiBaseUrl: '',
  graphqlUrl: 'graphql',
  isSuccess: (res) => (res as { success?: unknown } | null | undefined)?.success !== false,
  retryDelay: (attempt) => Math.min(500 * 2 ** (attempt - 1), 8000),
  messages: {},
};

export const FETCH_CONFIG = new InjectionToken<FetchConfig>('FETCH_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_FETCH_CONFIG,
});

export type FetchConfigOverrides = Partial<Omit<FetchConfig, 'messages'>> & {
  messages?: Partial<FetchMessages>;
};

/**
 * Overrides part of `FetchConfig`. Pass a factory when the config needs DI — it runs in an
 * injection context: `provideFetchConfig(() => { const router = inject(Router); return {
 * onException: (err) => err.status === 401 && (router.navigateByUrl('/login'), true) }; })`.
 */
export function provideFetchConfig(
  config: FetchConfigOverrides | (() => FetchConfigOverrides),
): Provider {
  return {
    provide: FETCH_CONFIG,
    useFactory: (): FetchConfig => {
      const overrides = typeof config === 'function' ? config() : config;
      return {
        ...DEFAULT_FETCH_CONFIG,
        ...overrides,
        messages: { ...DEFAULT_FETCH_CONFIG.messages, ...overrides.messages },
      };
    },
  };
}
