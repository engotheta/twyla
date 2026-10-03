import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotificationService } from '@services/notification';
import {
  createFakeSessionApi,
  provideSessionConfig,
  SessionApi,
  SessionError,
  SessionService,
} from '@services/session';
import { LoginPage } from './login.page';
import { ResetPasswordPage } from './reset-password.page';

describe('session pages', () => {
  let navigate: ReturnType<typeof vi.spyOn>;
  const success = vi.fn();

  function setUp(api: Partial<SessionApi> = {}): void {
    document.defaultView?.localStorage?.clear();
    document.defaultView?.sessionStorage?.clear();
    success.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideSessionConfig({
          api: { ...createFakeSessionApi({ latency: 0 }), ...api },
          homeUrl: '/modules',
          demoCredentials: { username: 'emilys', password: 'emilyspass' },
        }),
        { provide: NotificationService, useValue: { success, info: vi.fn(), warn: vi.fn() } },
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }

  /** renders, and lets the fake API's timers (latency 0) and the submit chain run */
  const settle = async (fixture: ComponentFixture<unknown>) => {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
    }
  };

  const type = (root: HTMLElement, selector: string, value: string) => {
    const input = root.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  describe('LoginPage', () => {
    async function render(returnUrl?: string): Promise<ComponentFixture<LoginPage>> {
      const fixture = TestBed.createComponent(LoginPage);
      if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
      await settle(fixture);
      return fixture;
    }

    it('is a real form with a heading, autocomplete hints and the reset link under the password', async () => {
      setUp();
      const root = (await render()).nativeElement as HTMLElement;
      expect(root.querySelector('h1')?.textContent).toContain('Sign in');
      expect(root.querySelector('form input[autocomplete="username"]')).toBeTruthy();
      expect(root.querySelector('form input[autocomplete="current-password"]')).toBeTruthy();
      expect(root.querySelector('form a[href="/auth/forgot-password"]')).toBeTruthy();
    });

    it('signs in and returns to the page the visitor was headed for', async () => {
      setUp();
      const fixture = await render('/components/form');
      const root = fixture.nativeElement as HTMLElement;
      type(root, 'input[autocomplete="username"]', ' ada ');
      type(root, 'input[autocomplete="current-password"]', 'secret');
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);

      expect(TestBed.inject(SessionService).user()?.username).toBe('ada');
      expect(navigate).toHaveBeenCalledWith('/components/form');
    });

    it('never returns to another site', async () => {
      setUp();
      const fixture = await render('//evil.example/phish');
      const root = fixture.nativeElement as HTMLElement;
      type(root, 'input[autocomplete="username"]', 'ada');
      type(root, 'input[autocomplete="current-password"]', 'secret');
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(navigate).toHaveBeenCalledWith('/modules');
    });

    it('shows why sign-in failed, and moves focus there', async () => {
      setUp({
        login: () => Promise.reject(new SessionError('Incorrect username or password.', 400)),
      });
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      type(root, 'input[autocomplete="username"]', 'ada');
      type(root, 'input[autocomplete="current-password"]', 'wrong');
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);

      const alert = root.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.textContent).toContain('Incorrect username or password.');
      expect(document.activeElement).toBe(alert);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('fills in the demo account', async () => {
      setUp();
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;
      const demo = Array.from(root.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Use demo account'),
      )!;
      demo.click();
      await settle(fixture);
      expect(root.querySelector<HTMLInputElement>('input[autocomplete="username"]')!.value).toBe(
        'emilys',
      );
    });
  });

  describe('ResetPasswordPage', () => {
    async function render(token?: string): Promise<ComponentFixture<ResetPasswordPage>> {
      const fixture = TestBed.createComponent(ResetPasswordPage);
      if (token) fixture.componentRef.setInput('token', token);
      await settle(fixture);
      return fixture;
    }

    it('without a token, offers a new link instead of the form', async () => {
      setUp();
      const root = (await render()).nativeElement as HTMLElement;
      expect(root.querySelector('form')).toBeNull();
      expect(root.textContent).toContain('incomplete or has expired');
      expect(root.querySelector('a[href="/auth/forgot-password"]')).toBeTruthy();
    });

    it('resets with a good token and sends the user to sign in', async () => {
      setUp();
      const fixture = await render('demo-123');
      const root = fixture.nativeElement as HTMLElement;
      const [password, confirm] = Array.from(
        root.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]'),
      );
      expect(root.querySelector('password-checklist')).toBeTruthy();
      for (const [input, value] of [
        [password, 'Str0ng!pass'],
        [confirm, 'Str0ng!pass'],
      ] as const) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);

      expect(success).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/auth/login');
    });

    it('explains a rejected token', async () => {
      setUp();
      const fixture = await render('stale');
      const root = fixture.nativeElement as HTMLElement;
      for (const input of Array.from(
        root.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]'),
      )) {
        input.value = 'Str0ng!pass';
        input.dispatchEvent(new Event('input'));
      }
      root.querySelector('form')!.dispatchEvent(new Event('submit'));
      await settle(fixture);
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('invalid or has expired');
    });
  });
});
