import { Signal } from '@angular/core';

/** one toggle of a `tab-nav`: what it shows, and the ids tying it to its panel */
export interface TabNavItem {
  /** identity within the nav — what `tabSelect` emits */
  key: string;
  label: string;
  icon?: string;
  badge?: string | number;
  /** still focusable (as Material's tabs are), never selectable */
  disabled: boolean;
  /** the toggle's own `id` — its panel's `aria-labelledby` */
  tabId: string;
  /** its panel's `id` — the toggle's `aria-controls` */
  panelId: string;
}

/** consumer classes, each merged over the nav's defaults (consumer wins conflicts) */
export interface TabNavClasses {
  /** the strip (or, vertical, the sidebar) holding the toggles */
  container?: string;
  /** every toggle */
  tab?: string;
  /** the active toggle, on top of `tab` */
  activeTab?: string;
  /** the indicator sliding behind the active toggle */
  indicator?: string;
}

/** a tabs level's navigation, as the level hands it to whoever renders its toggles — itself at
 *  the root, else the content owning those tabs (see `ContentsViewComponent.tabsHost`) */
export interface TabNavState {
  /** the toggles — empty unless the level shows its contents as tabs */
  readonly tabs: Signal<readonly TabNavItem[]>;
  readonly activeKey: Signal<string | undefined>;
  readonly classes: Signal<TabNavClasses>;
  select(key: string): void;
}
