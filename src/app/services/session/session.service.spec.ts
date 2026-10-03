import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotificationService } from '../notification/notification.service';
import { createFakeSessionApi } from './fake-session.api';
import { provideSessionConfig } from './session-config.token';
import { Session, SessionApi, SessionError } from './session.interface';
import { SessionService } from './session.service';

const KEY = 'test.session';

/**
 * This test environment has no Web Storage (`document.defaultView` is Node's global, whose
 * `localStorage` is an empty stub), so each test gets an in-memory one.
 */
function installMemoryStorage(): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    const data = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      getItem: (key) => data.get(key) ?? null,
      key: (index) => [...data.keys()][index] ?? null,
      removeItem: (key) => void data.delete(key),
      setItem: (key, value) => void data.set(key, String(value)),
    };
    Object.defineProperty(document.defaultView!, name, { value: storage, configurable: true });
  }
}

const local = () => document.defaultView!.localStorage;
const perTab = () => document.defaultView!.sessionStorage;

const stored = (expiresAt?: number): Session => ({
  user: { id: 7, name: 'Ada Lovelace', type: 'internal', permissions: ['admin'] },
  tokens: { accessToken: 'tok-7', expiresAt },
});

describe('SessionService', () => {
  let notify: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  function setUp(api: Partial<SessionApi> = {}): SessionService {
    notify = { info: vi.fn(), warn: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideSessionConfig({
          api: { ...createFakeSessionApi({ latency: 0 }), ...api },
          storageKey: KEY,
        }),
        { provide: NotificationService, useValue: notify },
      ],
    });
    return TestBed.inject(SessionService);
  }

  beforeEach(() => installMemoryStorage());

  it('signs in to sessionStorage, or localStorage when remembered', async () => {
    const session = setUp();
    await session.login({ username: 'ada.lovelace', password: 'x' });
    expect(session.user()?.name).toBe('Ada Lovelace');
    expect(session.isAuthenticated()).toBe(true);
    expect(perTab().getItem(KEY)).toContain('"accessToken"');
    expect(local().getItem(KEY)).toBeNull();

    await session.login({ username: 'ada', password: 'x' }, true);
    expect(local().getItem(KEY)).toContain('"accessToken"');
    expect(perTab().getItem(KEY)).toBeNull();
  });

  it('restores a stored session, and drops an expired one', () => {
    local().setItem(KEY, JSON.stringify(stored(Date.now() + 60_000)));
    expect(setUp().user()?.name).toBe('Ada Lovelace');

    TestBed.resetTestingModule();
    local().setItem(KEY, JSON.stringify(stored(Date.now() - 1)));
    expect(setUp().isAuthenticated()).toBe(false);
    expect(local().getItem(KEY)).toBeNull();
  });

  it('ignores a stored session that does not parse into one', () => {
    perTab().setItem(KEY, '{"user":{}}');
    expect(setUp().isAuthenticated()).toBe(false);
  });

  it('checks permissions (any one) and visibleFor (the user type)', async () => {
    local().setItem(KEY, JSON.stringify(stored()));
    const session = setUp();
    expect(session.hasPermission()).toBe(true);
    expect(session.hasPermission(['admin', 'other'])).toBe(true);
    expect(session.hasPermission(['other'])).toBe(false);
    expect(session.canAccess({ visibleFor: ['internal'] })).toBe(true);
    expect(session.canAccess({ visibleFor: ['external'] })).toBe(false);
    expect(session.canAccess({ visibleFor: ['internal'], permissions: ['other'] })).toBe(false);
  });

  it('logout clears the session and goes to the sign-in page', async () => {
    const session = setUp();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await session.login({ username: 'ada', password: 'x' }, true);

    await session.logout();
    expect(session.isAuthenticated()).toBe(false);
    expect(local().getItem(KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/auth/login');
    expect(notify.info).toHaveBeenCalled();
  });

  it('drops a stored session the API rejects (401), keeps it when offline', async () => {
    local().setItem(KEY, JSON.stringify(stored()));
    const rejected = setUp({ me: () => Promise.reject(new SessionError('expired', 401)) });
    await new Promise((resolve) => setTimeout(resolve));
    expect(rejected.isAuthenticated()).toBe(false);
    expect(notify.warn).toHaveBeenCalled();

    TestBed.resetTestingModule();
    local().setItem(KEY, JSON.stringify(stored()));
    const offline = setUp({
      me: () => Promise.reject(new HttpErrorResponse({ status: 0 })),
    });
    await new Promise((resolve) => setTimeout(resolve));
    expect(offline.isAuthenticated()).toBe(true);
  });

  it('refreshes the stored user from the API', async () => {
    local().setItem(KEY, JSON.stringify(stored()));
    const session = setUp({ me: () => Promise.resolve({ id: 7, name: 'Ada King' }) });
    await new Promise((resolve) => setTimeout(resolve));
    expect(session.user()?.name).toBe('Ada King');
    expect(local().getItem(KEY)).toContain('Ada King');
  });

  it('errorMessage speaks to the user', () => {
    const session = setUp();
    expect(session.errorMessage(new SessionError('Incorrect username or password.'))).toBe(
      'Incorrect username or password.',
    );
    expect(session.errorMessage(new HttpErrorResponse({ status: 0 }))).toContain("Couldn't reach");
    expect(session.errorMessage(new HttpErrorResponse({ status: 503 }))).toContain('server');
    expect(
      session.errorMessage(
        new HttpErrorResponse({ status: 422, error: { message: 'Email taken' } }),
      ),
    ).toBe('Email taken');
    expect(session.errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });

  it('without an API configured, calls fail with a pointer to the setup', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    await expect(
      TestBed.inject(SessionService).login({ username: 'a', password: 'b' }),
    ).rejects.toThrow('provideSessionConfig');
  });
});
