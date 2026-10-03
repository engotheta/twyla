import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { LG_UP_QUERY, mediaQuerySignal } from '../services/view/viewport.util';
import { LAYOUT_CONFIG } from './layout-config.token';

/**
 * The app layout's navigation state. From `lg` up the sidebar sits beside the content and the
 * toggle shows / hides it (remembered); below `lg` it's an overlay drawer, closed by default.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly storageKey = `${inject(LAYOUT_CONFIG).storageKey}.sidebarOpened`;
  private readonly storage = localStorageOf(inject(DOCUMENT).defaultView);

  /** wide enough for the module rail and a docked sidebar */
  readonly large = mediaQuerySignal(LG_UP_QUERY);

  private readonly docked = signal(readFlag(this.storage, this.storageKey) ?? true);
  /** the drawer (below `lg`) is open */
  readonly drawerOpen = signal(false);

  /** whether the sidebar is showing right now */
  readonly sidebarVisible = computed(() => (this.large() ? this.docked() : this.drawerOpen()));

  toggleSidebar(): void {
    if (this.large()) {
      this.docked.update((docked) => !docked);
      writeFlag(this.storage, this.storageKey, this.docked());
    } else {
      this.drawerOpen.update((open) => !open);
    }
  }

  /** keeps the state in step when the drawer closes itself (Esc, backdrop) */
  sidebarChanged(open: boolean): void {
    if (this.large()) {
      if (open !== this.docked()) {
        this.docked.set(open);
        writeFlag(this.storage, this.storageKey, open);
      }
    } else {
      this.drawerOpen.set(open);
    }
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}

function readFlag(storage: Storage | undefined, key: string): boolean | undefined {
  try {
    const value = storage?.getItem(key) ?? null;
    return value === null ? undefined : value === 'true';
  } catch {
    return undefined; // storage blocked: fall back to the default
  }
}

function writeFlag(storage: Storage | undefined, key: string, value: boolean): void {
  try {
    storage?.setItem(key, String(value));
  } catch {
    // storage blocked or full: the preference just isn't remembered
  }
}

/** where the browser blocks storage, even reading `window.localStorage` throws */
function localStorageOf(win: Window | null): Storage | undefined {
  try {
    return win?.localStorage;
  } catch {
    return undefined;
  }
}
