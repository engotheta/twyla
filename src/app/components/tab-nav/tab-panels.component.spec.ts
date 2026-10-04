import { Component, input, OnInit, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabNavClasses, TabPanelsItem } from './tab-nav.interface';
import { TabPanelsComponent } from './tab-panels.component';

/** how many times each panel's body was made: a panel that is kept is made once */
let created: Record<string, number>;

@Component({
  selector: 'panel-body',
  template: `body of {{ key() }}`,
})
class PanelBodyComponent implements OnInit {
  readonly key = input.required<string>();

  ngOnInit(): void {
    created[this.key()] = (created[this.key()] ?? 0) + 1;
  }
}

@Component({
  imports: [TabPanelsComponent, PanelBodyComponent],
  template: `
    <tab-panels
      ariaLabel="Sections"
      panelClass="pt-3"
      [tabs]="tabs()"
      [classes]="classes()"
      [keepAlive]="keepAlive()"
      [(activeKey)]="active"
    >
      <ng-template let-key let-index="index">
        <panel-body [key]="key" /><span class="place">#{{ index }}</span>
      </ng-template>
    </tab-panels>
  `,
})
class HostComponent {
  readonly tabs = signal<TabPanelsItem[]>([
    { key: 'a', label: 'Alpha', icon: 'star' },
    { key: 'b', label: 'Beta', badge: 3 },
    { key: 'c', label: 'Gamma', disabled: true },
  ]);
  readonly classes = signal<TabNavClasses>({});
  readonly keepAlive = signal(true);
  readonly active = signal<string | undefined>(undefined);
}

describe('TabPanelsComponent', () => {
  function mount() {
    created = {};
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = () => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = () => Array.from(el.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    const shown = () => panels().filter((panel) => !panel.hidden);
    return { fixture, host: fixture.componentInstance, el, tabs, panels, shown };
  }

  it('renders a tablist over one panel per tab, each pair tied by its ids', () => {
    const { el, tabs, panels } = mount();

    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Sections');
    expect(tabs().map((tab) => tab.querySelector('.cv-tab-nav-label')!.textContent)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
    expect(panels().length).toBe(3);
    tabs().forEach((tab, i) => {
      const panel = panels()[i];
      expect(tab.id).toBeTruthy();
      expect(tab.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
      expect(panel.className).toContain('pt-3');
    });
    // what a tab shows beside its label
    expect(tabs()[0].querySelector('mat-icon')!.textContent).toBe('star');
    expect(tabs()[1].textContent).toContain('3');
    expect(tabs()[2].getAttribute('aria-disabled')).toBe('true');
  });

  it('starts on the first tab, with only its panel shown and rendered', () => {
    const { tabs, panels, shown } = mount();

    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(shown()).toEqual([panels()[0]]);
    expect(panels()[0].textContent).toContain('body of a');
    expect(panels()[0].querySelector('.place')!.textContent).toBe('#0');
    expect(panels()[1].textContent!.trim()).toBe(''); // not rendered until it is shown
    expect(created).toEqual({ a: 1 });
  });

  it('a pick shows that panel, tells the host, and keeps the one before it mounted', () => {
    const { fixture, host, tabs, panels, shown } = mount();

    tabs()[1].click();
    fixture.detectChanges();
    expect(host.active()).toBe('b');
    expect(shown()).toEqual([panels()[1]]);
    expect(panels()[1].textContent).toContain('body of b');
    expect(panels()[0].textContent).toContain('body of a'); // hidden, still there

    tabs()[0].click();
    fixture.detectChanges();
    expect(shown()).toEqual([panels()[0]]);
    expect(created).toEqual({ a: 1, b: 1 }); // neither was made twice
  });

  it('keepAlive: false renders the active panel only', () => {
    const { fixture, host, tabs, panels } = mount();
    host.keepAlive.set(false);

    tabs()[1].click();
    fixture.detectChanges();
    expect(panels()[0].textContent!.trim()).toBe('');

    tabs()[0].click();
    fixture.detectChanges();
    expect(created).toEqual({ a: 2, b: 1 });
  });

  it('follows the host’s activeKey, falling back when it names no tab that can be active', () => {
    const { fixture, host, tabs } = mount();
    const selected = () => tabs().findIndex((tab) => tab.getAttribute('aria-selected') === 'true');

    host.active.set('b');
    fixture.detectChanges();
    expect(selected()).toBe(1);

    host.active.set('c'); // disabled
    fixture.detectChanges();
    expect(selected()).toBe(0);

    host.active.set('gone');
    fixture.detectChanges();
    expect(selected()).toBe(0);

    // a disabled tab is never picked by a click either
    tabs()[2].click();
    fixture.detectChanges();
    expect(host.active()).toBe('gone');
  });

  it('hands its classes to the tab-nav', () => {
    const { fixture, host, el, tabs } = mount();
    host.classes.set({ container: 'hook-strip', tab: 'hook-tab', activeTab: 'hook-active' });
    fixture.detectChanges();

    expect(el.querySelector('tab-nav')!.className).toContain('hook-strip');
    expect(tabs()[0].className).toContain('hook-tab');
    expect(tabs()[0].className).toContain('hook-active');
    expect(tabs()[1].className).not.toContain('hook-active');
  });

  it('a tab that goes takes its panel with it', () => {
    const { fixture, host, panels, shown } = mount();
    host.active.set('b');
    fixture.detectChanges();

    host.tabs.update((tabs) => tabs.filter((tab) => tab.key !== 'b'));
    fixture.detectChanges();
    expect(panels().length).toBe(2);
    expect(shown()[0].textContent).toContain('body of a'); // the active one fell back to the first
  });
});
