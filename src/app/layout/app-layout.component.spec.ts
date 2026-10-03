import { ANIMATION_MODULE_TYPE, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppLayoutComponent } from './app-layout.component';
import { provideLayoutConfig } from './layout-config.token';
import { LayoutService } from './layout.service';
import { MenuService } from './menu/menu.service';

@Component({ template: '<p>page body</p>' })
class PageComponent {}

describe('AppLayoutComponent', () => {
  let fixture: ComponentFixture<AppLayoutComponent>;
  const signOut = vi.fn();

  const element = <T extends Element = HTMLElement>(selector: string) =>
    fixture.nativeElement.querySelector(selector) as T;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        provideRouter([
          {
            path: 'demo',
            data: { isMenu: true },
            children: [{ path: 'page', component: PageComponent }],
          },
        ]),
        provideLayoutConfig({
          brand: { name: 'Acme' },
          user: signal({ name: 'Ada Lovelace', email: 'ada@example.com' }),
          signOut,
          footer: { owner: 'Acme Ltd', version: '1.2.3' },
        }),
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    TestBed.inject(MenuService).setFromRoutes(
      [{ path: 'page', data: { isMenu: true, name: 'Page' } }],
      'demo',
    );
    fixture = TestBed.createComponent(AppLayoutComponent);
    await settle();
  });

  it('has the page landmarks: banner, navigation, main, contentinfo', () => {
    expect(element('header')).toBeTruthy();
    expect(element('nav[aria-label="Demo menu"]')).toBeTruthy();
    expect(element('main#main-content')).toBeTruthy();
    expect(element('footer')?.textContent).toContain('Acme Ltd');
    expect(element('footer')?.textContent).toContain('v1.2.3');
  });

  it('a skip link takes focus to the main content', () => {
    const skip = element<HTMLAnchorElement>('a[href="#main-content"]');
    expect(skip.textContent).toContain('Skip to main content');
    skip.click();
    expect(document.activeElement).toBe(element('main'));
  });

  it('renders the routed page in main', async () => {
    await TestBed.inject(Router).navigateByUrl('/demo/page');
    await settle();
    expect(element('main')?.textContent).toContain('page body');
  });

  it('the header toggle opens the drawer on a small screen', async () => {
    // jsdom has no matchMedia, so the layout runs in its small-screen (drawer) mode
    const toggle = element<HTMLButtonElement>('button[aria-controls="app-sidebar"]');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    await settle();
    expect(TestBed.inject(LayoutService).drawerOpen()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('the user menu names the account', () => {
    expect(element('button[aria-label="Account: Ada Lovelace"]')).toBeTruthy();
  });
});
