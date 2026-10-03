import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { NotificationService } from '@services/notification/notification.service';
// guards ↔ service import each other, but only inside functions run later — no load-order issue
import { requiresSession } from './session.guards';
import { SESSION_CONFIG } from './session-config.token';
import {
  AccessRule,
  ForgotPasswordRequest,
  ForgotPasswordResult,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  Session,
  SessionError,
  SessionResult,
  SessionUser,
} from './session.interface';

/**
 * Who is signed in, as signals, plus the session calls the auth pages make. The session is kept
 * in localStorage ("keep me signed in") or sessionStorage, restored at start-up — dropped if
 * expired, re-checked in the background with `api.me` — and kept in step across tabs.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly config = inject(SESSION_CONFIG);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly local = storageOf(this.window, 'localStorage');
  private readonly perTab = storageOf(this.window, 'sessionStorage');

  private readonly state = signal<Session | null>(this.restore());

  readonly session = this.state.asReadonly();
  readonly user = computed<SessionUser | null>(() => this.state()?.user ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  /** the access token the interceptor sends */
  readonly token = computed(() => this.state()?.tokens.accessToken);

  constructor() {
    // after construction: `me` goes through HttpClient, whose interceptor injects this service
    queueMicrotask(() => this.revalidate());
    this.syncAcrossTabs();
  }

  /** has any one of `permissions` (none required = true) */
  readonly hasPermission = (permissions?: readonly string[]): boolean => {
    if (!permissions?.length) return true;
    const granted = this.user()?.permissions ?? [];
    return permissions.some((permission) => granted.includes(permission));
  };

  /** `visibleFor` (the user's `type`) and `permissions` both allow it — `LayoutConfig.canAccess` */
  readonly canAccess = (rule: AccessRule): boolean => {
    if (rule.visibleFor?.length) {
      const type = this.user()?.type;
      if (!type || !rule.visibleFor.includes(type)) return false;
    }
    return this.hasPermission(rule.permissions);
  };

  /** Signs in; `remember` keeps the session across browser restarts (localStorage). */
  async login(request: LoginRequest, remember = false): Promise<Session> {
    const session = await settle(this.config.api.login(request));
    this.store(session, remember);
    this.state.set(session);
    return session;
  }

  /** Clears the session (and tells the API, best effort), then goes to the sign-in page. */
  async logout(): Promise<void> {
    const session = this.state();
    this.clear();
    if (session && this.config.api.logout) {
      try {
        await settle(this.config.api.logout(session));
      } catch {
        // the local session is gone either way
      }
    }
    await this.router.navigateByUrl(this.config.loginUrl);
    this.notifications.info('You have been signed out.');
  }

  register(request: RegisterRequest): Promise<unknown> {
    return settle(this.config.api.register(request));
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResult> {
    return (await settle(this.config.api.forgotPassword(request))) ?? {};
  }

  resetPassword(request: ResetPasswordRequest): Promise<unknown> {
    return settle(this.config.api.resetPassword(request));
  }

  /** a message for the user: the API's own (`SessionError`), else a plain one for the status */
  errorMessage(error: unknown): string {
    if (error instanceof SessionError) return error.message;
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0)
        return "Couldn't reach the server. Check your connection and try again.";
      if (error.status >= 500)
        return 'The server ran into a problem. Please try again in a moment.';
      const message = (error.error as { message?: unknown } | null)?.message;
      if (typeof message === 'string' && message) return message;
    }
    return 'Something went wrong. Please try again.';
  }

  /** a stored session the API no longer accepts: drop it, and leave a page that needs one */
  private revalidate(): void {
    const session = this.state();
    if (!session || !this.config.api.me) return;
    settle(this.config.api.me(session.tokens)).then(
      (user) => {
        if (this.state() !== session) return;
        const updated = { ...session, user };
        this.store(updated, this.storedIn() === 'local');
        this.state.set(updated);
      },
      (error: unknown) => {
        if (this.state() !== session || !isAuthFailure(error)) return; // offline: keep it
        this.clear();
        this.notifications.warn('Your session has expired. Please sign in again.');
        this.leaveProtectedPage();
      },
    );
  }

  /** signing in or out in another tab (remembered sessions — localStorage is shared) */
  private syncAcrossTabs(): void {
    const win = this.window;
    if (!win) return;
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== this.config.storageKey || event.storageArea !== this.local) return;
      const wasSignedIn = this.isAuthenticated();
      this.state.set(this.restore());
      if (wasSignedIn && !this.isAuthenticated()) this.leaveProtectedPage();
    };
    win.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => win.removeEventListener('storage', onStorage));
  }

  private leaveProtectedPage(): void {
    if (!requiresSession(this.router)) return;
    void this.router.navigate([this.config.loginUrl], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  private store(session: Session, remember: boolean): void {
    const json = JSON.stringify(session);
    write(remember ? this.local : this.perTab, this.config.storageKey, json);
    write(remember ? this.perTab : this.local, this.config.storageKey, null);
  }

  private clear(): void {
    write(this.local, this.config.storageKey, null);
    write(this.perTab, this.config.storageKey, null);
    this.state.set(null);
  }

  private storedIn(): 'local' | 'session' | undefined {
    if (read(this.local, this.config.storageKey)) return 'local';
    return read(this.perTab, this.config.storageKey) ? 'session' : undefined;
  }

  /** the stored session, if it parses and hasn't expired (an expired one is removed) */
  private restore(): Session | null {
    for (const storage of [this.local, this.perTab]) {
      const json = read(storage, this.config.storageKey);
      if (!json) continue;
      const session = parseSession(json);
      const expired =
        session?.tokens.expiresAt !== undefined && session.tokens.expiresAt <= Date.now();
      if (session && !expired) return session;
      write(storage, this.config.storageKey, null);
    }
    return null;
  }
}

/** a Promise or an Observable's first value */
function settle<T>(result: SessionResult<T>): Promise<T> {
  return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
}

function isAuthFailure(error: unknown): boolean {
  const status =
    error instanceof HttpErrorResponse || error instanceof SessionError ? error.status : undefined;
  return status === 401 || status === 403;
}

function parseSession(json: string): Session | null {
  try {
    const value = JSON.parse(json) as Partial<Session> | null;
    const valid =
      typeof value?.tokens?.accessToken === 'string' &&
      value.user !== undefined &&
      typeof value.user.name === 'string';
    return valid ? (value as Session) : null;
  } catch {
    return null;
  }
}

function read(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null; // storage blocked
  }
}

/** `null` removes */
function write(storage: Storage | undefined, key: string, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // storage blocked or full: the session lasts as long as the page
  }
}

/** where the browser blocks storage, even reading `window.localStorage` throws */
function storageOf(
  win: Window | null,
  kind: 'localStorage' | 'sessionStorage',
): Storage | undefined {
  try {
    return win?.[kind];
  } catch {
    return undefined;
  }
}
