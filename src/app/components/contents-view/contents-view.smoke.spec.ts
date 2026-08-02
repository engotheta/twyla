import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { FieldType } from '../generic-form';
import { ContentsViewComponent } from './contents-view.component';
import { ContentsViewInstance, ContentsViewParameter, ContentView } from './contents.interface';

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

  function mount(parameter: ContentsViewParameter) {
    const fixture = TestBed.createComponent(ContentsViewComponent);
    fixture.componentRef.setInput('parameter', parameter);
    return fixture;
  }

  it('renders every content type in list mode without throwing', async () => {
    const contents: ContentView[] = [
      { type: 'table', slug: 't', label: 'Table', gridParams: { columns: ['id'], gridData: [{ id: 1 }] } },
      { type: 'details', slug: 'd', label: 'Details', detailsParams: { entity: { name: 'Ada' } } },
      { type: 'form', slug: 'f', label: 'Form', formParams: { fields: [{ type: FieldType.input, key: 'name' }] } },
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
        contents: [{ type: 'table', slug: 'nested-t', gridParams: { columns: ['id'], gridData: [{ id: 2 }] } }],
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
});
