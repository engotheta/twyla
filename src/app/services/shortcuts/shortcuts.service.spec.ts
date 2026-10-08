import { LiveAnnouncer } from '@angular/cdk/a11y';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { ViewService } from '@services/view/view.service';
import { provideShortcuts } from './shortcuts-config.token';
import { toggleShortcut } from './shortcuts.helpers';
import { Shortcut, ShortcutScope, ShortcutsConfig, ShortcutTarget } from './shortcuts.interface';
import { ShortcutsService } from './shortcuts.service';

const GRID: ShortcutScope = { id: 'data-grid', key: 'g' };
const DETAILS: ShortcutScope = { id: 'details', key: 'd' };

describe('ShortcutsService', () => {
  let service: ShortcutsService;
  let announce: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  function setUp(config?: Partial<ShortcutsConfig>): void {
    announce = vi.fn().mockResolvedValue(undefined);
    open = vi.fn(() => ({ afterClosed: () => EMPTY }));
    TestBed.configureTestingModule({
      providers: [
        ...(config ? [provideShortcuts(config)] : []),
        { provide: LiveAnnouncer, useValue: { announce } },
        { provide: ViewService, useValue: { open } },
      ],
    });
    service = TestBed.inject(ShortcutsService);
  }

  /** an element on the page, for a target to live in */
  function host(html = ''): HTMLElement {
    const element = document.createElement('section');
    element.innerHTML = html;
    document.body.appendChild(element);
    return element;
  }

  /** a grid-like target: a paginator switch and a reload, with the state they act on */
  function grid(over: Partial<ShortcutTarget> = {}): {
    host: HTMLElement;
    paginator: WritableSignal<boolean>;
    reload: ReturnType<typeof vi.fn>;
    unregister: () => void;
  } {
    const element = over.host ?? host();
    const paginator = signal(true);
    const reload = vi.fn();
    const shortcuts = (): Shortcut[] => [
      toggleShortcut(
        'paginator',
        'p',
        () => 'Paginator',
        paginator,
        (on) => paginator.set(on),
      ),
      { id: 'reload', key: 'r', label: () => 'Reload', run: reload },
    ];
    const unregister = service.register({
      scope: GRID,
      label: () => 'Data grid',
      host: element,
      shortcuts,
      ...over,
    });
    return { host: element, paginator, reload, unregister };
  }

  function press(key: string, init: KeyboardEventInit = {}, on: EventTarget = document.body) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    on.dispatchEvent(event);
    return event;
  }

  /** `times` quick presses of one key */
  function mash(key: string, times = 6, gap = 50): void {
    for (let i = 0; i < times; i++) {
      press(key);
      vi.advanceTimersByTime(gap);
    }
  }

  const rows = () => service.hint()?.shortcuts.map((row) => `${row.key} ${row.label}`);
  const said = () => announce.mock.calls.map(([message]) => message as string);

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    service?.close();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  describe('arming a scope', () => {
    beforeEach(() => setUp());

    it('takes six quick presses of its key, and then shows what its keys do', () => {
      grid();
      mash('g', 5);
      expect(service.hint()).toBeNull();

      press('g');
      expect(service.hint()).toMatchObject({ title: 'Data grid', key: 'g' });
      expect(rows()).toEqual(['p Paginator', 'r Reload']);
      expect(service.hint()!.shortcuts[0].state).toBe('on');
      expect(said()).toEqual(['Data grid shortcuts. Press a key, or Escape to close.']);
    });

    it('does not count presses that come slowly, or with another key between them', () => {
      grid();
      mash('g', 6, 600);
      expect(service.hint()).toBeNull();

      mash('g', 3);
      press('x');
      mash('g', 3);
      expect(service.hint()).toBeNull();
    });

    it('counts a key held down as one press', () => {
      grid();
      press('g');
      for (let i = 0; i < 20; i++) press('g', { repeat: true });
      expect(service.hint()).toBeNull();
    });

    it('leaves keys pressed with Ctrl, Alt or Meta to the browser', () => {
      grid();
      for (let i = 0; i < 6; i++) press('g', { ctrlKey: true });
      for (let i = 0; i < 6; i++) press('g', { altKey: true });
      for (let i = 0; i < 6; i++) press('g', { metaKey: true });
      expect(service.hint()).toBeNull();
    });

    it('is not put off by Caps Lock, or by Shift going down in the middle of a run', () => {
      grid();
      mash('G', 3);
      press('Shift');
      mash('G', 3);
      expect(service.hint()).not.toBeNull();
    });

    it('never counts a key typed in a field, or in a widget with type-ahead', () => {
      grid();
      const holder = host('<input /><div role="listbox" tabindex="0"></div>');
      const input = holder.querySelector('input')!;
      const listbox = holder.querySelector('[role="listbox"]')!;

      for (let i = 0; i < 8; i++) press('g', {}, input);
      for (let i = 0; i < 8; i++) press('g', {}, listbox);

      expect(service.hint()).toBeNull();
    });

    it('does nothing for a key no scope on the page has', () => {
      grid();
      mash('z');
      expect(service.hint()).toBeNull();
    });

    it('lets the keys through while it only counts', () => {
      grid();
      const seen = vi.fn();
      document.body.addEventListener('keydown', seen);
      const events = [press('g'), press('g')];
      document.body.removeEventListener('keydown', seen);

      expect(seen).toHaveBeenCalledTimes(2);
      expect(events.some((event) => event.defaultPrevented)).toBe(false);
    });
  });

  describe('an armed scope', () => {
    beforeEach(() => setUp());

    it('runs a shortcut on its key, keeps the hint, and says what it did', () => {
      const target = grid();
      mash('g');

      const event = press('p');
      TestBed.tick();

      expect(target.paginator()).toBe(false);
      expect(event.defaultPrevented).toBe(true);
      expect(service.hint()!.shortcuts[0].state).toBe('off');
      expect(service.hint()!.said).toBe('Paginator: off');
      expect(said().at(-1)).toBe('Paginator: off');
    });

    it('runs several in a row, a key each', () => {
      const target = grid();
      mash('g');

      press('p');
      press('r');
      press('p');
      TestBed.tick();

      expect(target.paginator()).toBe(true);
      expect(target.reload).toHaveBeenCalledTimes(1);
      expect(service.hint()!.said).toBe('Paginator: on');
    });

    it('says a shortcut with no state by its name, each time it runs', () => {
      grid();
      mash('g');

      press('r');
      TestBed.tick();
      press('r');
      TestBed.tick();

      expect(said().filter((message) => message === 'Reload')).toHaveLength(2);
    });

    it('says what a shortcut did as it turns out, when that lands a moment later', () => {
      const theme = signal(false);
      service.register({
        scope: DETAILS,
        label: () => 'App',
        // like the theme: the change commits a frame later, inside a view transition
        shortcuts: () => [
          toggleShortcut(
            'dark',
            'k',
            () => 'Dark theme',
            theme,
            (on) => setTimeout(() => theme.set(on), 16),
          ),
        ],
      });
      mash('d');

      press('k');
      TestBed.tick();
      expect(service.hint()!.said).toBe('Dark theme: off');

      vi.advanceTimersByTime(16);
      TestBed.tick();
      expect(service.hint()!.said).toBe('Dark theme: on');
      expect(said().at(-1)).toBe('Dark theme: on');
    });

    it('keeps its keys from everything else on the page', () => {
      grid();
      mash('g');
      const seen = vi.fn();
      document.body.addEventListener('keydown', seen);

      press('p');
      press('Escape');
      document.body.removeEventListener('keydown', seen);

      expect(seen).not.toHaveBeenCalled();
    });

    it('leaves every other key alone: Tab, the arrows, a letter that is not its own', () => {
      grid();
      mash('g');
      const events = [press('Tab'), press('ArrowDown'), press('q')];

      expect(events.some((event) => event.defaultPrevented)).toBe(false);
      expect(service.hint()).not.toBeNull();
    });

    it('does not take a key typed in a field for one of its own', () => {
      const target = grid();
      const input = host('<input />').querySelector('input')!;
      mash('g');

      const event = press('p', {}, input);

      expect(target.paginator()).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    });

    it('closes on Esc', () => {
      const target = grid();
      mash('g');
      expect(target.host.hasAttribute('data-shortcut-target')).toBe(true);

      const event = press('Escape');

      expect(service.hint()).toBeNull();
      expect(event.defaultPrevented).toBe(true);
      expect(target.host.hasAttribute('data-shortcut-target')).toBe(false);
      expect(said().at(-1)).toBe('Shortcuts closed');
    });

    it('closes by itself after a pause, which each key pressed puts off', () => {
      grid();
      mash('g');

      vi.advanceTimersByTime(7000);
      press('r');
      vi.advanceTimersByTime(7000);
      expect(service.hint()).not.toBeNull();

      vi.advanceTimersByTime(1001);
      expect(service.hint()).toBeNull();
    });

    it('closes as it runs a shortcut that opens something of its own', () => {
      const openSettings = vi.fn();
      service.register({
        scope: DETAILS,
        label: () => 'App',
        shortcuts: () => [
          {
            id: 'settings',
            key: 's',
            label: () => 'Open settings',
            run: openSettings,
            dismiss: true,
          },
        ],
      });
      mash('d');

      press('s');

      expect(openSettings).toHaveBeenCalled();
      expect(service.hint()).toBeNull();
      expect(said().at(-1)).toBe('Open settings');
    });

    it('leaves out a shortcut that has nothing to act on', () => {
      const available = signal(false);
      service.register({
        scope: DETAILS,
        label: () => 'Details',
        shortcuts: () => [
          { id: 'tabs', key: 't', label: () => 'Tabs', run: vi.fn(), available },
          { id: 'list', key: '1', label: () => 'List', run: vi.fn() },
        ],
      });
      mash('d');
      expect(rows()).toEqual(['1 List']);

      available.set(true);
      expect(rows()).toEqual(['t Tabs', '1 List']);
    });
  });

  describe('which one, of several', () => {
    beforeEach(() => setUp());

    it('starts with the first on the page, and moves on with the scope’s key', () => {
      const first = grid({ name: () => 'Employees' });
      const second = grid({ name: () => 'Invoices' });
      mash('g');

      expect(service.hint()).toMatchObject({
        title: 'Data grid: Employees',
        position: { index: 1, count: 2 },
      });
      expect(first.host.hasAttribute('data-shortcut-target')).toBe(true);

      press('g');
      expect(service.hint()!.title).toBe('Data grid: Invoices');
      expect(first.host.hasAttribute('data-shortcut-target')).toBe(false);
      expect(second.host.hasAttribute('data-shortcut-target')).toBe(true);

      press('p');
      expect(second.paginator()).toBe(false);
      expect(first.paginator()).toBe(true);

      press('g');
      expect(service.hint()!.title).toBe('Data grid: Employees');
    });

    it('starts with the one holding focus', () => {
      grid({ name: () => 'Employees' });
      const second = grid({ name: () => 'Invoices', host: host('<button></button>') });
      second.host.querySelector('button')!.focus();

      mash('g');
      expect(service.hint()!.title).toBe('Data grid: Invoices');
    });

    it('…or else the one last clicked', () => {
      grid({ name: () => 'Employees' });
      const second = grid({ name: () => 'Invoices' });
      second.host.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      mash('g');
      expect(service.hint()!.title).toBe('Data grid: Invoices');
    });

    it('passes over one that is switched off, or not on the page', () => {
      grid({ name: () => 'Off', enabled: () => false });
      const gone = grid({ name: () => 'Gone' });
      gone.host.remove();
      grid({ name: () => 'Here' });

      mash('g');
      expect(service.hint()).toMatchObject({ title: 'Data grid: Here', position: undefined });
    });

    it('reaches only what is inside the dialog that is open', () => {
      grid({ name: () => 'Behind' });
      const dialog = host();
      dialog.className = 'cdk-dialog-container';
      const inside = document.createElement('div');
      dialog.appendChild(inside);
      grid({ name: () => 'Inside', host: inside });

      mash('g');
      expect(service.hint()).toMatchObject({ title: 'Data grid: Inside', position: undefined });
    });

    it('moves to the next when the one it is on goes, and closes with the last', () => {
      const first = grid({ name: () => 'Employees' });
      const second = grid({ name: () => 'Invoices' });
      mash('g');

      first.unregister();
      expect(service.hint()).toMatchObject({ title: 'Data grid: Invoices', position: undefined });

      second.unregister();
      expect(service.hint()).toBeNull();
    });
  });

  describe('action buttons with a key of their own', () => {
    beforeEach(() => setUp());

    it('join the shortcuts of the component they sit in, and are clicked by their key', () => {
      const target = grid({
        host: host(`
          <div data-shortcut="N" data-shortcut-label="New employee"><button id="new"></button></div>
          <div data-shortcut="x" data-shortcut-label="Delete"><button disabled></button></div>
          <div data-shortcut="p" data-shortcut-label="Print"><button></button></div>
        `),
      });
      const clicked = vi.fn();
      target.host.querySelector('#new')!.addEventListener('click', clicked);
      mash('g');

      // the disabled one is left out; the one whose key the grid already uses gives way
      expect(rows()).toEqual(['p Paginator', 'r Reload', 'n New employee']);

      press('n');
      expect(clicked).toHaveBeenCalledTimes(1);
      expect(service.hint()).toBeNull();
    });

    it('belong to the nearest component only', () => {
      const outer = host('<div id="inner"><div data-shortcut="e"><button></button></div></div>');
      service.register({
        scope: DETAILS,
        label: () => 'Details',
        host: outer,
        shortcuts: () => [{ id: 'list', key: '1', label: () => 'List', run: vi.fn() }],
      });
      grid({ host: outer.querySelector<HTMLElement>('#inner')! });

      mash('d');
      expect(rows()).toEqual(['1 List']);
      press('Escape');

      mash('g');
      expect(rows()).toEqual(['p Paginator', 'r Reload', 'e Button']);
    });
  });

  describe('switched off', () => {
    it('by the person: nothing arms, and what was armed lets go', () => {
      setUp();
      grid();
      mash('g');

      service.setEnabled(false);
      expect(service.hint()).toBeNull();
      expect(service.enabled()).toBe(false);

      mash('g');
      expect(service.hint()).toBeNull();

      service.setEnabled(true);
      mash('g');
      expect(service.hint()).not.toBeNull();
    });

    it('by the app: nothing listens at all', () => {
      setUp({ enabled: false });
      grid();
      mash('g');

      expect(service.available).toBe(false);
      expect(service.enabled()).toBe(false);
      expect(service.hint()).toBeNull();
    });
  });

  describe('as the app configures it', () => {
    it('takes another number of presses', () => {
      setUp({ presses: 3 });
      grid();
      mash('g', 3);
      expect(service.hint()).not.toBeNull();
      expect(service.presses).toBe(3);
    });

    it('re-keys a scope or a shortcut, and removes either', () => {
      setUp({
        keys: { 'data-grid': 'q', 'data-grid.paginator': 'n', 'data-grid.reload': false },
      });
      grid();

      mash('g');
      expect(service.hint()).toBeNull();

      mash('q');
      expect(service.hint()).toMatchObject({ key: 'q' });
      expect(rows()).toEqual(['n Paginator']);
    });

    it('leaves a removed scope unreachable', () => {
      setUp({ keys: { 'data-grid': false } });
      grid();
      mash('g');
      expect(service.hint()).toBeNull();
    });

    it('lets go sooner, or later', () => {
      setUp({ idle: 1000 });
      grid();
      mash('g');
      vi.advanceTimersByTime(1001);
      expect(service.hint()).toBeNull();
    });
  });

  describe('the panel', () => {
    beforeEach(() => setUp());

    it('opens on ? from a hint, with what could be reached then', async () => {
      grid();
      mash('g');

      const event = press('?', { shiftKey: true });
      await vi.dynamicImportSettled();

      expect(event.defaultPrevented).toBe(true);
      expect(service.hint()).toBeNull();
      expect(open).toHaveBeenCalledTimes(1);
      const config = open.mock.calls[0][1] as { inputs: { targets: ShortcutTarget[] } };
      expect(config.inputs.targets).toHaveLength(1);
      expect(service.describe(config.inputs.targets[0])).toMatchObject({
        title: 'Data grid',
        key: 'g',
      });
    });

    it('opens on ? pressed as a scope’s key is, from anywhere', async () => {
      grid();
      mash('?');
      await vi.dynamicImportSettled();
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('does not open twice, nor while shortcuts are off', async () => {
      void service.openPanel();
      void service.openPanel();
      await vi.dynamicImportSettled();
      expect(open).toHaveBeenCalledTimes(1);
    });

    it('does not open while shortcuts are switched off', async () => {
      service.setEnabled(false);
      await service.openPanel();
      expect(open).not.toHaveBeenCalled();
    });

    it('runs a row as its key would, and says what it did', async () => {
      const target = grid();
      await service.openPanel();
      // the panel is handed the targets; it runs one by its row's id
      const config = open.mock.calls[0][1] as { inputs: { targets: ShortcutTarget[] } };
      const [handed] = config.inputs.targets;

      expect(service.runRow(handed, 'paginator')).toBe(false);
      TestBed.tick();

      expect(target.paginator()).toBe(false);
      expect(said().at(-1)).toBe('Paginator: off');
      expect(service.runRow(handed, 'no-such-row')).toBe(false);
    });
  });
});
