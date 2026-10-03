import { TestBed } from '@angular/core/testing';
import { TabNavComponent } from './tab-nav.component';
import { TabNavClasses, TabNavItem } from './tab-nav.interface';

const tab = (key: string, extra: Partial<TabNavItem> = {}): TabNavItem => ({
  key,
  label: key.toUpperCase(),
  disabled: false,
  tabId: `tab-${key}`,
  panelId: `panel-${key}`,
  ...extra,
});

/** CDK's key manager reads `keyCode` */
const press = (el: Element, key: string, keyCode: number) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true }));

/** jsdom has no layout — give an element the measurements the nav reads */
function stub(el: Element, values: Record<string, number>): void {
  for (const [prop, value] of Object.entries(values)) {
    Object.defineProperty(el, prop, { configurable: true, writable: true, value });
  }
}

interface NavInternals {
  sync(): void;
}

describe('TabNavComponent', () => {
  function mount(inputs: {
    tabs: TabNavItem[];
    activeKey?: string;
    orientation?: 'horizontal' | 'vertical';
    classes?: TabNavClasses;
  }) {
    const fixture = TestBed.createComponent(TabNavComponent);
    fixture.componentRef.setInput('tabs', inputs.tabs);
    fixture.componentRef.setInput('activeKey', inputs.activeKey);
    if (inputs.orientation) fixture.componentRef.setInput('orientation', inputs.orientation);
    if (inputs.classes) fixture.componentRef.setInput('classes', inputs.classes);
    const selected: string[] = [];
    fixture.componentInstance.tabSelect.subscribe((key) => selected.push(key));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    return { fixture, el, tabs, selected };
  }

  const abc = [tab('a'), tab('b'), tab('c')];

  it('renders a tablist of tabs wired to their panels, with one tab stop — the active tab', () => {
    const { el, tabs } = mount({ tabs: abc, activeKey: 'b' });
    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-orientation')).toBe(
      'horizontal',
    );
    expect(tabs().map((t) => t.id)).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(tabs().map((t) => t.getAttribute('aria-controls'))).toEqual([
      'panel-a',
      'panel-b',
      'panel-c',
    ]);
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('arrow keys move focus (wrapping) and Home/End jump; a click — what Enter/Space do — selects', () => {
    const { fixture, tabs, selected } = mount({ tabs: abc, activeKey: 'a' });
    tabs()[0].focus();

    press(tabs()[0], 'ArrowRight', 39);
    expect(document.activeElement).toBe(tabs()[1]);
    press(tabs()[1], 'ArrowLeft', 37);
    press(tabs()[0], 'ArrowLeft', 37);
    expect(document.activeElement).toBe(tabs()[2]); // wrapped
    press(tabs()[2], 'Home', 36);
    expect(document.activeElement).toBe(tabs()[0]);
    press(tabs()[0], 'End', 35);
    expect(document.activeElement).toBe(tabs()[2]);
    fixture.detectChanges();
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, -1, 0]); // the tab stop follows focus
    expect(selected).toEqual([]); // focus alone selects nothing

    tabs()[2].click();
    tabs()[0].click(); // already active — nothing to emit
    expect(selected).toEqual(['c']);
  });

  it('a disabled tab takes focus but is never selected', () => {
    const { tabs, selected } = mount({ tabs: [tab('a'), tab('b', { disabled: true })], activeKey: 'a' });
    tabs()[0].focus();
    press(tabs()[0], 'ArrowRight', 39);
    expect(document.activeElement).toBe(tabs()[1]); // not skipped — as Material's tabs
    expect(tabs()[1].getAttribute('aria-disabled')).toBe('true');
    tabs()[1].click();
    expect(selected).toEqual([]);
  });

  it('vertical: ↑/↓ move focus, ←/→ do not', () => {
    const { el, tabs } = mount({ tabs: abc, activeKey: 'a', orientation: 'vertical' });
    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-orientation')).toBe('vertical');
    tabs()[0].focus();
    press(tabs()[0], 'ArrowRight', 39);
    expect(document.activeElement).toBe(tabs()[0]);
    press(tabs()[0], 'ArrowDown', 40);
    expect(document.activeElement).toBe(tabs()[1]);
    press(tabs()[1], 'ArrowUp', 38);
    expect(document.activeElement).toBe(tabs()[0]);
  });

  it('focus leaving the tablist hands the tab stop back to the active tab', () => {
    const { fixture, tabs } = mount({ tabs: abc, activeKey: 'a' });
    tabs()[0].focus();
    press(tabs()[0], 'ArrowRight', 39);
    fixture.detectChanges();
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, 0, -1]);

    tabs()[1].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
    fixture.detectChanges();
    expect(tabs().map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it('pages an overflowing strip with arrows — aria-hidden, untabbable, disabled at their end', () => {
    const { fixture, el } = mount({ tabs: abc, activeKey: 'a' });
    const viewport = el.querySelector<HTMLElement>('.cv-tab-nav-viewport')!;
    stub(el, { clientWidth: 300 });
    stub(el.querySelector('[role="tablist"]')!, { scrollWidth: 900 });
    stub(viewport, { clientWidth: 240, scrollWidth: 900, scrollLeft: 0 });
    const scrollBy = vi.fn();
    viewport.scrollBy = scrollBy as unknown as typeof viewport.scrollBy;
    (fixture.componentInstance as unknown as NavInternals).sync();
    fixture.detectChanges();

    const arrows = () => Array.from(el.querySelectorAll<HTMLButtonElement>(':scope > button'));
    expect(arrows().length).toBe(2);
    expect(arrows().every((a) => a.getAttribute('aria-hidden') === 'true' && a.tabIndex === -1)).toBe(true);
    expect(arrows().map((a) => a.disabled)).toEqual([true, false]); // at the start

    arrows()[1].dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointerup')); // let go — no repeat
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 80 })); // a third of 240

    stub(viewport, { scrollLeft: 660 }); // scrolled to the end
    (fixture.componentInstance as unknown as NavInternals).sync();
    fixture.detectChanges();
    expect(arrows().map((a) => a.disabled)).toEqual([false, true]);
  });

  it('shows no arrows while the tabs fit', () => {
    const { fixture, el } = mount({ tabs: abc, activeKey: 'a' });
    stub(el, { clientWidth: 900 });
    stub(el.querySelector('[role="tablist"]')!, { scrollWidth: 400 });
    (fixture.componentInstance as unknown as NavInternals).sync();
    fixture.detectChanges();
    expect(el.querySelectorAll(':scope > button').length).toBe(0);
  });

  it("hands the indicator the active tab's box, along either axis", () => {
    const { fixture, el, tabs } = mount({ tabs: abc, activeKey: 'b' });
    tabs().forEach((t, i) =>
      stub(t, { offsetLeft: 100 * i, offsetTop: 40 * i, offsetWidth: 90, offsetHeight: 34 }),
    );
    const indicator = el.querySelector<HTMLElement>('.cv-tab-nav-indicator')!;
    const box = () =>
      ['x', 'y', 'w', 'h'].map((v) => indicator.style.getPropertyValue(`--cv-tab-${v}`));

    (fixture.componentInstance as unknown as NavInternals).sync();
    expect(box()).toEqual(['100px', '40px', '90px', '34px']);
    fixture.componentRef.setInput('activeKey', 'c');
    fixture.detectChanges();
    (fixture.componentInstance as unknown as NavInternals).sync();
    expect(box()).toEqual(['200px', '80px', '90px', '34px']);
  });

  it('merges consumer classes over the defaults — the consumer wins each conflict', () => {
    const { el, tabs } = mount({
      tabs: abc,
      activeKey: 'a',
      classes: {
        container: 'bg-gray-100',
        tab: 'px-6',
        activeTab: 'text-yellow-300',
        indicator: 'bg-emerald-600',
      },
    });
    expect(el.className).toContain('bg-gray-100');
    expect(el.className).not.toContain('bg-white');
    expect(tabs()[1].className).toContain('px-6');
    expect(tabs()[1].className).not.toContain('px-3.5');
    expect(tabs()[0].className).toContain('text-yellow-300');
    expect(tabs()[0].className).not.toContain('text-white');
    const indicator = el.querySelector('.cv-tab-nav-indicator')!;
    expect(indicator.className).toContain('bg-emerald-600');
    expect(indicator.className).not.toContain('bg-primary');
  });
});
