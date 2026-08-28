import {
  Directive,
  ElementRef,
  Renderer2,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
} from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  claimPersistedSelectionKey,
  normalizeLabel,
  readPersistedSelection,
  releasePersistedSelectionKey,
  writePersistedSelection,
} from '../contents-view/persisted-selection.util';

@Directive({
  selector: '[stepperProgressIndicator]',
})
export class StepperProgressIndicatorDirective implements AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private stepper = inject(MatStepper);
  private el = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private ngZone = inject(NgZone);
  private router = inject(Router);

  private bar!: HTMLElement;
  private observer?: MutationObserver;
  private pending = false;
  private persistKey?: string;

  ngAfterViewInit() {
    // restoring must happen inside the Angular zone (unlike the bar/RAF work below) so setting
    // `stepper.selectedIndex` actually triggers change detection and Material re-renders the step
    this.restoreActiveStep();

    this.ngZone.runOutsideAngular(() => {
      this.createBar();
      this.attach();
      this.scheduleOnce();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.observer?.disconnect();
    if (this.persistKey) releasePersistedSelectionKey(this.persistKey);
  }

  private headerElements(): HTMLElement[] {
    return Array.from(
      this.el.nativeElement.querySelectorAll('.mat-horizontal-stepper-header'),
    ) as HTMLElement[];
  }

  private restoreActiveStep() {
    const headers = this.headerElements();
    if (!headers.length) return;

    this.persistKey = claimPersistedSelectionKey(
      'stepper',
      this.router.url,
      headers.map((h) => h.textContent ?? ''),
    );

    const saved = readPersistedSelection(this.persistKey);
    if (!saved) return;

    const index = headers.findIndex((h) => normalizeLabel(h.textContent) === saved);
    if (index >= 0) this.stepper.selectedIndex = index;
  }

  private recordActive(index: number) {
    if (!this.persistKey) return;
    const headers = this.headerElements();
    const active = headers[index];
    if (active) writePersistedSelection(this.persistKey, normalizeLabel(active.textContent));
  }

  // ------------------------------------
  // DOM setup
  // ------------------------------------

  private createBar() {
    this.bar = this.renderer.createElement('div');
    this.renderer.addClass(this.bar, 'mat-stepper-progress');

    const headerContainer = this.el.nativeElement.querySelector(
      '.mat-horizontal-stepper-header-container',
    );

    if (!headerContainer) return;

    this.renderer.setStyle(headerContainer, 'position', 'relative');
    this.renderer.appendChild(headerContainer, this.bar);
  }

  private attach() {
    this.stepper.selectionChange.pipe(takeUntil(this.destroy$)).subscribe((x) => {
      this.recordActive(x.selectedIndex);
      this.scheduleOnce();
    });

    const container = this.el.nativeElement.querySelector(
      '.mat-horizontal-stepper-header-container',
    );

    if (!container) return;

    this.observer = new MutationObserver(() => this.scheduleOnce());

    this.observer.observe(container, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style'],
    });
  }

  // ------------------------------------
  // Scheduling (stable RAF)
  // ------------------------------------

  private scheduleOnce() {
    if (this.pending) return;
    this.pending = true;

    Promise.resolve().then(() => {
      requestAnimationFrame(() => {
        this.update();
        this.pending = false;
      });
    });
  }

  // ------------------------------------
  // Progress bar math
  // ------------------------------------

  private update() {
    const headers = this.headerElements();

    if (!headers.length) return;

    const first = headers[0];
    const current = headers[this.stepper.selectedIndex];
    if (!first || !current) return;

    const container = first.parentElement!;
    const translateX = this.getTranslateX(container);

    const firstRect = first.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const x = firstRect.left - containerRect.left - translateX;
    const width = currentRect.right - firstRect.left;

    this.bar.style.setProperty('--progress-x', `${x}px`);
    this.bar.style.setProperty('--progress-width', `${width}px`);

    const isComplete = this.stepper.selectedIndex === headers.length - 1;
    this.bar.classList.toggle('complete', isComplete);
  }

  private getTranslateX(el: HTMLElement): number {
    const transform = getComputedStyle(el).transform;
    if (!transform || transform === 'none') return 0;

    const match = transform.match(/matrix\((.+)\)/);
    if (!match) return 0;

    return Number(match[1].split(',')[4]) || 0;
  }
}
