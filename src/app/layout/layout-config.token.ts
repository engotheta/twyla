import { InjectionToken, Provider, Signal, signal } from '@angular/core';
import { ActionButton } from '../components/action-buttons/action-button.interface';
import { Menu, MenuAccess } from './menu/menu.interface';

export interface LayoutBrand {
  name: string;
  /** one line under the name where there's room (auth pages, landing) */
  tagline?: string;
  /** a static image, rendered with `NgOptimizedImage`; without one an inline mark is drawn */
  logo?: { src: string; width: number; height: number };
}

export interface LayoutUser {
  name: string;
  email?: string;
  /** image URL; initials are shown without one (or when it fails to load) */
  avatar?: string;
  /** a second line under the name in the user menu, e.g. the role */
  subtitle?: string;
}

export interface LayoutNotification {
  id: string | number;
  title: string;
  text?: string;
  /** shown as given, e.g. '5 min ago' */
  time?: string;
  icon?: string;
  unread?: boolean;
}

export interface LayoutLink {
  label: string;
  /** an in-app route… */
  route?: string;
  /** …or an external URL (opens in a new tab) */
  href?: string;
}

export interface LayoutConfig {
  brand: LayoutBrand;
  /** "All modules" in the rail, the brand's link, the user menu's Modules entry */
  homeUrl: string;
  /** "Sign in" in the header when nobody is signed in */
  signInUrl: string;
  /**
   * Whether the current user may see an item, module or route: reads `permissions` /
   * `visibleFor`. Read inside `computed`s, so a signal-based check (a session's user) keeps the
   * menus live. Default: everything is visible.
   */
  canAccess: (item: MenuAccess) => boolean;
  /** the signed-in user, for the header's user menu */
  user: Signal<LayoutUser | null>;
  /** extra user-menu entries, between "All modules" and "Sign out" */
  userMenu: Menu[];
  signOut?: () => void;
  /** extra header buttons, left of the notifications bell */
  headerActions: ActionButton[];
  /** shows the notifications bell when set */
  notifications?: Signal<readonly LayoutNotification[]>;
  onNotification?: (notification: LayoutNotification) => void;
  markAllRead?: () => void;
  footer: { owner: string; ownerUrl?: string; links: LayoutLink[]; version?: string };
  /** prefix for what the layout remembers in localStorage (whether the sidebar is shown) */
  storageKey: string;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  brand: { name: 'Studio' },
  homeUrl: '/modules',
  signInUrl: '/auth/login',
  canAccess: () => true,
  user: signal(null),
  userMenu: [],
  headerActions: [],
  footer: { owner: 'Studio', links: [] },
  storageKey: 'layout',
};

export const LAYOUT_CONFIG = new InjectionToken<LayoutConfig>('LAYOUT_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_LAYOUT_CONFIG,
});

export type LayoutConfigOverrides = Partial<Omit<LayoutConfig, 'brand' | 'footer'>> & {
  brand?: Partial<LayoutBrand>;
  footer?: Partial<LayoutConfig['footer']>;
};

/**
 * Overrides part of `LayoutConfig`. Pass a factory when it needs DI — it runs in an injection
 * context: `provideLayoutConfig(() => { const session = inject(SessionService); return {
 * user: session.user, canAccess: (item) => session.canAccess(item) }; })`.
 */
export function provideLayoutConfig(
  config: LayoutConfigOverrides | (() => LayoutConfigOverrides),
): Provider {
  return {
    provide: LAYOUT_CONFIG,
    useFactory: (): LayoutConfig => {
      const overrides = typeof config === 'function' ? config() : config;
      return {
        ...DEFAULT_LAYOUT_CONFIG,
        ...overrides,
        brand: { ...DEFAULT_LAYOUT_CONFIG.brand, ...overrides.brand },
        footer: { ...DEFAULT_LAYOUT_CONFIG.footer, ...overrides.footer },
      };
    },
  };
}
