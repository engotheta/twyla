import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShortcutsService } from '@services/shortcuts/shortcuts.service';
import { ContentsViewComponent } from './contents-view.component';
import { ContentsParameter } from './contents.interface';

/** jsdom has no `matchMedia`: the view is taken for wide, as the component's own spec does.
 *  (Both ways of listening: the component uses the one, the CDK's breakpoints the other.) */
function stubMatchMedia(): void {
  (window as unknown as { matchMedia: unknown }).matchMedia = (media: string) => ({
    media,
    matches: true,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  });
}

describe('the contents view answers its shortcuts', () => {
  let fixture: ComponentFixture<ContentsViewComponent>;
  let service: ShortcutsService;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function mount(params: ContentsParameter): Promise<void> {
    stubMatchMedia();
    TestBed.configureTestingModule({
      imports: [ContentsViewComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
    service = TestBed.inject(ShortcutsService);
    fixture = TestBed.createComponent(ContentsViewComponent);
    fixture.componentRef.setInput('params', params);
    await settle();
  }

  const host = () => fixture.nativeElement as HTMLElement;
  const press = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  const arm = (): void => {
    for (let i = 0; i < service.presses; i++) press('c');
  };
  const states = (): Record<string, string | undefined> =>
    Object.fromEntries((service.hint()?.shortcuts ?? []).map((row) => [row.id, row.state]));
  const tablist = () => host().querySelector('[role="tablist"]');

  const TWO: ContentsParameter = {
    contents: [
      { type: 'html', slug: 'a', label: 'First', html: '<p>one</p>' },
      { type: 'html', slug: 'b', label: 'Second', html: '<p>two</p>' },
    ],
  };

  afterEach(() => {
    service.close();
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it('C, six times, lists them, with how the level is laid out now', async () => {
    await mount(TWO);
    arm();

    expect(service.hint()!.title).toBe('Contents view');
    expect(states()).toMatchObject({
      tabs: 'off',
      resizable: 'off',
      collapsible: 'off',
      fit: 'on',
    });
    // where the tabs go is only a question once there are tabs
    expect(states()).not.toHaveProperty('vertical');
  });

  it('puts the contents in tabs on T, and back in a list on T again', async () => {
    await mount(TWO);
    expect(tablist()).toBeNull();
    arm();

    press('t');
    await settle();
    expect(tablist()).toBeTruthy();
    expect(states()).toMatchObject({ tabs: 'on', vertical: 'off' });

    press('t');
    await settle();
    expect(tablist()).toBeNull();
  });

  it('adds the collapse buttons, and takes everything back on 0', async () => {
    await mount(TWO);
    const collapseButtons = () => host().querySelectorAll('button[aria-label^="Collapse"]').length;
    expect(collapseButtons()).toBe(0);
    arm();

    press('x');
    await settle();
    expect(collapseButtons()).toBe(2);

    press('0');
    await settle();
    expect(collapseButtons()).toBe(0);
    expect(states()).not.toHaveProperty('reset');
  });

  it('gives every nested level a turn: C again moves to the next', async () => {
    await mount({
      contents: [
        {
          type: 'group',
          slug: 'outer',
          label: 'Outer',
          contents: [
            { type: 'html', slug: 'x', label: 'X', html: '<p>x</p>' },
            { type: 'html', slug: 'y', label: 'Y', html: '<p>y</p>' },
          ],
        },
        { type: 'html', slug: 'z', label: 'Z', html: '<p>z</p>' },
      ],
    });
    arm();
    expect(service.hint()!.position).toEqual({ index: 1, count: 2 });
    const first = document.querySelector('[data-shortcut-target]');

    press('c');
    expect(service.hint()!.position).toEqual({ index: 2, count: 2 });
    expect(document.querySelector('[data-shortcut-target]')).not.toBe(first);
  });

  it('leaves a whole tree as configured when its root says `shortcuts: false`', async () => {
    await mount({
      shortcuts: false,
      contents: [
        {
          type: 'group',
          slug: 'outer',
          contents: [{ type: 'html', slug: 'x', label: 'X', html: '<p>x</p>' }],
        },
        { type: 'html', slug: 'z', label: 'Z', html: '<p>z</p>' },
      ],
    });
    arm();
    expect(service.hint()).toBeNull();
  });
});
