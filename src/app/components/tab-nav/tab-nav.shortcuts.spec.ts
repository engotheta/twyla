import { signal } from '@angular/core';
import { Shortcut } from '@services/shortcuts/shortcuts.interface';
import { TabNavItem } from './tab-nav.interface';
import { TAB_NAV_EN } from './tab-nav.messages';
import { tabNavShortcuts } from './tab-nav.shortcuts';

const tab = (key: string, disabled = false): TabNavItem => ({
  key,
  label: key.toUpperCase(),
  disabled,
  tabId: `tab-${key}`,
  panelId: `panel-${key}`,
});

describe('tabNavShortcuts', () => {
  const tabs = signal<TabNavItem[]>([]);
  const active = signal<string | undefined>(undefined);
  let shortcuts: Shortcut[];

  const shortcut = (id: string) => shortcuts.find((one) => one.id === id)!;

  beforeEach(() => {
    tabs.set([tab('a'), tab('b', true), tab('c'), tab('d')]);
    active.set('a');
    // the nav owns no selection: whoever renders it follows `tabSelect`, as this does
    shortcuts = tabNavShortcuts(
      { tabs, activeKey: active, select: (key) => active.set(key) },
      signal(TAB_NAV_EN),
    );
  });

  it('steps to the next tab that can be picked, passing over a disabled one', () => {
    shortcut('next').run();
    expect(active()).toBe('c');
  });

  it('wraps at either end', () => {
    shortcut('previous').run();
    expect(active()).toBe('d');

    shortcut('next').run();
    expect(active()).toBe('a');
  });

  it('jumps to the first and the last', () => {
    shortcut('last').run();
    expect(active()).toBe('d');

    shortcut('first').run();
    expect(active()).toBe('a');
  });

  it('says which tab it is on, for what is announced once a step is taken', () => {
    expect(shortcut('next').state?.()).toBe('A');
    shortcut('next').run();
    expect(shortcut('next').state?.()).toBe('C');
  });

  it('is not offered where there is nowhere to step to', () => {
    expect(shortcuts.every((one) => one.available?.())).toBe(true);

    tabs.set([tab('a'), tab('b', true)]);
    expect(shortcuts.some((one) => one.available?.())).toBe(false);
  });
});
