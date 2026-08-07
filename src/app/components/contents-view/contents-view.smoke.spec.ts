import { Component, EventEmitter, Input, Output } from '@angular/core';
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
    TestBed.configureTestingModule({ imports: [ContentsViewComponent] });
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

  it('renders a content header inside the tab panel (not just the tab button) when the content has a badge but no label', async () => {
    const contents: ContentView[] = [{ type: 'html', slug: 'a', html: 'body-a', badge: 'NEW' }];
    const fixture = mount({ contents, showContentsInTabs: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('[role="tabpanel"]');
    expect(panel?.textContent).toContain('NEW');
    expect(panel?.textContent).toContain('body-a');
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
    // badge is never suppressed by the tabs-mode label/icon suppression, so it forces a real header
    const withHeader: ContentView[] = [
      { type: 'html', slug: 'a', label: 'A', html: 'content-a', badge: 'NEW' },
    ];
    const fixture = mount({ contents: withHeader, showContentsInTabs: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const tablist = (fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]')!;
    expect(tablist.className).toContain('rounded-lg');
    expect(tablist.className).not.toContain('rounded-t-lg');

    // no label/icon/badge/actionButtons on the only content -> showsHeader() is false for it
    const noHeader: ContentView[] = [{ type: 'html', slug: 'a', html: 'content-a' }];
    const fixture2 = mount({ contents: noHeader, showContentsInTabs: true });
    fixture2.detectChanges();
    await fixture2.whenStable();
    fixture2.detectChanges();
    const tablist2 = (fixture2.nativeElement as HTMLElement).querySelector('[role="tablist"]')!;
    expect(tablist2.className).toContain('rounded-t-lg');
    expect(tablist2.className).not.toContain('rounded-lg');
  });

  it('suppresses label/icon in the tab panel header by default, shows them when showFullHeaderInTabs is set', async () => {
    const contents: ContentView[] = [
      { type: 'html', slug: 'a', label: 'Plain Tab', html: 'body-a' },
      { type: 'html', slug: 'b', label: 'Full Tab', html: 'body-b', showFullHeaderInTabs: true },
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

    expect(activePanel()?.textContent).toContain('Full Tab'); // showFullHeaderInTabs shows it
  });

  it('an inactive-but-mounted tab panel gets a literal "hidden" class, not the flex/grid fit-mode classes alongside [hidden]', async () => {
    // Author-origin CSS (any Tailwind utility class, e.g. flex/grid) always wins over the
    // user-agent-origin `[hidden]` attribute's display:none, regardless of source order — so once
    // a panel wrapper carries a real `flex` class, [hidden] alone can no longer reliably hide it.
    // panelItemClass must short-circuit to the literal string 'hidden' for inactive panels instead
    // of merging fit-mode classes in — assert that directly, since a jsdom test can't observe the
    // real CSS cascade this guards against.
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

    // 'a' is active by default; 'b' has never been activated, so isPanelMounted() hasn't mounted
    // it yet (lazy-mount-once) — visit 'b' then switch back to 'a' so BOTH panels are mounted
    // (preserveInactiveContent defaults true), with 'a' active and 'b' hidden.
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
    const active = panels.find((p) => !p.hidden)!;
    const inactive = panels.find((p) => p.hidden)!;
    expect(active).toBeTruthy();
    expect(inactive).toBeTruthy();

    expect(inactive.className.trim()).toBe('hidden');
    expect(active.className).not.toBe('hidden');
    expect(active.className).toContain('flex'); // fitContentsIntoView defaults true
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
