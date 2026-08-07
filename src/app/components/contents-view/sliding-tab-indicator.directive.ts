import {
  Directive,
  AfterViewInit,
  OnDestroy,
  inject,
  ElementRef,
  Renderer2,
  NgZone,
} from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';
import { Router } from '@angular/router';

import { Subject, takeUntil } from 'rxjs';

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

  private groupKey!: string;
  private pending = false;

  ngAfterViewInit() {
    this.setInitialActive();

    this.renderer.addClass(this.el.nativeElement, 'custom-tabs');
    this.tabs.selectedTabChange.pipe(takeUntil(this.destroy$)).subscribe(() => this.scheduleOnce());

    // Initial update
    // delayedExecution(() => this.scheduleOnce(), 400);
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

  private setInitialActive() {
    // let tabs = document.querySelectorAll('.mdc-tab');
    // let url = this.router.url;
    // let groupKey = url.split('/').pop() ?? 'tabs';
    // tabs.forEach((t, i) => (groupKey += `-${slugify(t.textContent.trim())}`));
    // let info = this.vs.getLocationInfo(url);
    // this.groupKey = groupKey;
    // let activeSlug = info?.variables?.[this.groupKey];
    // if (!activeSlug) return;
    // let ac = 'mdc-tab--active';
    // tabs.forEach((tab, i) => {
    //   if (!tab.textContent.trim().includes(activeSlug)) return this.renderer.removeClass(tab, ac);
    //   this.renderer.addClass(tab, ac);
    //   this.tabs.selectedIndex = i;
    // });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateIndicator() {
    const active = document.querySelector('.mdc-tab--active') as HTMLElement;
    if (!active) return;

    // this.vs.setLocInfo('variables', { [this.groupKey]: active.textContent.trim() });

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
