import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { APP_ROUTES } from './app.routes';
import { createFakeSessionApi, provideSessionConfig } from './services/session';

describe('App', () => {
  beforeEach(async () => {
    // (no Web Storage in this test environment — the services cope without one)
    document.defaultView?.sessionStorage?.clear();
    document.defaultView?.localStorage?.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(APP_ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideSessionConfig({ api: createFakeSessionApi({ latency: 0 }) }),
      ],
    }).compileComponents();
  });

  it('renders every page through its router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('opens on the public home page', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/home');
    expect(harness.routeNativeElement?.textContent).toContain('Build admin apps');
  });

  it('sends visitors from a module to sign in, and back afterwards', async () => {
    await RouterTestingHarness.create('/components');
    // the module's index redirect (its first page) runs before the guard
    expect(TestBed.inject(Router).url).toBe('/auth/login?returnUrl=%2Fcomponents%2Fdata-grid');
  });

  it('shows the not-found page for unknown URLs', async () => {
    const harness = await RouterTestingHarness.create('/no/such/page');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Page not found',
    );
  });
});
