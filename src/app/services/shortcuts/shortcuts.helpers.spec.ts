import {
  actionShortcut,
  cycleShortcut,
  isModifierKey,
  isOnScreen,
  isTypingTarget,
  keyCap,
  KeyRun,
  nearestHost,
  normalizeKey,
  openModal,
  orderHosts,
  toggleShortcut,
} from './shortcuts.helpers';

function element(html: string): HTMLElement {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.body.appendChild(holder);
  return holder;
}

describe('shortcuts helpers', () => {
  afterEach(() => document.body.replaceChildren());

  describe('KeyRun', () => {
    it('counts presses of one key that follow each other quickly', () => {
      const run = new KeyRun();
      expect(run.press('g', 0, 500)).toBe(1);
      expect(run.press('g', 400, 500)).toBe(2);
      expect(run.press('g', 900, 500)).toBe(3);
    });

    it('starts over after a pause, another key, or a reset', () => {
      const run = new KeyRun();
      run.press('g', 0, 500);
      expect(run.press('g', 501, 500)).toBe(1);

      run.press('g', 600, 500);
      expect(run.press('d', 700, 500)).toBe(1);
      expect(run.press('g', 800, 500)).toBe(1);

      run.press('g', 900, 500);
      run.reset();
      expect(run.press('g', 1000, 500)).toBe(1);
    });
  });

  describe('isTypingTarget', () => {
    it('knows fields, and widgets that take letters for type-ahead', () => {
      const holder = element(`
        <input id="input" />
        <textarea id="textarea"></textarea>
        <div id="editable" contenteditable="true"><b id="inside">x</b></div>
        <div id="select" role="combobox"></div>
        <div role="menu"><button id="item"></button></div>
        <div data-shortcuts="off"><button id="opted-out"></button></div>
      `);
      for (const id of ['input', 'textarea', 'inside', 'select', 'item', 'opted-out']) {
        expect(isTypingTarget(holder.querySelector(`#${id}`)), id).toBe(true);
      }
    });

    it('leaves everything else to shortcuts', () => {
      const holder = element(`
        <button id="button"></button>
        <div id="plain" contenteditable="false"></div>
        <div role="tablist"><button id="tab" role="tab"></button></div>
      `);
      for (const id of ['button', 'plain', 'tab']) {
        expect(isTypingTarget(holder.querySelector(`#${id}`)), id).toBe(false);
      }
      expect(isTypingTarget(null)).toBe(false);
      expect(isTypingTarget(document)).toBe(false);
    });
  });

  it('names keys the same whatever Caps Lock says, and shows letters as key caps', () => {
    expect(normalizeKey('G')).toBe('g');
    expect(normalizeKey('?')).toBe('?');
    expect(normalizeKey('Escape')).toBe('Escape');
    expect(keyCap('g')).toBe('G');
    expect(keyCap('Escape')).toBe('Escape');
    expect(isModifierKey('Shift')).toBe(true);
    expect(isModifierKey('s')).toBe(false);
  });

  it('takes an element for on screen while it is in the document', () => {
    const holder = element('<div id="here"></div>');
    const here = holder.querySelector<HTMLElement>('#here')!;
    expect(isOnScreen(here)).toBe(true);

    holder.remove();
    expect(isOnScreen(here)).toBe(false);
  });

  it('asks the browser, where it can say, whether an element is rendered', () => {
    const holder = element('<div id="hidden"><span></span></div><div id="contents"><p></p></div>');
    const hidden = holder.querySelector<HTMLElement>('#hidden')!;
    const contents = holder.querySelector<HTMLElement>('#contents')!;
    hidden.checkVisibility = () => false;
    (hidden.firstElementChild as HTMLElement).checkVisibility = () => false;
    // `display: contents` has no box of its own, but what it holds is shown
    contents.checkVisibility = () => false;
    (contents.firstElementChild as HTMLElement).checkVisibility = () => true;

    expect(isOnScreen(hidden)).toBe(false);
    expect(isOnScreen(contents)).toBe(true);
  });

  it('finds the dialog that is open: the last one', () => {
    expect(openModal(document)).toBeNull();
    const holder = element(`
      <div class="cdk-dialog-container" id="first"></div>
      <div aria-modal="true" id="second"></div>
    `);
    expect(openModal(document)).toBe(holder.querySelector('#second'));
  });

  describe('orderHosts', () => {
    const hosts = () => {
      const holder = element(`
        <section id="a"><button id="in-a"></button></section>
        <section id="b"><div id="c"><button id="in-c"></button></div></section>
      `);
      const host = (id: string) => holder.querySelector<HTMLElement>(`#${id}`)!;
      return { a: host('a'), b: host('b'), c: host('c'), inA: host('in-a'), inC: host('in-c') };
    };
    const ids = (items: { host: HTMLElement }[]) => items.map((item) => item.host.id);

    it('goes by document order when nothing was used', () => {
      const { a, b, c } = hosts();
      const items = [c, b, a].map((host) => ({ host, touched: 0 }));
      expect(ids(orderHosts(items, null))).toEqual(['a', 'b', 'c']);
    });

    it('puts the one last clicked or focused first', () => {
      const { a, b, c } = hosts();
      const items = [
        { host: a, touched: 1 },
        { host: b, touched: 3 },
        { host: c, touched: 2 },
      ];
      expect(ids(orderHosts(items, null))).toEqual(['b', 'c', 'a']);
    });

    it('puts the one holding focus ahead of all — the innermost, where they nest', () => {
      const { a, b, c, inA, inC } = hosts();
      const items = [
        { host: a, touched: 9 },
        { host: b, touched: 0 },
        { host: c, touched: 0 },
      ];
      expect(ids(orderHosts(items, inC))).toEqual(['c', 'b', 'a']);
      expect(ids(orderHosts(items, inA))).toEqual(['a', 'b', 'c']);
    });
  });

  it('finds the innermost host an element sits in', () => {
    const holder = element('<section id="outer"><div id="inner"><i id="leaf"></i></div></section>');
    const outer = holder.querySelector<HTMLElement>('#outer')!;
    const inner = holder.querySelector<HTMLElement>('#inner')!;
    const leaf = holder.querySelector<HTMLElement>('#leaf')!;

    expect(nearestHost(leaf, [outer, inner])).toBe(inner);
    expect(nearestHost(leaf, [inner, outer])).toBe(inner);
    expect(nearestHost(leaf, [outer])).toBe(outer);
    expect(nearestHost(document.body, [outer, inner])).toBeUndefined();
  });

  describe('building shortcuts', () => {
    it('a toggle flips what it reads', () => {
      let on = false;
      const shortcut = toggleShortcut(
        'paginator',
        'p',
        () => 'Paginator',
        () => on,
        (value) => (on = value),
      );

      shortcut.run();
      expect(on).toBe(true);
      expect(shortcut.on?.()).toBe(true);
      shortcut.run();
      expect(on).toBe(false);
    });

    it('a cycle steps through its values and round again, and is not offered for one value', () => {
      let mode = 'table';
      let modes = ['table', 'list', 'cards'];
      const shortcut = cycleShortcut(
        'view',
        'v',
        () => 'View',
        () => modes,
        () => mode,
        (value) => (mode = value),
        (value) => value.toUpperCase(),
      );

      expect(shortcut.state?.()).toBe('TABLE');
      shortcut.run();
      shortcut.run();
      expect(mode).toBe('cards');
      shortcut.run();
      expect(mode).toBe('table');
      expect(shortcut.available?.()).toBe(true);

      modes = ['table'];
      expect(shortcut.available?.()).toBe(false);
    });

    it('an action carries what it is given', () => {
      const run = vi.fn();
      const shortcut = actionShortcut('reload', 'r', () => 'Reload', run, { dismiss: true });
      shortcut.run();
      expect(run).toHaveBeenCalled();
      expect(shortcut).toMatchObject({ id: 'reload', key: 'r', dismiss: true });
    });
  });
});
