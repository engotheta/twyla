import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, Observable, switchMap, throwError } from 'rxjs';
import { createFakeSessionApi } from '@services/session/fake-session.api';
import {
  SessionApi,
  SessionError,
  SessionTokens,
  SessionUser,
} from '@services/session/session.interface';

/** the demo account dummyjson ships (role 'admin') */
export const DUMMYJSON_DEMO_CREDENTIALS = { username: 'emilys', password: 'emilyspass' };

const AUTH_URL = 'https://dummyjson.com/auth';
const EXPIRES_IN_MINS = 60;

interface DummyUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image?: string;
  role?: string;
}

interface DummyLogin extends DummyUser {
  accessToken: string;
  refreshToken?: string;
}

/**
 * The studio's session backend: a real sign-in against dummyjson.com (`POST /auth/login`, then
 * `GET /auth/me` for the role), so tokens, avatars and permissions are real; registering and
 * password resets stay local (`createFakeSessionApi`) — dummyjson can't send emails. Call it from
 * `provideSessionConfig(() => ({ api: dummyJsonSessionApi() }))`: it injects HttpClient.
 */
export function dummyJsonSessionApi(): SessionApi {
  const http = inject(HttpClient);

  const me = (tokens: SessionTokens): Observable<SessionUser> =>
    http
      .get<DummyUser>(`${AUTH_URL}/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      .pipe(map(toSessionUser));

  return {
    ...createFakeSessionApi(),
    me,
    login: ({ username, password }) =>
      http
        .post<DummyLogin>(`${AUTH_URL}/login`, {
          username,
          password,
          expiresInMins: EXPIRES_IN_MINS,
        })
        .pipe(
          map((response): SessionTokens => ({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: Date.now() + EXPIRES_IN_MINS * 60 * 1000,
          })),
          switchMap((tokens) => me(tokens).pipe(map((user) => ({ user, tokens })))),
          catchError((error: unknown) =>
            throwError(() =>
              error instanceof HttpErrorResponse && (error.status === 400 || error.status === 401)
                ? new SessionError('Incorrect username or password.', error.status)
                : error,
            ),
          ),
        ),
  };
}

function toSessionUser(user: DummyUser): SessionUser {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim() || user.username,
    username: user.username,
    email: user.email,
    avatar: user.image,
    type: 'internal',
    roles: user.role ? [user.role] : [],
    // the studio's Administration module asks for 'admin'
    permissions: user.role === 'admin' ? ['admin'] : [],
  };
}
