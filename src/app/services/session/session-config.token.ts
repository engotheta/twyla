import { InjectionToken, Provider } from '@angular/core';
import { LoginRequest, SessionApi } from './session.interface';

export interface SessionConfig {
  api: SessionApi;
  /** where `authGuard` sends visitors (with `?returnUrl=`) and sign-out lands */
  loginUrl: string;
  /** where sign-in lands without a `returnUrl`, and `guestGuard` / `permissionGuard` send people */
  homeUrl: string;
  /** localStorage / sessionStorage key of the stored session */
  storageKey: string;
  /** requests that get `Authorization: Bearer <token>`: URL prefixes or patterns. None by default. */
  tokenUrls: (string | RegExp)[];
  /** demos only: shown on the sign-in page with a "Use demo account" button */
  demoCredentials?: LoginRequest;
}

function notConfigured(): never {
  throw new Error(
    'No session API is configured — add provideSessionConfig({ api }) to the app config ' +
      '(see services/session/README.md).',
  );
}

const MISSING_API: SessionApi = {
  login: notConfigured,
  register: notConfigured,
  forgotPassword: notConfigured,
  resetPassword: notConfigured,
};

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  api: MISSING_API,
  loginUrl: '/auth/login',
  homeUrl: '/modules',
  storageKey: 'session',
  tokenUrls: [],
};

export const SESSION_CONFIG = new InjectionToken<SessionConfig>('SESSION_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_SESSION_CONFIG,
});

/**
 * Overrides part of `SessionConfig`. Pass a factory when it needs DI — it runs in an injection
 * context: `provideSessionConfig(() => ({ api: myAuthApi(inject(HttpClient)) }))`.
 */
export function provideSessionConfig(
  config: Partial<SessionConfig> | (() => Partial<SessionConfig>),
): Provider {
  return {
    provide: SESSION_CONFIG,
    useFactory: (): SessionConfig => ({
      ...DEFAULT_SESSION_CONFIG,
      ...(typeof config === 'function' ? config() : config),
    }),
  };
}
