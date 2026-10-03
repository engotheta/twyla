import { OverlayContainer } from '@angular/cdk/overlay';
import { ANIMATION_MODULE_TYPE, Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { FieldType } from '@components/generic-form';
import {
  axisTemplate,
  ContentsViewComponent,
  redistributePx,
  refitFractions,
} from './contents-view.component';
import {
  ContentsLayout,
  ContentsSizes,
  ContentsViewInstance,
  ContentsParameter,
  ContentView,
} from './contents.interface';

describe('redistributePx', () => {
  it('moves the delta between the pair, keeping the sum', () => {
    expect(redistributePx(300, 300, 50, 80)).toEqual([350, 250]);
    expect(redistributePx(300, 300, -50, 80)).toEqual([250, 350]);
  });
  it('clamps both sides to the minimum', () => {
    expect(redistributePx(300, 300, 1000, 80)).toEqual([520, 80]);
    expect(redistributePx(300, 300, -1000, 80)).toEqual([80, 520]);
  });
});

describe('axisTemplate', () => {
  it('imposes nothing with fewer than two tracks, or with nothing collapsed and no fractions', () => {
    expect(axisTemplate(1, [1], [true])).toBeNull();
    expect(axisTemplate(2, [], [])).toBeNull();
    expect(axisTemplate(3, [1, 1], [])).toBeNull(); // stale length
  });
  it('enforces fractions, rescaled to average 1', () => {
    expect(axisTemplate(2, [3, 1], [])).toBe('minmax(0, 1.5fr) minmax(0, 0.5fr)');
    // weights summing below 1 would otherwise leave part of the axis unfilled
    expect(axisTemplate(2, [0.375, 0.125], [])).toBe('minmax(0, 1.5fr) minmax(0, 0.5fr)');
  });
  it('sizes a collapsed track to its strip, the rest by fraction or equally', () => {
    expect(axisTemplate(3, [], [false, true, false])).toBe('minmax(0, 1fr) auto minmax(0, 1fr)');
    expect(axisTemplate(2, [3, 1], [true, false])).toBe('auto minmax(0, 1fr)');
  });
  it("hands a larger collapsed pane's space to the smaller open ones", () => {
    // a 20/80 split with the 80% pane collapsed — `0.4fr` alone would fill only 40% of the axis
    expect(axisTemplate(2, [0.4, 1.6], [false, true])).toBe('minmax(0, 1fr) auto');
    // the open panes keep their split among themselves
    expect(axisTemplate(3, [0.2, 0.6, 2.2], [false, false, true])).toBe(
      'minmax(0, 0.5fr) minmax(0, 1.5fr) auto',
    );
  });
});

describe('refitFractions', () => {
  it('is normalizeFractions(nextPx) with nothing collapsed', () => {
    expect(refitFractions([1, 1], [300, 100], [])).toEqual([1.5, 0.5]);
  });
  it("keeps a collapsed track's fraction and splits the open tracks' total by their px", () => {
    expect(refitFractions([2, 1, 1], [40, 300, 100], [true, false, false])).toEqual([2, 1.5, 0.5]);
  });
});

@Component({
  selector: 'test-widget',
  template: `<span>Widget: {{ label }}</span
    ><button type="button" (click)="clicked.emit(42)">Fire</button>`,
})
class TestWidgetComponent {
  @Input() label = '';
  @Output() clicked = new EventEmitter<number>();
}

/** The test env's jsdom exposes neither `localStorage` nor `matchMedia`. Persistence in
 *  `persisted-selection.helpers` is try/catch-guarded so the component is unaffected, but the
 *  persistence assertions below need a working store — back it with an in-memory Map. */
function stubLocalStorage(): void {
  const store = new Map<string, string>();
  const ls: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = ls;
}

/** jsdom has no `window.matchMedia` — `mediaQuerySignal` then reports a static `false`, which
 *  would make `contentsFit: 'auto'` (the new default) resolve to `'flow'` and break every
 *  existing cover-mode assertion. Stub it so the default is `matches: true` (≥ lg / cover);
 *  individual tests re-stub with `false` and dispatch `change` to exercise the switch. */
function stubMatchMedia(matches: boolean): Set<(e: MediaQueryListEvent) => void> {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  (window as unknown as { matchMedia: unknown }).matchMedia = (media: string) => ({
    media,
    matches,
    onchange: null,
    addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => listeners.delete(l),
    addListener: (l: (e: MediaQueryListEvent) => void) => listeners.add(l),
    removeListener: (l: (e: MediaQueryListEvent) => void) => listeners.delete(l),
    dispatchEvent: (e: Event) => (listeners.forEach((l) => l(e as MediaQueryListEvent)), true),
  });
  return listeners;
}

describe('ContentsViewComponent', () => {
  beforeEach(() => {
    stubMatchMedia(true);
    stubLocalStorage();
    // Material components rendered INSIDE contents (a details' `<mat-tab-group>`, …) settle on
    // real fallback timers (standing in for a CSS transitionend jsdom never fires) unless
    // animations are known to be off — timers `whenStable()` doesn't wait for. Declaring
    // 'NoopAnimations' (the token `provideNoopAnimations()` sets; `@angular/animations` isn't a
    // project dependency) makes them synchronous, which every test below assumes. (The tabs of
    // contents-view itself are its own `tab-nav`, with nothing to wait for.)
    TestBed.configureTestingModule({
      imports: [ContentsViewComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
  });

  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  function mount(params: ContentsParameter) {
    const fixture = TestBed.createComponent(ContentsViewComponent);
    fixture.componentRef.setInput('params', params);
    return fixture;
  }

  it('renders every content type in list mode without throwing', async () => {
    const contents: ContentView[] = [
      {
        type: 'table',
        slug: 't',
        label: 'Table',
        gridParams: { columns: ['id'], gridData: [{ id: 1 }] },
      },
      { type: 'details', slug: 'd', label: 'Details', detailsParams: { entity: { name: 'Ada' } } },
      {
        type: 'form',
        slug: 'f',
        label: 'Form',
        formParams: { fields: [{ type: FieldType.input, key: 'name' }] },
      },
      { type: 'html', slug: 'h', label: 'Html', html: '<b>Bold</b>' },
      {
        type: 'component',
        slug: 'c',
        label: 'Component',
        componentParams: { component: TestWidgetComponent, inputs: { label: 'hi' } },
      },
      {
        type: 'group',
        slug: 'g',
        label: 'Group',
        contents: [
          {
            type: 'table',
            slug: 'nested-t',
            gridParams: { columns: ['id'], gridData: [{ id: 2 }] },
          },
        ],
      },
    ];
    const fixture = mount({ contents });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('data-grid');
    expect(html).toContain('Ada');
    expect(html).toContain('<input');
    expect(html).toContain('Bold');
    expect(html).toContain('Widget: hi');
    // recursion: the group's nested <contents-view> rendered its own nested table
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('contents-view').length).toBe(1);
  });

  it('wires componentParams.outputs to the dynamically-hosted component', async () => {
    const seen: number[] = [];
    const contents: ContentView[] = [
      {
        type: 'component',
        slug: 'c',
        componentParams: {
          component: TestWidgetComponent,
          outputs: { clicked: (event) => seen.push(event as number) },
        },
      },
    ];
    const fixture = mount({ contents });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    button.click();
    expect(seen).toEqual([42]);
  });

  it('defaults to the first content active, or the one marked initialActive, in tabs mode', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b', initialActive: true },
    ];
    const fixture = mount({ contents, showContentsInTabs: true });
    let instance: ContentsViewInstance | undefined;
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(instance?.activeSlug()).toBe('b');

    const contentsNoActive: ContentView[] = [
      { type: 'html', slug: 'x', label: 'X', html: 'x' },
      { type: 'html', slug: 'y', label: 'Y', html: 'y' },
    ];
    const fixture2 = mount({ contents: contentsNoActive, showContentsInTabs: true });
    let instance2: ContentsViewInstance | undefined;
    fixture2.componentInstance.instanceChange.subscribe((i) => (instance2 = i));
    fixture2.detectChanges();
    await fixture2.whenStable();

    expect(instance2?.activeSlug()).toBe('x'); // first content, no explicit initialActive anywhere
  });

  it('instance.selectContent() switches the active tab', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b' },
    ];
    const fixture = mount({ contents, showContentsInTabs: true });
    let instance: ContentsViewInstance | undefined;
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(instance?.activeSlug()).toBe('a');
    instance?.selectContent('b');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(instance?.activeSlug()).toBe('b');
  });

  it('hides a content whose visible resolves to false (static and Observable-driven)', async () => {
    const showB = new BehaviorSubject(false);
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a', visible: false },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b', visible: showB },
      { type: 'html', slug: 'c', label: 'C', html: 'content-c' },
    ];
    const fixture = mount({ contents });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    let text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('content-a');
    expect(text).not.toContain('content-b');
    expect(text).toContain('content-c');

    showB.next(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('content-b');
  });

  it('selectContent() is a no-op for a disabled content', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b', disabled: true },
    ];
    const fixture = mount({ contents, showContentsInTabs: true });
    let instance: ContentsViewInstance | undefined;
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();

    instance?.selectContent('b');
    fixture.detectChanges();

    expect(instance?.activeSlug()).toBe('a'); // unchanged — 'b' is disabled
  });

  it('hasPermission gates a permissions-tagged content; omitted checker treats permissions as informational', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a', permissions: ['admin'] },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b' },
    ];

    const gated = mount({ contents, hasPermission: () => false });
    gated.detectChanges();
    await gated.whenStable();
    gated.detectChanges();
    let text = (gated.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('content-a');
    expect(text).toContain('content-b');

    const ungated = mount({ contents }); // no hasPermission supplied
    ungated.detectChanges();
    await ungated.whenStable();
    ungated.detectChanges();
    text = (ungated.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('content-a'); // informational only, not filtered
  });

  it("header: 'auto' in tabs mode renders the panel header only for actionButtons, not for a badge alone", async () => {
    const badgeOnly: ContentView[] = [{ type: 'html', slug: 'a', html: 'body-a', badge: 'NEW' }];
    const f1 = mount({ contents: badgeOnly, showContentsInTabs: true });
    f1.detectChanges();
    await f1.whenStable();
    f1.detectChanges();
    const panel1 = (f1.nativeElement as HTMLElement).querySelector('[role="tabpanel"]');
    // badge shows on the tab toggle button but not as a panel header (tab button already has it)
    expect(panel1?.querySelector('action-buttons')).toBeNull();
    expect(panel1?.textContent).toContain('body-a');

    const withButtons: ContentView[] = [
      { type: 'html', slug: 'a', html: 'body-a', badge: 'NEW', actionButtons: [{ label: 'Go' }] },
    ];
    const f2 = mount({ contents: withButtons, showContentsInTabs: true });
    f2.detectChanges();
    await f2.whenStable();
    f2.detectChanges();
    const panel2 = (f2.nativeElement as HTMLElement).querySelector('[role="tabpanel"]');
    expect(panel2?.querySelector('action-buttons')).toBeTruthy();
  });

  it("header: 'none' shows no heading — the header row appears only to hold actionButtons", async () => {
    const contents: ContentView[] = [
      {
        type: 'html',
        slug: 'a',
        label: 'Hidden Label',
        title: 'Hidden Title',
        html: 'body-a',
        badge: 'NEW',
        actionButtons: [{ label: 'Go' }],
        header: 'none',
      },
      { type: 'html', slug: 'b', label: 'Bare', html: 'body-b', header: 'none' },
    ];
    const fixture = mount({ contents });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('body-a');
    expect(text).not.toContain('Hidden Label');
    expect(text).not.toContain('Hidden Title');
    expect(text).not.toContain('NEW');
    const [a, b] = Array.from(el.querySelectorAll('.contents-view-item'));
    expect(a.firstElementChild!.querySelector('action-buttons')).toBeTruthy(); // its header row
    // no heading and no buttons — nothing above the body
    expect(b.firstElementChild!.classList).toContain('contents-view-body');
  });

  it("title heads the header in place of the label; without one only header: 'full' uses the label", async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'Label A', title: 'Title A', icon: 'home', badge: 7, html: 'a' },
      { type: 'html', slug: 'b', label: 'Label B', html: 'b' },
      { type: 'html', slug: 'c', label: 'Label C', html: 'c', header: 'full' },
      { type: 'html', slug: 'd', label: 'Label D', title: 'Title D', html: 'd', header: 'full' },
    ];
    const fixture = mount({ contents });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstRow = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.contents-view-item'),
    ).map((item) => item.firstElementChild as HTMLElement);
    expect(firstRow[0].textContent).toContain('Title A');
    expect(firstRow[0].textContent).not.toContain('Label A');
    // in list mode the icon and badge ride along with the title
    expect(firstRow[0].querySelector('mat-icon')?.textContent).toBe('home');
    expect(firstRow[0].textContent).toContain('7');
    // no title, no buttons: no header row at all — the label only names a tab / collapsed strip
    expect(firstRow[1].classList).toContain('contents-view-body');
    expect(firstRow[2].textContent).toContain('Label C');
    expect(firstRow[3].textContent).toContain('Title D');
    expect(firstRow[3].textContent).not.toContain('Label D');
  });

  it('a title shows alone in a tab panel header — the tab button carries icon, label and badge', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'Tab A', title: 'Panel title', icon: 'home', badge: 7, html: 'a' },
    ];
    const fixture = mount({ contents, showContentsInTabs: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('[role="tabpanel"]')!;
    expect(panel.textContent).toContain('Panel title');
    expect(panel.textContent).not.toContain('Tab A');
    expect(panel.textContent).not.toContain('7');
    expect(panel.querySelector('mat-icon')).toBeNull();
  });

  it("header: 'none' hides the panel header even in tabs mode", async () => {
    const contents: ContentView[] = [
      {
        type: 'html',
        slug: 'a',
        label: 'Hidden Header',
        html: 'body-a',
        header: 'none',
      },
    ];
    const fixture = mount({ contents, showContentsInTabs: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('body-a');
    // label still shows on the tab toggle button, but not inside the panel header
    expect(panel?.textContent).not.toContain('Hidden Header');
  });

  it('renders actionButtons via <action-buttons> when present', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'body-a', actionButtons: [{ label: 'Go' }] },
    ];
    const fixture = mount({ contents });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('action-buttons')).toBeTruthy();
  });

  it("cascades contentsClass down through nested levels, merged with each level's own value", async () => {
    const contents: ContentView[] = [
      {
        type: 'group',
        slug: 'g1',
        contentsClass: 'level1-class',
        contents: [{ type: 'html', slug: 'leaf', html: 'leaf-body', class: 'own-class' }],
      },
    ];
    const fixture = mount({ contents, contentsClass: 'root-class' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nested = (fixture.nativeElement as HTMLElement).querySelector('contents-view');
    const leafDiv = nested?.querySelector('.own-class');
    expect(leafDiv).toBeTruthy();
    expect(leafDiv?.className).toContain('root-class');
    expect(leafDiv?.className).toContain('level1-class');
  });

  it("cascades bodiesClass down through nested levels, merged with each level's own bodyClass — independent of contentsClass/class", async () => {
    const contents: ContentView[] = [
      {
        type: 'group',
        slug: 'g1',
        bodiesClass: 'level1-body-class',
        contents: [
          { type: 'html', slug: 'leaf', html: 'leaf-body', bodyClass: 'own-body-class' },
        ],
      },
    ];
    const fixture = mount({ contents, bodiesClass: 'root-body-class' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nested = (fixture.nativeElement as HTMLElement).querySelector('contents-view');
    const bodyDiv = nested?.querySelector('.own-body-class');
    expect(bodyDiv).toBeTruthy();
    expect(bodyDiv?.className).toContain('root-body-class');
    expect(bodyDiv?.className).toContain('level1-body-class');
    expect(bodyDiv?.className).toContain('contents-view-body'); // structural class still present
  });

  it("cascades headersClass down through nested levels, merged with each level's own headerClass — independent of contentsClass/bodiesClass", async () => {
    const contents: ContentView[] = [
      {
        type: 'group',
        slug: 'g1',
        label: 'Group',
        headersClass: 'level1-header-class',
        contents: [
          {
            type: 'html',
            slug: 'leaf',
            label: 'Leaf',
            title: 'Leaf', // a heading, so there's a header row to carry the classes
            html: 'leaf-body',
            headerClass: 'own-header-class',
          },
        ],
      },
    ];
    const fixture = mount({ contents, headersClass: 'root-header-class' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nested = (fixture.nativeElement as HTMLElement).querySelector('contents-view');
    const headerDiv = nested?.querySelector('.own-header-class');
    expect(headerDiv).toBeTruthy();
    expect(headerDiv?.className).toContain('root-header-class');
    expect(headerDiv?.className).toContain('level1-header-class');
  });

  async function settle(fixture: ReturnType<typeof mount>) {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function mountWithInstance(params: ContentsParameter) {
    const fixture = mount(params);
    let instance: ContentsViewInstance | undefined;
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    await settle(fixture);
    return { fixture, instance: instance! };
  }

  /** CDK's key manager reads `keyCode` */
  const press = (el: Element, key: string, keyCode: number) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true }));

  it('a root tabs level renders its own toggles, each wired to its panel', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b', badge: 2 },
    ];
    const { fixture } = await mountWithInstance({ contents, showContentsInTabs: true });
    const el = fixture.nativeElement as HTMLElement;

    const tablist = el.querySelector('[role="tablist"]')!;
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');
    const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'));
    const panels = Array.from(el.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    expect(tabs.map((t) => t.querySelector('.cv-tab-nav-label')?.textContent)).toEqual(['A', 'B']);
    expect(tabs[1].textContent).toContain('2'); // the badge
    expect(tabs[0].getAttribute('aria-controls')).toBe(panels[0].id);
    expect(panels[0].getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1]); // one tab stop
    expect(panels.map((p) => p.hidden)).toEqual([false, true]);
  });

  it("suppresses label/icon in the tab panel header by default, shows them when header: 'full'", async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'Plain Tab', html: 'body-a' },
      { type: 'html', slug: 'b', label: 'Full Tab', html: 'body-b', header: 'full' },
    ];
    const fixture = mount({ contents, showContentsInTabs: true });
    let instance: ContentsViewInstance | undefined;
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const activePanel = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]'),
      ).find((p) => !p.hidden);

    expect(activePanel()?.textContent).not.toContain('Plain Tab'); // 'a' active by default, suppressed
    expect(activePanel()?.textContent).toContain('body-a');

    instance?.selectContent('b');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(activePanel()?.textContent).toContain('Full Tab'); // header: 'full' shows it
  });

  it('renders a tab panel when first shown, and keeps it mounted — hidden — once left', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b' },
    ];
    const { fixture, instance } = await mountWithInstance({ contents, showContentsInTabs: true });
    const panels = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]'),
      );

    // b's panel is there (its toggle's `aria-controls` target) but empty until first shown
    expect(panels()[1].hidden).toBe(true);
    expect(panels()[1].textContent).not.toContain('content-b');

    instance.selectContent('b');
    await settle(fixture);
    expect(panels().map((p) => p.hidden)).toEqual([true, false]);
    instance.selectContent('a');
    await settle(fixture);
    expect(panels().map((p) => p.hidden)).toEqual([false, true]);
    expect(panels()[1].textContent).toContain('content-b'); // still mounted
    // with its fit-mode item classes intact (contentsFit 'auto' → cover: matchMedia stub = true)
    expect(panels()[1].querySelector('.contents-view-item')!.className).toContain('flex');
  });

  it('preserveInactiveContent: false destroys a panel once it is left', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b' },
    ];
    const { fixture, instance } = await mountWithInstance({
      contents,
      showContentsInTabs: true,
      preserveInactiveContent: false,
    });
    instance.selectContent('b');
    await settle(fixture);
    instance.selectContent('a');
    await settle(fixture);
    const b = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="tabpanel"]')[1];
    expect(b.textContent).not.toContain('content-b');
  });

  it('remembers the active tab per route — a remount restores it', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b' },
    ];
    const first = await mountWithInstance({ contents, showContentsInTabs: true });
    first.instance.selectContent('b');
    await settle(first.fixture);
    first.fixture.destroy();

    const second = await mountWithInstance({ contents, showContentsInTabs: true });
    expect(second.instance.activeSlug()).toBe('b');
  });

  // ── tabs whose toggles the owning content hosts ──

  /** a group whose own contents are tabs — its toggles render in ITS header (or beside its body) */
  const tabbedGroup = (layout: ContentsLayout = {}, title?: string): ContentView => ({
    type: 'group',
    slug: 'g',
    label: 'Group',
    title,
    showContentsInTabs: true,
    ...layout,
    contents: [
      { type: 'html', slug: 'one', label: 'One', html: 'body-one' },
      { type: 'html', slug: 'two', label: 'Two', html: 'body-two' },
    ],
  });

  it("a nested tabs level's toggles join the owner's header, under its top row and a faded rule", async () => {
    const { fixture } = await mountWithInstance({ contents: [tabbedGroup({}, 'Group title')] });
    const item = (fixture.nativeElement as HTMLElement).querySelector('.contents-view-item')!;
    const header = item.firstElementChild as HTMLElement;

    expect(header.textContent).toContain('Group title'); // the top row
    expect(header.querySelector('.cv-tab-rule')).toBeTruthy();
    const tablist = header.querySelector('[role="tablist"]')!;
    expect(tablist.getAttribute('aria-label')).toBe('Group');
    expect(
      Array.from(tablist.querySelectorAll('.cv-tab-nav-label')).map((l) => l.textContent),
    ).toEqual(['One', 'Two']);
    // the nested level renders only its panels
    const nested = item.querySelector('contents-view')!;
    expect(nested.querySelector('[role="tablist"]')).toBeNull();
    expect(nested.querySelectorAll('[role="tabpanel"]').length).toBe(2);
  });

  it('a header holding nothing but the toggles has no rule', async () => {
    const { fixture } = await mountWithInstance({ contents: [tabbedGroup()] }); // no title, buttons or controls
    const header = (fixture.nativeElement as HTMLElement).querySelector('.contents-view-item')!
      .firstElementChild as HTMLElement;
    expect(header.querySelector('[role="tablist"]')).toBeTruthy();
    expect(header.querySelector('.cv-tab-rule')).toBeNull();
  });

  it("the owner's toggles switch the nested panels — by click, or arrow key and Enter", async () => {
    const { fixture } = await mountWithInstance({ contents: [tabbedGroup()] });
    const item = (fixture.nativeElement as HTMLElement).querySelector('.contents-view-item')!;
    const tabs = () => Array.from(item.firstElementChild!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = () =>
      Array.from(item.querySelector('contents-view')!.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

    expect(panels().map((p) => p.hidden)).toEqual([false, true]);
    tabs()[1].click();
    await settle(fixture);
    expect(panels().map((p) => p.hidden)).toEqual([true, false]);
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');

    // ArrowRight from Two wraps focus to One; Enter (a <button>'s native click) selects it
    tabs()[1].focus();
    press(tabs()[1], 'ArrowRight', 39);
    await settle(fixture);
    expect(document.activeElement).toBe(tabs()[0]);
    expect(panels()[1].hidden).toBe(false); // focus alone doesn't switch — manual activation
    (document.activeElement as HTMLButtonElement).click();
    await settle(fixture);
    expect(panels().map((p) => p.hidden)).toEqual([false, true]);
  });

  it('vertical toggles are a sidebar beside the body from lg up — and join the header below lg, the body untouched', async () => {
    const listeners = stubMatchMedia(true);
    const { fixture } = await mountWithInstance({
      contents: [tabbedGroup({ tabsOrientation: 'vertical' })],
    });
    const item = (fixture.nativeElement as HTMLElement).querySelector('.contents-view-item')!;
    const nested = item.querySelector('contents-view');

    // no header — nothing but the toggles would have called for one — and a [sidebar | body] row
    const frame = item.firstElementChild as HTMLElement;
    expect(frame.querySelector('[role="tablist"]')!.getAttribute('aria-orientation')).toBe('vertical');
    expect(frame.querySelector('.contents-view-body')!.contains(nested)).toBe(true);

    listeners.forEach((l) => l({ matches: false } as MediaQueryListEvent));
    await settle(fixture);
    const header = item.firstElementChild as HTMLElement;
    expect(header.querySelector('[role="tablist"]')!.getAttribute('aria-orientation')).toBe(
      'horizontal',
    );
    expect(item.querySelectorAll('[role="tablist"]').length).toBe(1); // moved, not copied
    expect(item.querySelector('contents-view')).toBe(nested); // the body wasn't re-created
  });

  it('cascades the tab class hooks to nested levels, merged with their own', async () => {
    const { fixture } = await mountWithInstance({
      contents: [tabbedGroup({ tabClass: 'own-tab' })],
      tabsContainerClass: 'root-strip',
      tabClass: 'root-tab',
      activeTabClass: 'root-active-tab',
      tabIndicatorClass: 'root-indicator',
    });
    const header = (fixture.nativeElement as HTMLElement).querySelector('.contents-view-item')!
      .firstElementChild as HTMLElement;
    const [active, other] = Array.from(header.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(header.querySelector('tab-nav')!.className).toContain('root-strip');
    expect(other.className).toContain('root-tab');
    expect(other.className).toContain('own-tab');
    expect(other.className).not.toContain('root-active-tab');
    expect(active.className).toContain('root-active-tab');
    expect(header.querySelector('.cv-tab-nav-indicator')!.className).toContain('root-indicator');
  });

  const coverClasses = (fixture: ReturnType<typeof mount>) =>
    (fixture.nativeElement as HTMLElement).querySelector('.contents-view-item')!.className;

  it("contentsFit 'flow' omits the fit-mode flex/height classes (grows naturally, no forced internal scroll)", async () => {
    const contents: ContentView[] = [{ type: 'html', slug: 'a', label: 'A', html: 'content-a' }];

    const fitting = mount({ contents }); // default 'auto' + matchMedia stub true → cover
    fitting.detectChanges();
    await fitting.whenStable();
    fitting.detectChanges();
    expect(coverClasses(fitting)).toContain('flex');
    expect(coverClasses(fitting)).toContain('h-full');
    expect(coverClasses(fitting)).toContain('min-h-0');

    const grown = mount({ contents, contentsFit: 'flow' });
    grown.detectChanges();
    await grown.whenStable();
    grown.detectChanges();
    expect(coverClasses(grown)).not.toContain('flex');
    expect(coverClasses(grown)).not.toContain('h-full');
    expect(coverClasses(grown)).not.toContain('min-h-0');
  });

  it("contentsFit 'auto' resolves to flow below lg and cover above, and flips on viewport change", async () => {
    const listeners = stubMatchMedia(false); // < lg
    const contents: ContentView[] = [{ type: 'html', slug: 'a', label: 'A', html: 'a' }];

    const fixture = mount({ contents }); // contentsFit defaults to 'auto'
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(coverClasses(fixture)).not.toContain('h-full'); // flow

    listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    fixture.detectChanges();
    expect(coverClasses(fixture)).toContain('h-full'); // now cover
  });

  it("below lg even 'cover' flows (flowOnSmallerView defaults on); flowOnSmallerView: false keeps it", async () => {
    stubMatchMedia(false); // < lg
    const contents: ContentView[] = [{ type: 'html', slug: 'a', label: 'A', html: 'a' }];

    const flowing = await mountSettled({ contents, contentsFit: 'cover' });
    expect(coverClasses(flowing)).not.toContain('h-full');

    const kept = await mountSettled({ contents, contentsFit: 'cover', flowOnSmallerView: false });
    expect(coverClasses(kept)).toContain('h-full');
  });

  it('flowOnSmallerView cascades to a nested level that never set it; a child can override it', async () => {
    stubMatchMedia(false); // < lg
    const group = (flowOnSmallerView?: boolean): ContentView => ({
      type: 'group',
      slug: 'g',
      contentsFit: 'cover',
      flowOnSmallerView,
      contents: [{ type: 'html', slug: 'x', label: 'X', html: 'x' }],
    });
    const nestedIsCover = (fixture: ReturnType<typeof mount>): boolean => {
      const nested = fixture.debugElement
        .queryAll(By.directive(ContentsViewComponent))
        .map((de) => de.componentInstance as ContentsViewComponent)
        .find((c) => c !== fixture.componentInstance)!;
      return (nested as unknown as { isCover(): boolean }).isCover();
    };

    const inherited = await mountSettled({ contents: [group()], flowOnSmallerView: false });
    expect(nestedIsCover(inherited)).toBe(true); // inherited `false` → still cover below lg

    const overridden = await mountSettled({ contents: [group(true)], flowOnSmallerView: false });
    expect(nestedIsCover(overridden)).toBe(false); // the child's own `true` wins → flows
  });

  it('a flowing root host is the scroll container; a flowing nested host just grows', async () => {
    stubMatchMedia(false); // < lg → flow
    const fixture = await mountSettled({
      contents: [
        {
          type: 'group',
          slug: 'g',
          label: 'G',
          contents: [{ type: 'html', slug: 'x', label: 'X', html: 'x' }],
        },
      ],
    });

    const root = fixture.nativeElement as HTMLElement;
    expect(root.className).toContain('h-full');
    expect(root.className).toContain('overflow-y-auto');
    expect(root.getAttribute('tabindex')).toBe('0'); // a scroll region is keyboard-reachable

    const nested = root.querySelector<HTMLElement>('contents-view')!;
    expect(nested.className).not.toContain('h-full');
    expect(nested.className).not.toContain('overflow-y-auto');
    expect(nested.getAttribute('tabindex')).toBeNull();
  });

  it('a covering root host fills its parent without becoming a scroll region itself', async () => {
    const fixture = await mountSettled({ contents: [{ type: 'html', slug: 'a', html: 'a' }] });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.className).toContain('h-full');
    expect(root.className).not.toContain('overflow-y-auto');
    expect(root.getAttribute('tabindex')).toBeNull();
  });

  // ── resizable gutters ──

  const gutters = (fixture: ReturnType<typeof mount>) =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="separator"]'),
    );

  async function mountSettled(params: ContentsParameter) {
    const fixture = mount(params);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const threeContents: ContentView[] = [
    { type: 'html', slug: 'a', label: 'A', html: 'a' },
    { type: 'html', slug: 'b', label: 'B', html: 'b' },
    { type: 'html', slug: 'c', label: 'C', html: 'c' },
  ];

  // jsdom has no layout, so `measureGrid` bails and gutters never render off a real measurement.
  // These helpers stub the container + item rects so a specific grid shape can be exercised.
  interface MeasurableComponent {
    measureGrid(): void;
    gridContainerRef(): { nativeElement: HTMLElement } | undefined;
    itemEls(): readonly { nativeElement: HTMLElement }[];
  }

  function stubRect(el: HTMLElement, r: Partial<DOMRect>): void {
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
        ...r,
      }) as DOMRect;
  }

  /** stub the container + item rects for a grid of `cols × rows` equal cells, then re-measure */
  async function measuredLayout(params: ContentsParameter, cols: number, rows: number) {
    const fixture = mount(params);
    let instance: ContentsViewInstance | undefined;
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comp = fixture.componentInstance as unknown as MeasurableComponent;
    const container = comp.gridContainerRef()!.nativeElement;
    const items = comp.itemEls().map((r) => r.nativeElement);
    const cellW = 300;
    const cellH = 200;
    const gap = 12;
    stubRect(container, {
      width: cols * cellW + (cols - 1) * gap,
      height: rows * cellH + (rows - 1) * gap,
    });
    items.forEach((el, i) => {
      const left = (i % cols) * (cellW + gap);
      const top = Math.floor(i / cols) * (cellH + gap);
      stubRect(el, { left, top, right: left + cellW, bottom: top + cellH });
    });
    comp.measureGrid();
    fixture.detectChanges();
    return { fixture, instance: instance! };
  }

  function gutterCounts(fixture: ReturnType<typeof mount>) {
    const g = gutters(fixture);
    return {
      vertical: g.filter((el) => el.getAttribute('aria-orientation') === 'vertical').length,
      horizontal: g.filter((el) => el.getAttribute('aria-orientation') === 'horizontal').length,
    };
  }

  it('renders no gutters unless resizable + cover + list + >1 content', async () => {
    expect(gutters(await mountSettled({ contents: threeContents })).length).toBe(0); // resizable unset
    expect(
      gutters(await mountSettled({ contents: threeContents, resizable: true, showContentsInTabs: true }))
        .length,
    ).toBe(0); // tabs
    expect(
      gutters(await mountSettled({ contents: threeContents, resizable: true, contentsFit: 'flow' }))
        .length,
    ).toBe(0); // flow
    expect(
      gutters(
        await mountSettled({
          contents: [threeContents[0]],
          resizable: true,
        }),
      ).length,
    ).toBe(0); // single content
  });

  it('a measured 2×2 grid → one width + one height gutter, ARIA-wired, positioning context', async () => {
    const four = [...threeContents, { type: 'html', slug: 'd', label: 'D', html: 'd' } as ContentView];
    const { fixture } = await measuredLayout({ contents: four, resizable: true }, 2, 2);

    expect(gutterCounts(fixture)).toEqual({ vertical: 1, horizontal: 1 });
    for (const el of gutters(fixture)) {
      expect(el.getAttribute('role')).toBe('separator');
      expect(el.getAttribute('tabindex')).toBe('0');
      expect(el.getAttribute('aria-label')).toBeTruthy();
      expect(el.getAttribute('aria-valuenow')).toBe('50'); // equal split
      expect(el.getAttribute('aria-valuemin')).toBe('0');
      expect(el.getAttribute('aria-valuemax')).toBe('100');
    }

    const container = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.contents-view-default-grid',
    )!;
    expect(container.classList).toContain('relative');
    expect(container.style.gridTemplateColumns).toBe('minmax(0, 1fr) minmax(0, 1fr)');
    expect(container.style.gridTemplateRows).toBe('minmax(0, 1fr) minmax(0, 1fr)');
  });

  it('ArrowRight on the column gutter grows the first column, fires onSizesChange, writes localStorage', async () => {
    const changes: ContentsSizes[] = [];
    const { fixture } = await measuredLayout(
      { contents: threeContents, resizable: true, onSizesChange: (s) => changes.push(s) },
      2,
      2,
    );

    const vGutter = gutters(fixture).find(
      (el) => el.getAttribute('aria-orientation') === 'vertical',
    )!;
    const leftBefore = parseFloat(vGutter.style.left);
    vGutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    // keyboard nudge runs the whole start → resize → end sequence synchronously (end flushes the
    // rAF-batched apply), so the first column's share grew past 50
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.at(-1)!.columns![0]).toBeGreaterThan(changes.at(-1)!.columns![1]);
    expect(localStorage.getItem('studio.tab-state.contents-sizes:/:a|b|c')).toBeTruthy();
    // the handle itself moved right with the drag (live offset — the drag-end re-measure is a
    // later frame), it doesn't wait for a refresh
    expect(parseFloat(vGutter.style.left)).toBeGreaterThan(leftBefore);
  });

  it('a row gutter handle follows the drag live', async () => {
    const { fixture } = await measuredLayout(
      { contents: [threeContents[0], threeContents[1]], resizable: true },
      1,
      2,
    );
    const hGutter = gutters(fixture)[0];
    const topBefore = parseFloat(hGutter.style.top);

    hGutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    expect(parseFloat(hGutter.style.top)).toBeGreaterThan(topBefore);
  });

  it('instance sizes()/setSizes()/resetSizes()', async () => {
    let instance: ContentsViewInstance | undefined;
    const fixture = mount({ contents: threeContents, resizable: true });
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    instance!.setSizes({ columns: [3, 1] });
    fixture.detectChanges();
    expect(instance!.sizes().columns).toEqual([3, 1]);

    instance!.resetSizes();
    fixture.detectChanges();
    expect(instance!.sizes().columns).toEqual([1, 1]);
  });

  it('restores a shape-compatible saved distribution from localStorage on mount', async () => {
    localStorage.setItem(
      'studio.tab-state.contents-sizes:/:a|b|c',
      JSON.stringify({ columns: [4, 1], rows: [2, 1] }),
    );
    let instance: ContentsViewInstance | undefined;
    const fixture = mount({ contents: threeContents, resizable: true });
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // fallback shape in jsdom is 2 columns / 2 rows, so both saved arrays are shape-compatible
    expect(instance!.sizes()).toEqual({ columns: [4, 1], rows: [2, 1] });
  });

  it('ignores a saved distribution whose length no longer matches (falls back to equal)', async () => {
    localStorage.setItem(
      'studio.tab-state.contents-sizes:/:a|b',
      JSON.stringify({ columns: [4, 1, 9] }), // 3 entries, only 2 columns now
    );
    let instance: ContentsViewInstance | undefined;
    const fixture = mount({ contents: [threeContents[0], threeContents[1]], resizable: true });
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(instance!.sizes().columns).toEqual([1, 1]); // equal split, not the stale [4,1,9]
  });

  it('cascades `resizable` to a nested level that never set it; `resizable: false` opts a subtree out', async () => {
    const group = (resizable?: boolean): ContentView => ({
      type: 'group',
      slug: 'g',
      contentsFit: 'cover',
      resizable,
      contents: [
        { type: 'html', slug: 'x', label: 'X', html: 'x' },
        { type: 'html', slug: 'y', label: 'Y', html: 'y' },
      ],
    });

    // the nested mount's own `resizeActive()` — true only if `resizable` reached it (no
    // measurement needed: it keys off params + fit, not geometry)
    const nestedResizeActive = (fixture: ReturnType<typeof mount>): boolean => {
      const nested = fixture.debugElement
        .queryAll(By.directive(ContentsViewComponent))
        .map((de) => de.componentInstance as ContentsViewComponent)
        .find((c) => c !== fixture.componentInstance)!;
      return (nested as unknown as { resizeActive(): boolean }).resizeActive();
    };

    const inherited = await mountSettled({ contents: [group()], resizable: true });
    expect(nestedResizeActive(inherited)).toBe(true); // inherited from the root

    const optedOut = await mountSettled({ contents: [group(false)], resizable: true });
    expect(nestedResizeActive(optedOut)).toBe(false); // child's explicit false wins
  });

  it('a measured single column of 3 → 2 height gutters, no width gutter', async () => {
    const { fixture } = await measuredLayout({ contents: threeContents, resizable: true }, 1, 3);
    expect(gutterCounts(fixture)).toEqual({ vertical: 0, horizontal: 2 });
  });

  it('a measured single row of 3 → 2 width gutters, no height gutter', async () => {
    const { fixture } = await measuredLayout({ contents: threeContents, resizable: true }, 3, 1);
    expect(gutterCounts(fixture)).toEqual({ vertical: 2, horizontal: 0 });
    const vGutter = gutters(fixture).find(
      (el) => el.getAttribute('aria-orientation') === 'vertical',
    )!;
    expect(vGutter.style.left).toBeTruthy(); // positioned from the measured boundary
  });

  it('a measured single column of 2 → one height gutter that round-trips through the instance', async () => {
    const { fixture, instance } = await measuredLayout(
      { contents: [threeContents[0], threeContents[1]], resizable: true },
      1,
      2,
    );

    expect(gutterCounts(fixture)).toEqual({ vertical: 0, horizontal: 1 });
    instance.setSizes({ rows: [3, 1] });
    fixture.detectChanges();
    expect(instance.sizes().rows).toEqual([3, 1]);
    const container = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.contents-view-default-grid',
    )!;
    expect(container.style.gridTemplateRows).toBe('minmax(0, 1.5fr) minmax(0, 0.5fr)'); // 3 : 1
    expect(container.style.gridTemplateColumns).toBe(''); // single column — nothing imposed
  });

  // ── collapsible: collapse / restore / full screen ──

  const byLabel = (fixture: ReturnType<typeof mount>, label: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `[aria-label="${label}"]`,
    );
  const gridContainer = (fixture: ReturnType<typeof mount>) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.contents-view-default-grid',
    )!;

  it('renders pane controls only with collapsible, and no collapse on a tabs level', async () => {
    const controls = (fixture: ReturnType<typeof mount>) =>
      (fixture.nativeElement as HTMLElement).querySelectorAll('.cv-pane-control').length;

    expect(controls(await mountSettled({ contents: threeContents }))).toBe(0);
    // jsdom has no element full screen, so only the collapse buttons — one per content
    expect(controls(await mountSettled({ contents: threeContents, collapsible: true }))).toBe(3);
    expect(
      controls(
        await mountSettled({ contents: threeContents, collapsible: true, showContentsInTabs: true }),
      ),
    ).toBe(0);
  });

  it('collapsing swaps the header for a restore strip and hides — but keeps — the body', async () => {
    const fixture = await mountSettled({ contents: threeContents, collapsible: true });

    const collapse = byLabel(fixture, 'Collapse A')!;
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    const bodyId = collapse.getAttribute('aria-controls')!;
    const body = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      `[id="${bodyId}"]`,
    )!;
    expect(body.hidden).toBe(false);

    collapse.click();
    fixture.detectChanges();
    const strip = byLabel(fixture, 'Restore A')!;
    expect(strip.getAttribute('aria-expanded')).toBe('false');
    expect(strip.getAttribute('aria-controls')).toBe(bodyId);
    expect(byLabel(fixture, 'Collapse A')).toBeNull();
    expect(body.hidden).toBe(true);
    expect(body.textContent).toContain('a'); // still mounted

    strip.click();
    fixture.detectChanges();
    expect(byLabel(fixture, 'Restore A')).toBeNull();
    expect(byLabel(fixture, 'Collapse A')).toBeTruthy();
    expect(body.hidden).toBe(false);
  });

  it('gives every pane a header row for its controls, heading or not', async () => {
    const fixture = await mountSettled({
      contents: [
        { type: 'html', slug: 'a', label: 'A', html: 'a', header: 'none' },
        { type: 'html', slug: 'b', label: 'B', html: 'b' }, // 'auto' with no title: no heading
      ],
      collapsible: true,
    });
    const [a, b] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.contents-view-item'),
    ).map((item) => item.firstElementChild!);
    expect(a.querySelector('[aria-label="Collapse A"]')).toBeTruthy();
    expect(b.querySelector('[aria-label="Collapse B"]')).toBeTruthy();
  });

  it('a measured single column collapses to a row strip and hands its row to the others', async () => {
    const { fixture, instance } = await measuredLayout(
      { contents: threeContents, collapsible: true },
      1,
      3,
    );
    instance.setCollapsed('a', true);
    fixture.detectChanges();

    expect(byLabel(fixture, 'Restore A')!.classList).toContain('cv-strip-row');
    expect(gridContainer(fixture).style.gridTemplateRows).toBe(
      'auto minmax(0, 1fr) minmax(0, 1fr)',
    );
    expect(gridContainer(fixture).style.gridTemplateColumns).toBe('');
    expect(instance.collapsed()).toEqual(['a']);

    instance.setCollapsed('a', false);
    fixture.detectChanges();
    expect(gridContainer(fixture).style.gridTemplateRows).toBe(''); // back to the class's own grid
  });

  it('a measured single row collapses to a column strip and hands its column to the others', async () => {
    const { fixture, instance } = await measuredLayout(
      { contents: threeContents, collapsible: true },
      3,
      1,
    );
    instance.setCollapsed('b', true);
    fixture.detectChanges();

    expect(byLabel(fixture, 'Restore B')!.classList).toContain('cv-strip-column');
    expect(gridContainer(fixture).style.gridTemplateColumns).toBe(
      'minmax(0, 1fr) auto minmax(0, 1fr)',
    );
    expect(gridContainer(fixture).style.gridTemplateRows).toBe('');
  });

  it('hides the gutters beside a collapsed track, and a drag keeps its share for the restore', async () => {
    const { fixture, instance } = await measuredLayout(
      { contents: threeContents, resizable: true, collapsible: true },
      1,
      3,
    );
    expect(gutterCounts(fixture)).toEqual({ vertical: 0, horizontal: 2 });

    instance.setSizes({ rows: [2, 1, 1] });
    instance.setCollapsed('a', true);
    fixture.detectChanges();
    expect(gutterCounts(fixture)).toEqual({ vertical: 0, horizontal: 1 }); // only b | c is left
    expect(gridContainer(fixture).style.gridTemplateRows).toBe(
      'auto minmax(0, 1fr) minmax(0, 1fr)',
    );

    gutters(fixture)[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    const rows = instance.sizes().rows!;
    expect(rows[0]).toBe(2); // the collapsed pane's share, untouched by the drag
    expect(rows[1]).toBeGreaterThan(rows[2]);

    instance.setCollapsed('a', false);
    fixture.detectChanges();
    // 2 of the 4 total weight, over three tracks averaging 1
    expect(gridContainer(fixture).style.gridTemplateRows.startsWith('minmax(0, 1.5fr)')).toBe(true);
  });

  it("keeps at least one pane expanded — the last one's collapse is disabled, and ignored", async () => {
    let instance: ContentsViewInstance | undefined;
    const fixture = mount({ contents: [threeContents[0], threeContents[1]], collapsible: true });
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(byLabel(fixture, 'Collapse B')!.hasAttribute('aria-disabled')).toBe(false);
    byLabel(fixture, 'Collapse A')!.click();
    fixture.detectChanges();

    const lastOpen = byLabel(fixture, 'Collapse B')!;
    expect(lastOpen.getAttribute('aria-disabled')).toBe('true'); // still focusable, not `disabled`
    expect(lastOpen.disabled).toBe(false);
    lastOpen.click();
    instance!.setCollapsed('b', true);
    fixture.detectChanges();
    expect(byLabel(fixture, 'Restore B')).toBeNull();
    expect(instance!.collapsed()).toEqual(['a']);

    byLabel(fixture, 'Restore A')!.click();
    fixture.detectChanges();
    expect(byLabel(fixture, 'Collapse B')!.hasAttribute('aria-disabled')).toBe(false);
  });

  it('offers no collapse on a lone pane', async () => {
    const fixture = await mountSettled({ contents: [threeContents[0]], collapsible: true });
    // jsdom has no element full screen either, so no controls at all
    expect((fixture.nativeElement as HTMLElement).querySelector('.cv-pane-control')).toBeNull();
  });

  it('reopens the first visible pane once the only expanded one is hidden', async () => {
    const showA = new BehaviorSubject(true);
    let instance: ContentsViewInstance | undefined;
    const fixture = mount({
      contents: [
        { type: 'html', slug: 'a', label: 'A', html: 'a', visible: showA },
        threeContents[1],
        threeContents[2],
      ],
      collapsible: true,
    });
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    instance!.setCollapsed('b', true);
    instance!.setCollapsed('c', true);
    fixture.detectChanges();
    expect(instance!.collapsed()).toEqual(['b', 'c']);

    showA.next(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(byLabel(fixture, 'Collapse B')).toBeTruthy();
    expect(byLabel(fixture, 'Restore C')).toBeTruthy();
    expect(instance!.collapsed()).toEqual(['c']);

    // and B stays expanded once A is back
    showA.next(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(instance!.collapsed()).toEqual(['c']);
  });

  it('keepOneExpanded: false lets every pane collapse, packing the strips to the start', async () => {
    const { fixture, instance } = await measuredLayout(
      { contents: [threeContents[0], threeContents[1]], collapsible: true, keepOneExpanded: false },
      2,
      1,
    );
    instance.setCollapsed('a', true);
    instance.setCollapsed('b', true);
    fixture.detectChanges();

    expect(instance.collapsed()).toEqual(['a', 'b']);
    expect(gridContainer(fixture).style.gridTemplateColumns).toBe('auto auto');
    expect(gridContainer(fixture).style.justifyContent).toBe('start');

    instance.setCollapsed('a', false);
    fixture.detectChanges();
    expect(gridContainer(fixture).style.justifyContent).toBe('');
  });

  describe('full screen', () => {
    let fullscreenElement: Element | null;
    const changed = () => document.dispatchEvent(new Event('fullscreenchange'));
    const request = vi.fn(function (this: Element) {
      fullscreenElement = this;
      changed();
      return Promise.resolve();
    });
    const exit = vi.fn(() => {
      fullscreenElement = null;
      changed();
      return Promise.resolve();
    });

    beforeEach(() => {
      fullscreenElement = null;
      request.mockClear();
      exit.mockClear();
      // jsdom implements no Fullscreen API — stand in for it
      Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
      });
      Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
      Object.defineProperty(Element.prototype, 'requestFullscreen', {
        configurable: true,
        value: request,
      });
    });

    afterEach(() => {
      for (const key of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) {
        delete (document as unknown as Record<string, unknown>)[key];
      }
      delete (Element.prototype as unknown as Record<string, unknown>)['requestFullscreen'];
    });

    it('puts the pane in full screen and follows the browser back out (Esc)', async () => {
      let instance: ContentsViewInstance | undefined;
      const fixture = mount({ contents: threeContents, collapsible: true, fullscreenable: true });
      fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      byLabel(fixture, 'Full screen: A')!.click();
      fixture.detectChanges();
      expect(request).toHaveBeenCalledTimes(1);
      const pane = fullscreenElement as HTMLElement;
      expect(pane.classList).toContain('contents-view-item');
      expect(instance!.fullscreenSlug()).toBe('a');
      expect(byLabel(fixture, 'Exit full screen: A')).toBeTruthy();
      expect(byLabel(fixture, 'Collapse A')).toBeNull(); // no collapsing a full-screen pane
      expect(pane.querySelector('.contents-view-body')!.className).toContain('overflow-y-auto');
      // overlays (dialogs, menus, toasts) opened now must live inside the full-screen pane —
      // the browser makes everything outside it inert
      const overlays = TestBed.inject(OverlayContainer).getContainerElement();
      expect(overlays.parentElement).toBe(pane);

      // the browser's own Esc
      fullscreenElement = null;
      changed();
      fixture.detectChanges();
      expect(instance!.fullscreenSlug()).toBeUndefined();
      expect(byLabel(fixture, 'Full screen: A')).toBeTruthy();
      expect(overlays.parentElement).toBe(document.body);

      // and the pane's own button leaves it too
      byLabel(fixture, 'Full screen: B')!.click();
      fixture.detectChanges();
      byLabel(fixture, 'Exit full screen: B')!.click();
      fixture.detectChanges();
      expect(exit).toHaveBeenCalledTimes(1);
      expect(instance!.fullscreenSlug()).toBeUndefined();
    });

    it('offers full screen — and only full screen — on a tabs level', async () => {
      const fixture = await mountSettled({
        contents: threeContents,
        collapsible: true,
        fullscreenable: true,
        showContentsInTabs: true,
      });
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[aria-label="Full screen: A"]')).toBeTruthy(); // active panel
      expect(el.querySelector('[aria-label^="Collapse"]')).toBeNull();
    });

    it('is a switch of its own — collapsible alone offers no full screen, fullscreenable no collapse', async () => {
      const collapseOnly = (await mountSettled({ contents: threeContents, collapsible: true }))
        .nativeElement as HTMLElement;
      expect(collapseOnly.querySelector('[aria-label="Collapse A"]')).toBeTruthy();
      expect(collapseOnly.querySelector('[aria-label^="Full screen"]')).toBeNull();

      const fullscreenOnly = (await mountSettled({ contents: threeContents, fullscreenable: true }))
        .nativeElement as HTMLElement;
      expect(fullscreenOnly.querySelectorAll('[aria-label^="Full screen"]').length).toBe(3);
      expect(fullscreenOnly.querySelector('[aria-label^="Collapse"]')).toBeNull();
    });

    it('cascades to nested levels; a child opts its subtree out with fullscreenable: false', async () => {
      const group = (fullscreenable?: boolean): ContentView => ({
        type: 'group',
        slug: 'g',
        label: 'G',
        fullscreenable,
        contents: [{ type: 'html', slug: 'leaf', label: 'Leaf', html: 'leaf' }],
      });

      const inherited = (await mountSettled({ contents: [group()], fullscreenable: true }))
        .nativeElement as HTMLElement;
      expect(inherited.querySelector('[aria-label="Full screen: Leaf"]')).toBeTruthy();

      const optedOut = (await mountSettled({ contents: [group(false)], fullscreenable: true }))
        .nativeElement as HTMLElement;
      expect(optedOut.querySelector('[aria-label="Full screen: Leaf"]')).toBeNull();
      expect(optedOut.querySelector('[aria-label="Full screen: G"]')).toBeTruthy(); // root level's own
    });
  });
});
