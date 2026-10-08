import { LiveAnnouncer } from '@angular/cdk/a11y';
import { createGlobalPositionStrategy, createOverlayRef, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injectable,
  Injector,
  isDevMode,
  signal,
  untracked,
} from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { injectMessages } from '@services/i18n/message-bundle';
import { ViewService } from '@services/view/view.service';
import { SHORTCUTS_CONFIG } from './shortcuts-config.token';
import {
  HELP_KEY,
  isModifierKey,
  isOnScreen,
  isTypingTarget,
  KeyRun,
  nearestHost,
  normalizeKey,
  openModal,
  orderHosts,
} from './shortcuts.helpers';
import {
  Shortcut,
  ShortcutBox,
  ShortcutHint,
  ShortcutRow,
  ShortcutScope,
  ShortcutTarget,
} from './shortcuts.interface';
import { SHORTCUTS_MESSAGES } from './shortcuts.messages';

/** the attribute the armed target's element carries, for whoever wants to style or find it */
const TARGET_ATTRIBUTE = 'data-shortcut-target';
/** what an action button that has a key carries: the key, and the name it goes by */
const BUTTON_ATTRIBUTE = 'data-shortcut';
const BUTTON_LABEL_ATTRIBUTE = 'data-shortcut-label';

/** a registered target, and when it was last clicked or focused */
interface Registered extends ShortcutTarget {
  touched: number;
}

/** one shortcut as it is offered now: its row, and what its key does */
interface Offered extends ShortcutRow {
  run: () => void;
  dismiss: boolean;
}

interface Armed {
  /** the scope's key, as the app has it */
  key: string;
  targets: Registered[];
  index: number;
}

/** the shortcut that ran last */
interface LastRun {
  target: Registered;
  id: string;
  label: string;
  /** which run this was: the same shortcut run twice is said twice */
  count: number;
}

/**
 * Keyboard shortcuts for whatever is on the page. A component registers what it offers under its
 * scope (`registerShortcuts`); pressing the scope's key several times in one quick run arms it
 * and shows a hint listing its keys, and one more key then runs a shortcut. The hint stays, so
 * several follow at a key each; the scope's key again moves to the next of its kind on the page,
 * `?` opens the full list, and Esc — or a pause — lets go.
 *
 * Keys typed in a field are never counted, nor is a key held down, nor one pressed with Ctrl,
 * Alt or Meta. Everything a key does is also a button in the panel (`openPanel`), and whatever
 * a shortcut did is announced.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutsService {
  private readonly config = inject(SHORTCUTS_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  private readonly view = inject(ViewService);
  private readonly t = injectMessages(SHORTCUTS_MESSAGES);

  /** the app has shortcuts at all — whether a switch for them is worth showing */
  readonly available = this.config.enabled;
  /** how many presses of a scope's key arm it */
  readonly presses = this.config.presses;

  private readonly switchedOn = signal(true);
  /** shortcuts answer: the app has them, and the person has not turned them off */
  readonly enabled = computed(() => this.available && this.switchedOn());

  private readonly registered = signal<readonly Registered[]>([]);
  private readonly armed = signal<Armed | null>(null);
  private readonly lastRun = signal<LastRun | null>(null);

  /**
   * What the last shortcut did, in words: "Paginator: off", or just its name. Read off where the
   * shortcut stands NOW rather than noted as it ran: a change may land a moment later (the theme
   * commits inside a view transition), and what is said has to be what happened.
   */
  private readonly said = computed(() => {
    const last = this.lastRun();
    if (!last) return undefined;
    const state = this.offered(last.target).find((offered) => offered.id === last.id)?.state;
    return state ? this.t().result(last.label, state) : last.label;
  });

  /** what the hint shows while a scope is armed */
  readonly hint = computed<ShortcutHint | null>(() => {
    const armed = this.armed();
    if (!armed) return null;
    const target = armed.targets[armed.index];
    const several = armed.targets.length > 1;
    return {
      title: this.titleOf(target),
      key: armed.key,
      position: several ? { index: armed.index + 1, count: armed.targets.length } : undefined,
      shortcuts: this.offered(target).map(toRow),
      said: this.lastRun()?.target === target ? this.said() : undefined,
    };
  });

  private readonly box = signal<ShortcutBox | null>(null);
  /**
   * Where the armed target is in the window, for the ring the hint draws around it. Drawn there,
   * above everything, rather than as an outline on the target: an outline is painted over by the
   * target's own panes and cut off by whatever clips it.
   */
  readonly targetBox = this.box.asReadonly();

  private readonly run = new KeyRun();
  private runs = 0;
  private clock = 0;
  private boxFrame = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private hintRef?: OverlayRef;
  private marked?: HTMLElement;
  private panelOpen = false;
  private readonly warned = new Set<string>();

  constructor() {
    if (!this.available) return;

    // capture: an armed scope's keys are taken before anything on the page sees them
    const onKeydown = (event: KeyboardEvent): void => this.onKeydown(event);
    const onUse = (event: Event): void => this.onUse(event);
    this.document.addEventListener('keydown', onKeydown, true);
    this.document.addEventListener('pointerdown', onUse, true);
    this.document.addEventListener('focusin', onUse, true);

    // the page an armed scope was on is going
    const navigation = inject(Router, { optional: true })?.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.close();
    });

    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('keydown', onKeydown, true);
      this.document.removeEventListener('pointerdown', onUse, true);
      this.document.removeEventListener('focusin', onUse, true);
      navigation?.unsubscribe();
      this.close();
    });

    // what a shortcut did is said once it shows — and again if it then turns out otherwise. The
    // announcer speaks only the last of what it is handed in quick succession.
    let spoken: { count: number; said: string } | undefined;
    effect(() => {
      const last = this.lastRun();
      const said = this.said();
      if (!last || !said) {
        spoken = undefined;
        return;
      }
      if (spoken?.count === last.count && spoken.said === said) return;
      spoken = { count: last.count, said };
      untracked(() => this.announce(said));
    });
  }

  /** The person's own switch (Settings): off, no key is a shortcut. */
  setEnabled(on: boolean): void {
    this.switchedOn.set(on);
    if (!on) this.close();
  }

  /** Adds a target; the function it returns takes it away again. See `registerShortcuts`. */
  register(target: ShortcutTarget): () => void {
    const registered: Registered = { ...target, touched: 0 };
    this.registered.update((all) => [...all, registered]);
    this.warnOfSharedKey(registered);

    return () => {
      this.registered.update((all) => all.filter((one) => one !== registered));
      if (this.lastRun()?.target === registered) this.lastRun.set(null);
      this.drop(registered);
    };
  }

  /** Lets go of the armed scope, if one is: the hint and the ring go. */
  close(): void {
    clearTimeout(this.idleTimer);
    this.run.reset();
    if (!this.armed()) return;
    this.armed.set(null);
    this.lastRun.set(null);
    this.mark(undefined);
    this.hintRef?.dispose();
    this.hintRef = undefined;
  }

  /**
   * Opens the panel: every shortcut of what can be reached now, each of them a button — the way
   * to them without a keyboard, and the place to look one up.
   */
  async openPanel(): Promise<void> {
    if (!this.enabled() || this.panelOpen) return;
    this.close();
    // taken before the dialog opens: once it has, only what is inside it can be reached
    const targets = this.reachable();
    this.panelOpen = true;
    try {
      const { ShortcutsPanelComponent } =
        await import('./shortcuts-panel/shortcuts-panel.component');
      const ref = this.view.open(ShortcutsPanelComponent, {
        title: () => this.t().title,
        icon: 'keyboard',
        width: '34rem',
        inputs: { targets },
      });
      ref.afterClosed().subscribe(() => (this.panelOpen = false));
    } catch (error) {
      this.panelOpen = false;
      throw error;
    }
  }

  /** A target as the hint and the panel show it: its title, its key, its shortcuts as they stand. */
  describe(target: ShortcutTarget): { title: string; key: string; shortcuts: ShortcutRow[] } {
    const registered = target as Registered;
    return {
      title: this.titleOf(registered),
      key: this.scopeKey(registered.scope) ?? '',
      shortcuts: this.offered(registered).map(toRow),
    };
  }

  /**
   * Runs one of a target's shortcuts by its row's id, as its key would, and says what it did.
   * Answers whether the shortcut opens something of its own (`dismiss`) — the panel closes then.
   */
  runRow(target: ShortcutTarget, id: string): boolean {
    const registered = target as Registered;
    const row = this.offered(registered).find((offered) => offered.id === id);
    if (!row) return false;
    this.perform(registered, row);
    return row.dismiss;
  }

  // ── keys ──

  private onKeydown(event: KeyboardEvent): void {
    if (!this.enabled()) return;
    // a browser's or the system's own shortcut, or text on its way in
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (isModifierKey(event.key)) return;
    if (isTypingTarget(event.target)) {
      this.run.reset();
      return;
    }

    const key = normalizeKey(event.key);
    const armed = this.armed();
    if (armed) {
      this.onArmedKey(event, key, armed);
      return;
    }

    // a key held down is one press, however long
    if (event.repeat) return;
    if (key.length !== 1) {
      this.run.reset();
      return;
    }
    if (this.run.press(key, Date.now(), this.config.window) < this.presses) return;

    this.run.reset();
    if (key === HELP_KEY) void this.openPanel();
    else this.arm(key);
  }

  private onArmedKey(event: KeyboardEvent, key: string, armed: Armed): void {
    const target = armed.targets[armed.index];
    const row = this.offered(target).find((offered) => offered.key === key);
    const ours = key === 'Escape' || key === armed.key || key === HELP_KEY || !!row;
    // Tab, the arrows and every key that is not this scope's do what they always do
    if (!ours) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;

    if (key === 'Escape') {
      this.close();
      this.announce(this.t().hint.closed);
    } else if (key === HELP_KEY) {
      void this.openPanel();
    } else if (key === armed.key) {
      this.next(armed);
    } else if (row) {
      this.perform(target, row);
      if (row.dismiss) this.close();
      else this.restartIdle();
    }
  }

  /** a click or a focus: the targets it landed in are the ones in use */
  private onUse(event: Event): void {
    const element = event.target;
    if (!(element instanceof Node)) return;
    const now = ++this.clock;
    for (const target of this.registered()) {
      if (target.host?.contains(element)) target.touched = now;
    }
  }

  // ── arming ──

  private arm(key: string): void {
    const targets = this.targetsFor(key);
    if (!targets.length) return;

    this.armed.set({ key, targets, index: 0 });
    this.lastRun.set(null);
    this.mark(targets[0].host);
    this.restartIdle();
    void this.showHint();
    this.announce(this.t().hint.armed(this.titleOf(targets[0])));
  }

  /** the scope's key again: the next of its kind on the page */
  private next(armed: Armed): void {
    this.restartIdle();
    if (armed.targets.length < 2) return;
    const index = (armed.index + 1) % armed.targets.length;
    const target = armed.targets[index];

    this.armed.set({ ...armed, index });
    this.mark(target.host);
    const text = this.t();
    const position = text.hint.position(index + 1, armed.targets.length);
    this.announce(`${text.hint.armed(this.titleOf(target))} ${position}`);
  }

  /** a target is gone: the next one takes its place, or the hint goes with it */
  private drop(target: Registered): void {
    const armed = this.armed();
    if (!armed || !armed.targets.includes(target)) return;
    const targets = armed.targets.filter((one) => one !== target);
    if (!targets.length) {
      this.close();
      return;
    }
    const index = Math.min(armed.index, targets.length - 1);
    this.armed.set({ ...armed, targets, index });
    this.mark(targets[index].host);
  }

  private restartIdle(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.close();
      this.announce(this.t().hint.closed);
    }, this.config.idle);
  }

  /** names the armed target (`data-shortcut-target`), and keeps `targetBox` on where it is */
  private mark(host: HTMLElement | undefined): void {
    this.marked?.removeAttribute(TARGET_ATTRIBUTE);
    this.marked = host;
    host?.setAttribute(TARGET_ATTRIBUTE, '');

    const view = this.document.defaultView;
    view?.cancelAnimationFrame(this.boxFrame);
    if (!host || !view) {
      this.box.set(null);
      return;
    }
    // followed frame by frame while the scope is armed — a few seconds: the target may scroll,
    // resize, or change shape as its own shortcuts run
    const follow = (): void => {
      const { left, top, width, height } = host.getBoundingClientRect();
      const box = this.box();
      const moved =
        !box ||
        box.left !== left ||
        box.top !== top ||
        box.width !== width ||
        box.height !== height;
      if (moved) this.box.set({ left, top, width, height });
      this.boxFrame = view.requestAnimationFrame(follow);
    };
    follow();
  }

  /** the hint, bottom-end, above whatever is open. It takes no focus: the keys come to the page */
  private async showHint(): Promise<void> {
    if (this.hintRef) return;
    const { ShortcutHintComponent } = await import('./shortcut-hint.component');
    // closed again while the component loaded
    if (!this.armed() || this.hintRef) return;

    this.hintRef = createOverlayRef(this.injector, {
      positionStrategy: createGlobalPositionStrategy(this.injector).bottom('16px').end('16px'),
    });
    this.hintRef.attach(new ComponentPortal(ShortcutHintComponent, null, this.injector));
  }

  // ── targets ──

  /** the targets `key` arms: those of the first scope with that key that has any within reach */
  private targetsFor(key: string): Registered[] {
    const scopes = new Set<string>();
    for (const target of this.registered()) {
      if (this.scopeKey(target.scope) !== key || scopes.has(target.scope.id)) continue;
      scopes.add(target.scope.id);
      const targets = this.reachable(target.scope.id);
      if (targets.length) return targets;
    }
    return [];
  }

  /**
   * What can be reached now, the likeliest of each scope first: on the page (not in a hidden
   * tab), inside the open dialog when there is one, switched on, and with something to offer.
   */
  private reachable(scopeId?: string): Registered[] {
    const modal = openModal(this.document);
    const within = this.registered().filter((target) => {
      if (scopeId !== undefined && target.scope.id !== scopeId) return false;
      if (this.scopeKey(target.scope) === undefined || target.enabled?.() === false) return false;
      const host = target.host;
      if (host && (!isOnScreen(host) || (modal && !modal.contains(host)))) return false;
      return this.offered(target).length > 0;
    });

    const scopes = [...new Set(within.map((target) => target.scope.id))];
    return scopes.flatMap((id) => {
      const ofScope = within.filter((target) => target.scope.id === id);
      const placed = ofScope.filter((target): target is Placed => !!target.host);
      const anywhere = ofScope.filter((target) => !target.host);
      return [...orderHosts(placed, this.document.activeElement), ...anywhere];
    });
  }

  /** a target's shortcuts as they are offered now, each key once: its own, then its buttons' */
  private offered(target: Registered): Offered[] {
    const taken = new Set<string | undefined>([this.scopeKey(target.scope), HELP_KEY]);
    const offered: Offered[] = [];

    for (const shortcut of target.shortcuts()) {
      const key = this.shortcutKey(target.scope, shortcut);
      if (key === undefined || shortcut.available?.() === false) continue;
      if (taken.has(key)) {
        this.warn(`"${target.scope.id}.${shortcut.id}" is left out: its key "${key}" is taken.`);
        continue;
      }
      taken.add(key);
      offered.push({
        id: shortcut.id,
        key,
        label: shortcut.label(),
        state: this.stateOf(shortcut),
        run: shortcut.run,
        dismiss: shortcut.dismiss === true,
      });
    }

    if (target.host) offered.push(...this.buttonsIn(target.host, taken));
    return offered;
  }

  /**
   * The action buttons inside a target that have a key of their own (`ActionButton.shortcut`):
   * each joins the shortcuts of the nearest target it sits in. Its key clicks the button itself,
   * so its confirmation, its menu or its file picker open as they do for a click.
   */
  private buttonsIn(host: HTMLElement, taken: Set<string | undefined>): Offered[] {
    const hosts = this.registered().flatMap((target) => (target.host ? [target.host] : []));
    const offered: Offered[] = [];

    for (const marked of host.querySelectorAll<HTMLElement>(`[${BUTTON_ATTRIBUTE}]`)) {
      const key = normalizeKey(marked.getAttribute(BUTTON_ATTRIBUTE) ?? '');
      if (key.length !== 1 || taken.has(key)) continue;
      // the attribute sits on the button's wrapper: the button itself is what a click is for
      const button = marked.matches('button, a')
        ? marked
        : (marked.querySelector<HTMLElement>('button, a') ?? marked);
      if (button.matches(':disabled, [aria-disabled="true"]') || !isOnScreen(button)) continue;
      if (nearestHost(marked, hosts) !== host) continue;

      taken.add(key);
      offered.push({
        id: `button:${key}`,
        key,
        label: marked.getAttribute(BUTTON_LABEL_ATTRIBUTE) || this.t().button,
        run: () => button.click(),
        dismiss: true,
      });
    }
    return offered;
  }

  /** runs a shortcut, and notes it as the last one run: `said` then tells what it did */
  private perform(target: Registered, row: Offered): void {
    row.run();
    // one that opens something has nothing more to tell than its name: what opened speaks next
    if (row.dismiss) this.announce(row.label);
    else this.lastRun.set({ target, id: row.id, label: row.label, count: ++this.runs });
  }

  private stateOf(shortcut: Shortcut): string | undefined {
    if (shortcut.on) return shortcut.on() ? this.t().on : this.t().off;
    return shortcut.state?.();
  }

  private titleOf(target: Registered): string {
    const name = target.name?.();
    return name ? this.t().named(target.label(), name) : target.label();
  }

  // ── keys, as the app has them ──

  private scopeKey(scope: ShortcutScope): string | undefined {
    const key = this.config.keys[scope.id];
    return key === false ? undefined : normalizeKey(key ?? scope.key);
  }

  private shortcutKey(scope: ShortcutScope, shortcut: Shortcut): string | undefined {
    const key = this.config.keys[`${scope.id}.${shortcut.id}`];
    return key === false ? undefined : normalizeKey(key ?? shortcut.key);
  }

  private announce(message: string): void {
    void this.announcer.announce(message, 'polite');
  }

  /** two scopes on one key: only the first with something on the page would ever answer */
  private warnOfSharedKey(added: Registered): void {
    const key = this.scopeKey(added.scope);
    const other = this.registered().find(
      (target) => target.scope.id !== added.scope.id && this.scopeKey(target.scope) === key,
    );
    if (key !== undefined && other) {
      this.warn(`"${added.scope.id}" and "${other.scope.id}" share the key "${key}".`);
    }
  }

  /** once each: the same finding comes up every time the shortcuts are read */
  private warn(message: string): void {
    if (!isDevMode() || this.warned.has(message)) return;
    this.warned.add(message);
    console.warn(`[shortcuts] ${message}`);
  }
}

/** a registered target that has an element */
type Placed = Registered & { host: HTMLElement };

function toRow({ id, key, label, state }: Offered): ShortcutRow {
  return { id, key, label, state };
}

/** What `registerShortcuts` takes besides the scope and its shortcuts. */
export interface RegisterShortcutsOptions {
  /** the scope's name in the user's language: "Data grid" */
  label: () => string;
  /** what tells this one from another of its kind on the same page */
  name?: () => string | undefined;
  /** false takes this one out: `params.shortcuts: false` */
  enabled?: () => boolean;
  /** the target's element — the component's own by default; `null` for a target that has none
   *  and is always there (the app's own scope) */
  host?: HTMLElement | null;
}

/**
 * Registers a component's shortcuts for as long as it lives. Call it in the constructor (an
 * injection context):
 *
 *     registerShortcuts(GRID_SCOPE, () => gridShortcuts(this), { label: () => this.t().shortcuts.scope });
 *
 * `shortcuts` is read each time they are shown or one is pressed — never before the component
 * has its inputs — so it can read the component's signals freely.
 */
export function registerShortcuts(
  scope: ShortcutScope,
  shortcuts: () => Shortcut[],
  options: RegisterShortcutsOptions,
): void {
  const service = inject(ShortcutsService);
  if (!service.available) return;

  const host =
    options.host === null
      ? undefined
      : (options.host ??
        inject<ElementRef<HTMLElement>>(ElementRef, { optional: true })?.nativeElement);
  const unregister = service.register({
    scope,
    shortcuts,
    host,
    label: options.label,
    name: options.name,
    enabled: options.enabled,
  });
  inject(DestroyRef).onDestroy(unregister);
}
