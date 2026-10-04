import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  input,
  model,
  signal,
  TemplateRef,
  untracked,
} from '@angular/core';
import { TabNavComponent } from './tab-nav.component';
import { TabNavClasses, TabNavItem, TabPanelsItem } from './tab-nav.interface';

let nextId = 0;

/**
 * Tabs with their panels: a `tab-nav` and, under it, one panel per tab — the active one shown.
 * For tabs that need nothing more than that (a details' groups); `contents-view` lays out its
 * own panels and uses `tab-nav` alone.
 *
 * What a panel holds is the one `<ng-template>` given as content, rendered once per tab with the
 * tab's `key` (and its `index`):
 *
 *     <tab-panels [tabs]="tabs()" ariaLabel="Sections">
 *       <ng-template let-key let-index="index"> … </ng-template>
 *     </tab-panels>
 *
 * A panel is rendered when first shown and then kept, hidden, so what it holds keeps its state
 * (a table its page, a list its open rows); `keepAlive: false` renders the active one only.
 * `activeKey` can be bound either way; left alone, the first tab that isn't disabled is active.
 */
@Component({
  selector: 'tab-panels',
  imports: [NgTemplateOutlet, TabNavComponent],
  template: `
    <tab-nav
      [tabs]="navTabs()"
      [activeKey]="active()"
      [ariaLabel]="ariaLabel()"
      [classes]="classes()"
      (tabSelect)="activeKey.set($event)"
    />
    @for (tab of navTabs(); track tab.key; let i = $index) {
      <!-- always present (an aria-controls target); its content renders once first shown -->
      <div
        role="tabpanel"
        [id]="tab.panelId"
        [attr.aria-labelledby]="tab.tabId"
        [hidden]="tab.key !== active()"
        [class]="panelClass()"
      >
        @if (renders(tab.key)) {
          <ng-container
            [ngTemplateOutlet]="panel()"
            [ngTemplateOutletContext]="{ $implicit: tab.key, index: i }"
          />
        }
      </div>
    }
  `,
  host: { class: 'flex min-w-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabPanelsComponent {
  readonly tabs = input.required<readonly TabPanelsItem[]>();
  /** the active tab's key */
  readonly activeKey = model<string>();
  /** the tablist's accessible name */
  readonly ariaLabel = input<string>();
  /** the toggles' classes, as `tab-nav` takes them */
  readonly classes = input<TabNavClasses>({});
  /** every panel's class */
  readonly panelClass = input('');
  /** default true: a panel shown once stays mounted */
  readonly keepAlive = input(true);

  protected readonly panel = contentChild.required(TemplateRef);

  private readonly id = `tab-panels-${nextId++}`;

  protected readonly navTabs = computed<TabNavItem[]>(() =>
    this.tabs().map((tab, index) => ({
      key: tab.key,
      label: tab.label,
      icon: tab.icon,
      badge: tab.badge,
      disabled: tab.disabled ?? false,
      tabId: `${this.id}-tab-${index}`,
      panelId: `${this.id}-panel-${index}`,
    })),
  );

  /** `activeKey` while it names a tab that can be active, else the first tab that can */
  protected readonly active = computed(() => {
    const tabs = this.navTabs();
    const key = this.activeKey();
    if (tabs.some((tab) => tab.key === key && !tab.disabled)) return key;
    return (tabs.find((tab) => !tab.disabled) ?? tabs[0])?.key;
  });

  /** the keys of the panels shown so far */
  private readonly visited = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => {
      const key = this.active();
      if (key === undefined) return;
      untracked(() => {
        if (!this.visited().has(key)) this.visited.update((keys) => new Set(keys).add(key));
      });
    });
  }

  protected renders(key: string): boolean {
    return key === this.active() || (this.keepAlive() && this.visited().has(key));
  }
}
