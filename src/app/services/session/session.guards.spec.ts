import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NotificationService } from '../notification/notification.service';
import { createFakeSessionApi } from './fake-session.api';
import { provideSessionConfig } from './session-config.token';
import {
  authGuard,
  guestGuard,
  permissionGuard,
  requiresSession,
  safeReturnUrl,
} from './session.guards';
import { SessionService } from './session.service';

@Component({ template: 'page' })
class PageComponent {}

describe('session guards', () => {
  let warn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.defaultView?.localStorage?.clear();
    document.defaultView?.sessionStorage?.clear();
    warn = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/login', component: PageComponent, canActivate: [guestGuard] },
          { path: 'modules', component: PageComponent, canActivate: [authGuard] },
          { path: 'public', component: PageComponent },
          {
            path: 'admin',
            canActivate: [authGuard, permissionGuard],
            data: { permissions: ['admin'] },
            children: [{ path: 'users', component: PageComponent }],
          },
          {
            path: 'portal',
            canActivate: [authGuard, permissionGuard],
            data: { visibleFor: ['external'] },
            component: PageComponent,
          },
        ]),
        provideSessionConfig({ api: createFakeSessionApi({ latency: 0 }), homeUrl: '/modules' }),
        { provide: NotificationService, useValue: { warn, info: vi.fn() } },
      ],
    });
  });

  const url = () => TestBed.inject(Router).url;
  const signIn = (permissions: string[] = []) =>
    TestBed.inject(SessionService)
      .login({ username: 'ada', password: 'x' })
      .then((session) => {
        session.user.permissions = permissions;
      });

  it('authGuard sends visitors to sign in, remembering where they were going', async () => {
    await RouterTestingHarness.create('/admin/users');
    expect(url()).toBe('/auth/login?returnUrl=%2Fadmin%2Fusers');
  });

  it('guestGuard sends signed-in users home', async () => {
    await signIn();
    await RouterTestingHarness.create('/auth/login');
    expect(url()).toBe('/modules');
  });

  it('permissionGuard checks data.permissions, with a notice when refused', async () => {
    await signIn([]);
    const harness = await RouterTestingHarness.create('/admin/users');
    expect(url()).toBe('/modules');
    expect(warn).toHaveBeenCalledWith("You don't have access to that page.");

    await TestBed.inject(SessionService).login({ username: 'root', password: 'x' });
    TestBed.inject(SessionService).session()!.user.permissions = ['admin'];
    await harness.navigateByUrl('/admin/users');
    expect(url()).toBe('/admin/users');
  });

  it('permissionGuard checks data.visibleFor against the user type', async () => {
    await signIn();
    await RouterTestingHarness.create('/portal'); // the fake user is 'internal'
    expect(url()).toBe('/modules');
  });

  it('requiresSession tells protected pages from public ones', async () => {
    await signIn();
    const harness = await RouterTestingHarness.create('/modules');
    expect(requiresSession(TestBed.inject(Router))).toBe(true);
    await harness.navigateByUrl('/public');
    expect(requiresSession(TestBed.inject(Router))).toBe(false);
  });

  it('safeReturnUrl only lets in-app paths through', () => {
    expect(safeReturnUrl('/components/form?x=1')).toBe('/components/form?x=1');
    expect(safeReturnUrl('//evil.example')).toBeUndefined();
    expect(safeReturnUrl('/\\evil.example')).toBeUndefined();
    expect(safeReturnUrl('https://evil.example')).toBeUndefined();
    expect(safeReturnUrl(undefined)).toBeUndefined();
  });
});
