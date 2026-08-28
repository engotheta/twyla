import {
  AfterViewInit,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';
import { Router } from '@angular/router';

import { Subject, takeUntil } from 'rxjs';
import {
  claimPersistedSelectionKey,
  normalizeLabel,
  readPersistedSelection,
  releasePersistedSelectionKey,
  writePersistedSelection,
} from './persisted-selection.util';

/**
 * Applied to a `<mat-tab-group>`. Two independent jobs:
 *  - projects `tabHeaderClass` onto Material's own internal `.mat-mdc-tab-header` element, which
 *    a template `[class]` binding on `<mat-tab-group>` itself can never reach (view encapsulation
 *    stops at the child component boundary) — this is what lets `tabsContainerClass` actually show
 *    up on the real Material header.
 *  - drives the `--indicator-x`/`--indicator-width` custom properties `_material-tabs-group.scss`
 *    uses for the sliding active-tab pill, and restores/persists the last-active tab (by label
 *    text, via localStorage) so it survives a refresh.
 */
@Directive({
  selector: '[slidingTabIndicator]',
})
export class SlidingTabIndicatorDirective implements AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private tabs = inject(MatTabGroup);
  private el = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  /** class list to project onto `.mat-mdc-tab-header` — see class doc comment */
  readonly tabHeaderClass = input<string>('');

  private headerEl?: HTMLElement;
  private appliedHeaderClasses: string[] = [];
  private persistKey?: string;
  private pending = false;

  constructor() {
    effect(() => this.applyHeaderClass(this.tabHeaderClass()));
  }

  ngAfterViewInit() {
    this.renderer.addClass(this.el.nativeElement, 'custom-tabs');

    this.headerEl =
      (this.el.nativeElement.querySelector('.mat-mdc-tab-header') as HTMLElement) ?? undefined;

    this.applyHeaderClass(this.tabHeaderClass());

    this.restoreActiveTab();

    this.tabs.selectedTabChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.persistActiveTab();
      this.scheduleOnce();
    });

    this.scheduleOnce();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.persistKey) releasePersistedSelectionKey(this.persistKey);
  }

  private applyHeaderClass(classString: string) {
    if (!this.headerEl) return;

    const next = classString.split(' ').filter(Boolean);
    for (const cls of this.appliedHeaderClasses) {
      if (!next.includes(cls)) this.renderer.removeClass(this.headerEl, cls);
    }

    for (const cls of next) {
      this.renderer.addClass(this.headerEl, cls);
    }
    this.appliedHeaderClasses = next;
  }

  private tabLabelElements(): HTMLElement[] {
    return Array.from(this.el.nativeElement.querySelectorAll('.mdc-tab')) as HTMLElement[];
  }

  private restoreActiveTab() {
    const tabEls = this.tabLabelElements();
    if (!tabEls.length) return;

    this.persistKey = claimPersistedSelectionKey(
      'tabs',
      this.router.url,
      tabEls.map((t) => t.textContent ?? ''),
    );

    const saved = readPersistedSelection(this.persistKey);
    if (!saved) return;

    const index = tabEls.findIndex((t) => normalizeLabel(t.textContent) === saved);
    if (index >= 0) this.tabs.selectedIndex = index;
  }

  private persistActiveTab() {
    if (!this.persistKey) return;
    const tabEls = this.tabLabelElements();
    const active = tabEls[this.tabs.selectedIndex ?? 0];
    if (active) writePersistedSelection(this.persistKey, normalizeLabel(active.textContent));
  }

  private scheduleOnce() {
    if (this.pending) return;

    this.pending = true;

    this.ngZone.runOutsideAngular(() => {
      Promise.resolve().then(() => {
        requestAnimationFrame(() => [this.updateIndicator(), (this.pending = false)]);
      });
    });
  }

  private updateIndicator() {
    // scoped to THIS host, not `document` — a page-wide lookup would grab whichever tab group
    // anywhere happens to be active when more than one is mounted at once
    const active = this.el.nativeElement.querySelector('.mdc-tab--active') as HTMLElement;
    if (!active) return;

    const tabList = active.closest('.mat-mdc-tab-list') as HTMLElement;
    const labels = active.closest('.mat-mdc-tab-labels') as HTMLElement;
    const host = active.closest('.custom-tabs') as HTMLElement;

    if (!tabList || !labels || !host) return;

    const activeRect = active.getBoundingClientRect();
    const labelsRect = labels.getBoundingClientRect();

    const x = activeRect.left - labelsRect.left;
    const width = activeRect.width;

    host.style.setProperty('--indicator-x', `${x}px`);
    host.style.setProperty('--indicator-width', `${width}px`);
  }
}
