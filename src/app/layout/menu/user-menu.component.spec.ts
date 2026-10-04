import { ANIMATION_MODULE_TYPE, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideI18n } from '@services/i18n/i18n-config.token';
import { I18nService } from '@services/i18n/i18n.service';
import { LayoutConfigOverrides, LayoutUser, provideLayoutConfig } from '../layout-config.token';
import { UserMenuComponent } from './user-menu.component';

describe('UserMenuComponent', () => {
  let fixture: ComponentFixture<UserMenuComponent>;
  let host: HTMLElement;
  const user = signal<LayoutUser | null>(null);
  const signOut = vi.fn();

  async function mount(config: LayoutConfigOverrides = {}): Promise<void> {
    TestBed.configureTestingModule({
      imports: [UserMenuComponent],
      providers: [
        provideRouter([]),
        provideI18n({
          languages: [
            { code: 'en', name: 'English', locale: 'en-GB' },
            { code: 'sw', name: 'Kiswahili', locale: 'sw-TZ' },
          ],
        }),
        provideLayoutConfig({
          user,
          signOut,
          userMenu: [
            { route: '/account/profile', name: 'Profile', icon: 'person' },
            { route: '/account/security', name: 'Security', icon: 'lock' },
          ],
          ...config,
        }),
        // the menu opens and closes at once instead of on animation timers
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    fixture = TestBed.createComponent(UserMenuComponent);
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  }

  const trigger = (): HTMLButtonElement => host.querySelector('button')!;
  const menu = (): HTMLElement | null => document.querySelector('[role="menu"]');
  /** a row's text, without its icon's ligature */
  const text = (row: Element): string => {
    const copy = row.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('mat-icon').forEach((icon) => icon.remove());
    return copy.textContent!.replace(/\s+/g, ' ').trim();
  };
  /** the menu's content in order: the heading's lines as `name / second line`, `---` for a line,
   *  an item as `text → where it goes` */
  const outline = (): string[] =>
    Array.from(menu()!.querySelector('.mat-mdc-menu-content')!.children).map((child) => {
      if (child.matches('mat-divider')) return '---';
      if (!child.matches('[role="menuitem"]'))
        return Array.from(child.children, (line) => line.textContent!.trim()).join(' / ');
      const href = child.getAttribute('href');
      return href ? `${text(child)} → ${href}` : text(child);
    });

  async function open(): Promise<void> {
    trigger().click();
    await settle();
  }

  beforeEach(() => {
    user.set({ name: 'Ada Lovelace', email: 'ada@example.com' });
    signOut.mockClear();
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
    document.documentElement.lang = 'en';
  });

  it('offers to sign in when nobody is signed in', async () => {
    user.set(null);
    await mount({ signInUrl: '/enter' });

    const link = host.querySelector('a')!;
    expect(link.textContent?.trim()).toBe('Sign in');
    expect(link.getAttribute('href')).toBe('/enter');
    expect(host.querySelector('button')).toBeNull();
  });

  it('is a button named after the account, showing their initials and name', async () => {
    await mount();

    expect(trigger().getAttribute('aria-label')).toBe('Account: Ada Lovelace');
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().querySelector('action-avatar')?.textContent?.trim()).toBe('AL');
    expect(text(trigger())).toBe('AL Ada Lovelace');
  });

  it('shows their picture when they have one', async () => {
    user.set({ name: 'Ada Lovelace', avatar: 'ada.png' });
    await mount();

    expect(trigger().querySelector('img')?.getAttribute('src')).toBe('ada.png');
  });

  it('opens a menu headed by who they are, then the pages, then signing out', async () => {
    await mount();
    await open();

    expect(outline()).toEqual([
      'Ada Lovelace / ada@example.com',
      '---',
      'All modules → /modules',
      'Profile → /account/profile',
      'Security → /account/security',
      '---',
      'Sign out',
    ]);
    const title = document.getElementById(menu()!.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toBe('Ada Lovelace');
  });

  it("puts the user's subtitle under their name, ahead of the email", async () => {
    user.set({ name: 'Ada Lovelace', email: 'ada@example.com', subtitle: 'Administrator' });
    await mount();
    await open();

    expect(outline()[0]).toBe('Ada Lovelace / Administrator');
  });

  it('follows the user as they change', async () => {
    await mount();
    user.set({ name: 'Grace Hopper' });
    await settle();

    expect(trigger().getAttribute('aria-label')).toBe('Account: Grace Hopper');
    await open();
    // nothing to say under the name: the heading is the name alone
    expect(outline()[0]).toBe('Grace Hopper');
  });

  it('signs out from the last item, and closes', async () => {
    await mount();
    await open();

    const items = menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[items.length - 1].click();
    await settle();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(menu()).toBeNull();
  });

  it('leaves out signing out, and its divider, where the app gives no way to', async () => {
    await mount({ signOut: undefined });
    await open();

    expect(outline()).toEqual([
      'Ada Lovelace / ada@example.com',
      '---',
      'All modules → /modules',
      'Profile → /account/profile',
      'Security → /account/security',
    ]);
  });

  it("speaks the user's language: its own text, and the app's names through `translate`", async () => {
    const names: Record<string, string> = { Profile: 'Wasifu', Security: 'Usalama' };
    await mount({
      translate: (name) =>
        TestBed.inject(I18nService).language() === 'sw' ? (names[name] ?? name) : name,
    });

    TestBed.inject(I18nService).use('sw');
    await settle();
    expect(trigger().getAttribute('aria-label')).toBe('Akaunti: Ada Lovelace');

    await open();
    expect(outline().slice(2)).toEqual([
      'Moduli zote → /modules',
      'Wasifu → /account/profile',
      'Usalama → /account/security',
      '---',
      'Ondoka',
    ]);
  });
});
