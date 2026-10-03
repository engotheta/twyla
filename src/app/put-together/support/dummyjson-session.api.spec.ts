import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { Session, SessionApi, SessionError } from '../../services/session';
import { dummyJsonSessionApi } from './dummyjson-session.api';

describe('dummyJsonSessionApi', () => {
  let api: SessionApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = runInInjectionContext(TestBed.inject(Injector), () => dummyJsonSessionApi());
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('signs in, then reads the role from /auth/me', async () => {
    const result = firstValueFrom(
      api.login({ username: 'emilys', password: 'emilyspass' }) as Observable<Session>,
    );

    const login = backend.expectOne('https://dummyjson.com/auth/login');
    expect(login.request.method).toBe('POST');
    expect(login.request.body).toMatchObject({ username: 'emilys', password: 'emilyspass' });
    login.flush({ id: 1, username: 'emilys', accessToken: 'jwt-1', refreshToken: 'r-1' });

    const me = backend.expectOne('https://dummyjson.com/auth/me');
    expect(me.request.headers.get('Authorization')).toBe('Bearer jwt-1');
    me.flush({
      id: 1,
      username: 'emilys',
      email: 'emily.johnson@x.dummyjson.com',
      firstName: 'Emily',
      lastName: 'Johnson',
      image: 'https://dummyjson.com/icon/emilys/128',
      role: 'admin',
    });

    const session = await result;
    expect(session.tokens.accessToken).toBe('jwt-1');
    expect(session.tokens.expiresAt).toBeGreaterThan(Date.now());
    expect(session.user).toMatchObject({
      name: 'Emily Johnson',
      avatar: 'https://dummyjson.com/icon/emilys/128',
      roles: ['admin'],
      permissions: ['admin'],
    });
  });

  it('turns a rejected sign-in into a message for the user', async () => {
    const result = firstValueFrom(api.login({ username: 'x', password: 'y' }) as Observable<Session>);
    backend
      .expectOne('https://dummyjson.com/auth/login')
      .flush({ message: 'Invalid credentials' }, { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toEqual(new SessionError('Incorrect username or password.', 400));
  });

  it('keeps registration and password resets local', async () => {
    await expect(api.forgotPassword({ email: 'a@b.c' })).resolves.toMatchObject({
      demoResetUrl: expect.stringContaining('/auth/reset-password?token=demo-'),
    });
  });
});
