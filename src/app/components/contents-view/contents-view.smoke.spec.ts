import { ANIMATION_MODULE_TYPE, Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject } from 'rxjs';
import { FieldType } from '../generic-form';
import { ContentsViewComponent, redistributePx } from './contents-view.component';
import {
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
 *  `persisted-selection.util` is try/catch-guarded so the component is unaffected, but the
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
    // <mat-tab-group> attaches a newly-selected tab's content on a real ~100ms fallback timer
    // (simulating a CSS transitionend that jsdom never fires) unless animations are known to be
    // off — that timer runs outside the Angular zone, so `whenStable()` won't wait for it and a
    // freshly-selected tab's content would read back empty. Declaring 'NoopAnimations' (the same
    // token `@angular/platform-browser/animations`'s `provideNoopAnimations()` sets, not pulled in
    // here since `@angular/animations` isn't a project dependency) makes Material attach it
    // synchronously instead, which is what every test below assumes.
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

  it("header: 'none' hides the whole header (label, badge, actionButtons) in list mode", async () => {
    const contents: ContentView[] = [
      {
        type: 'html',
        slug: 'a',
        label: 'Hidden Header',
        html: 'body-a',
        badge: 'NEW',
        actionButtons: [{ label: 'Go' }],
        header: 'none',
      },
    ];
    const fixture = mount({ contents });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('body-a');
    expect(text).not.toContain('Hidden Header');
    expect(text).not.toContain('NEW');
    expect((fixture.nativeElement as HTMLElement).querySelector('action-buttons')).toBeNull();
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

  it('tablist is fully rounded when the active tab has a visible header, top-rounded only otherwise', async () => {
    // `tablistClass()` no longer lands on a DOM element THIS component's own template owns — it's
    // pushed onto Material's internal `.mat-mdc-tab-header` by `SlidingTabIndicatorDirective`'s
    // `tabHeaderClass` input (see `contents-view.component.html`), so assert against that element.
    // in tabs mode, `header: 'auto'` only renders a panel header for actionButtons, so use those
    const withHeader: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a', actionButtons: [{ label: 'Go' }] },
    ];
    const fixture = mount({ contents: withHeader, showContentsInTabs: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const header = (fixture.nativeElement as HTMLElement).querySelector('.mat-mdc-tab-header')!;
    expect(header.className).toContain('rounded-lg');
    expect(header.className).not.toContain('rounded-t-lg');

    // no label/icon/badge/actionButtons on the only content -> showsHeader() is false for it
    const noHeader: ContentView[] = [{ type: 'html', slug: 'a', html: 'content-a' }];
    const fixture2 = mount({ contents: noHeader, showContentsInTabs: true });
    fixture2.detectChanges();
    await fixture2.whenStable();
    fixture2.detectChanges();
    const header2 = (fixture2.nativeElement as HTMLElement).querySelector('.mat-mdc-tab-header')!;
    expect(header2.className).toContain('rounded-t-lg');
    expect(header2.className).not.toContain('rounded-lg');
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

    // Material's <mat-tab-body> marks the inactive one via `aria-hidden`, not the native `hidden`
    // attribute/property (see the "mounted but inactive" test below for the full rationale).
    const activePanel = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]'),
      ).find((p) => p.getAttribute('aria-hidden') !== 'true');

    expect(activePanel()?.textContent).not.toContain('Plain Tab'); // 'a' active by default, suppressed
    expect(activePanel()?.textContent).toContain('body-a');

    instance?.selectContent('b');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(activePanel()?.textContent).toContain('Full Tab'); // header: 'full' shows it
  });

  it('an inactive-but-mounted tab panel is hidden via aria-hidden, keeping its fit-mode classes (Material owns visibility, not a literal "hidden" class swap)', async () => {
    // <mat-tab-group preserveContent> (mapped from `preserveInactiveContent`, default true) keeps
    // an already-visited tab's content in the DOM instead of destroying it, and Material itself
    // marks the inactive <mat-tab-body> via `[attr.aria-hidden]` + its own `.mat-mdc-tab-body`/
    // `.mat-mdc-tab-body-content` CSS (position/overflow/visibility) — unlike the old hand-rolled
    // tablist, `listItemClass`'s flex/grid fit-mode classes no longer need to be swapped out for a
    // literal 'hidden' string for the inactive panel to actually disappear.
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a' },
      { type: 'html', slug: 'b', label: 'B', html: 'content-b' },
    ];
    const fixture = mount({ contents, showContentsInTabs: true });
    let instance: ContentsViewInstance | undefined;
    fixture.componentInstance.instanceChange.subscribe((i) => (instance = i));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // 'a' is active by default; visit 'b' then switch back to 'a' so BOTH panels are mounted
    // (preserveContent keeps 'b' around instead of tearing it down), with 'a' active and 'b' hidden.
    instance?.selectContent('b');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    instance?.selectContent('a');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    );
    const active = panels.find((p) => p.getAttribute('aria-hidden') !== 'true')!;
    const inactive = panels.find((p) => p.getAttribute('aria-hidden') === 'true')!;
    expect(active).toBeTruthy();
    expect(inactive).toBeTruthy();
    expect(active.textContent).toContain('content-a');
    expect(inactive.textContent).toContain('content-b'); // still mounted, just aria-hidden

    // both keep the same fit-mode wrapper classes — Material hides the inactive one itself
    const activeItem = active.querySelector('.contents-view-item')!;
    const inactiveItem = inactive.querySelector('.contents-view-item')!;
    expect(activeItem.className).toContain('flex'); // contentsFit 'auto' → cover (matchMedia stub = true)
    expect(inactiveItem.className).toContain('flex');
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

    // explicit 'cover' ignores the breakpoint
    const forced = mount({ contents, contentsFit: 'cover' });
    forced.detectChanges();
    await forced.whenStable();
    forced.detectChanges();
    expect(coverClasses(forced)).toContain('h-full');
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
    expect(container.style.gridTemplateRows).toBe('minmax(0, 3fr) minmax(0, 1fr)');
    expect(container.style.gridTemplateColumns).toBe(''); // single column — nothing imposed
  });
});
