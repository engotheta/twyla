import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createFakeSessionApi } from './fake-session.api';
import { provideSessionConfig } from './session-config.token';
import { sessionInterceptor } from './session.interceptor';
import { SessionService } from './session.service';

describe('sessionInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    document.defaultView?.localStorage?.clear();
    document.defaultView?.sessionStorage?.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        provideSessionConfig({
          api: createFakeSessionApi({ latency: 0 }),
          tokenUrls: ['https://api.example/', /^\/api\//],
        }),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const authorization = (url: string, headers?: Record<string, string>) => {
    http.get(url, { headers }).subscribe();
    const request = backend.expectOne(url).request;
    return request.headers.get('Authorization');
  };

  it('sends nothing while signed out', () => {
    expect(authorization('https://api.example/users')).toBeNull();
  });

  it('adds the bearer token to the configured URLs only, never over a set header', async () => {
    const session = TestBed.inject(SessionService);
    await session.login({ username: 'ada', password: 'x' });
    const token = session.token();

    expect(authorization('https://api.example/users')).toBe(`Bearer ${token}`);
    expect(authorization('/api/reports')).toBe(`Bearer ${token}`);
    expect(authorization('https://elsewhere.example/users')).toBeNull();
    expect(authorization('https://api.example/me', { Authorization: 'Basic abc' })).toBe(
      'Basic abc',
    );
  });
});
