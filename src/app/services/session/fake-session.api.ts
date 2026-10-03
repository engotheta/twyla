import { SessionApi, SessionError, SessionUser } from './session.interface';

export interface FakeSessionOptions {
  /** ms each call takes, so busy states show; default 600 */
  latency?: number;
  /** merged into the signed-in user */
  user?: Partial<SessionUser>;
}

/**
 * A `SessionApi` that runs in the browser only — for demos, tests and an app whose backend isn't
 * there yet. Any username and password sign in; registering succeeds; a password-reset request
 * returns `demoResetUrl` (a `demo-…` token), and only such tokens reset.
 */
export function createFakeSessionApi(options: FakeSessionOptions = {}): SessionApi {
  const latency = options.latency ?? 600;
  const later = <T>(produce: () => T): Promise<T> =>
    new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(produce());
        } catch (error) {
          reject(error);
        }
      }, latency),
    );

  return {
    login: ({ username }) =>
      later(() => ({
        user: {
          id: 1,
          name: displayName(username),
          username,
          email: username.includes('@') ? username : `${username}@example.com`,
          type: 'internal',
          roles: [],
          permissions: [],
          ...options.user,
        },
        tokens: { accessToken: `demo-${randomId()}`, expiresAt: Date.now() + 8 * 60 * 60 * 1000 },
      })),
    register: () => later(() => ({})),
    forgotPassword: () =>
      later(() => ({ demoResetUrl: `/auth/reset-password?token=demo-${randomId()}` })),
    resetPassword: ({ token }) =>
      later(() => {
        if (!token.startsWith('demo-')) {
          throw new SessionError('This reset link is invalid or has expired.', 400);
        }
        return {};
      }),
  };
}

function displayName(username: string): string {
  const base = username
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();
  return base ? base.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Demo user';
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
