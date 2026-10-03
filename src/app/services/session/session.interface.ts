import { Observable } from 'rxjs';

export interface SessionUser {
  id: string | number;
  /** display name */
  name: string;
  username?: string;
  email?: string;
  /** image URL */
  avatar?: string;
  /** the user's kind, matched against `visibleFor` on menus and routes (GASCO: 'internal' / 'external') */
  type?: string;
  roles?: string[];
  permissions?: string[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms — a stored session past it is dropped at start-up */
  expiresAt?: number;
}

export interface Session {
  user: SessionUser;
  tokens: SessionTokens;
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** the sign-up form's value — whatever fields the app's register form has */
export type RegisterRequest = Record<string, unknown>;

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResult {
  /** demo APIs only: where the emailed link would have pointed, so the flow can be tried */
  demoResetUrl?: string;
}

export interface ResetPasswordRequest {
  /** from the emailed link */
  token: string;
  password: string;
}

/** who may see or open something — the same shape as a menu item's `permissions` / `visibleFor` */
export interface AccessRule {
  /** any one of them is enough; none = everyone */
  permissions?: readonly string[];
  /** user types allowed; none = everyone */
  visibleFor?: readonly string[];
}

export type SessionResult<T> = Promise<T> | Observable<T>;

/** The app's auth backend, as `provideSessionConfig({ api })` takes it. */
export interface SessionApi {
  login(request: LoginRequest): SessionResult<Session>;
  /** the user behind stored tokens — validates a remembered session in the background at start-up */
  me?(tokens: SessionTokens): SessionResult<SessionUser>;
  register(request: RegisterRequest): SessionResult<unknown>;
  forgotPassword(request: ForgotPasswordRequest): SessionResult<ForgotPasswordResult | void>;
  resetPassword(request: ResetPasswordRequest): SessionResult<unknown>;
  /** tell the server; the local session is cleared either way */
  logout?(session: Session): SessionResult<unknown>;
}

/** A failure whose message is written for the user — "Incorrect username or password." */
export class SessionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SessionError';
  }
}
