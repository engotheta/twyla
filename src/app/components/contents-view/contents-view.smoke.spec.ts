import { ANIMATION_MODULE_TYPE, Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { FieldType } from '../generic-form';
import { ContentsViewComponent } from './contents-view.component';
import { ContentsViewInstance, ContentsParameter, ContentView } from './contents.interface';

@Component({
  selector: 'test-widget',
  template: `<span>Widget: {{ label }}</span
    ><button type="button" (click)="clicked.emit(42)">Fire</button>`,
})
class TestWidgetComponent {
  @Input() label = '';
  @Output() clicked = new EventEmitter<number>();
}

describe('ContentsViewComponent', () => {
  beforeEach(() => {
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
    expect(activeItem.className).toContain('flex'); // fitContentsIntoView defaults true
    expect(inactiveItem.className).toContain('flex');
  });

  it('fitContentsIntoView: false omits the fit-mode flex/height classes (grows naturally, no forced internal scroll)', async () => {
    const contents: ContentView[] = [{ type: 'html', slug: 'a', label: 'A', html: 'content-a' }];

    const fitting = mount({ contents }); // default true
    fitting.detectChanges();
    await fitting.whenStable();
    fitting.detectChanges();
    const fittingItem = (fitting.nativeElement as HTMLElement).querySelector(
      '.contents-view-item',
    )!;
    expect(fittingItem.className).toContain('flex');
    expect(fittingItem.className).toContain('h-full');
    expect(fittingItem.className).toContain('min-h-0');

    const grown = mount({ contents, fitContentsIntoView: false });
    grown.detectChanges();
    await grown.whenStable();
    grown.detectChanges();
    const grownItem = (grown.nativeElement as HTMLElement).querySelector('.contents-view-item')!;
    expect(grownItem.className).not.toContain('flex');
    expect(grownItem.className).not.toContain('h-full');
    expect(grownItem.className).not.toContain('min-h-0');
  });
});
