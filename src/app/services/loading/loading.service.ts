import {
  ApplicationRef,
  computed,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  Injectable,
  isDevMode,
  RendererFactory2,
  signal,
  untracked,
} from '@angular/core';
import { LOADING_CONFIG } from './loading-config.token';
import { LoadingOverlayContext, LoadingOverlayRef } from './loading-overlay-ref';

/** A class name (no leading dot) — meaning every element carrying it — or one specific element. */
export type LoadingTarget = string | HTMLElement;

/**
 * Covers loading targets with a spinner overlay. `show()` is reference counted per target, so
 * overlapping requests never hide each other's spinner; each overlay waits `LoadingConfig.delay`
 * before appearing and then stays at least `minDuration`. Targets get `aria-busy` while loading,
 * and a static target is made `relative` only for as long as its overlay is up.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(LOADING_CONFIG);
  private readonly context: LoadingOverlayContext = {
    appRef: inject(ApplicationRef),
    injector: inject(EnvironmentInjector),
    renderer: inject(RendererFactory2).createRenderer(null, null),
    config: this.config,
    disposed: (ref) => this.overlays.delete(ref.element),
  };

  /** Active `show()` calls per target. */
  private readonly counts = signal<ReadonlyMap<LoadingTarget, number>>(new Map());
  private readonly overlays = new Map<HTMLElement, LoadingOverlayRef>();
  /** The elements each active class-name target is currently covering. */
  private readonly covered = new Map<string, HTMLElement[]>();
  /** Class-name targets not rendered yet, with the timer that stops waiting for them. */
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();
  private observer?: MutationObserver;

  /** True while any target is loading. */
  readonly busy = computed(() => this.counts().size > 0);

  /** Whether `target` is loading — reactive when read in a template, `computed` or `effect`. */
  isLoading(target: LoadingTarget): boolean {
    return this.counts().has(target);
  }

  /**
   * Covers `target` until the returned function is called; calling it again is a no-op. A class
   * name covers every element that has it — including one rendered shortly after this call.
   * Safe to call from an `effect`: the counts it reads never become the effect's dependencies.
   */
  show(target: LoadingTarget | readonly LoadingTarget[]): () => void {
    const targets = toList(target);
    untracked(() => targets.forEach((t) => this.acquire(t)));

    let released = false;
    return () => {
      if (released) return;
      released = true;
      untracked(() => targets.forEach((t) => this.release(t)));
    };
  }

  /** Undoes one `show(target)` — for call sites that can't hold on to the release function. */
  hide(target: LoadingTarget | readonly LoadingTarget[]): void {
    untracked(() => toList(target).forEach((t) => this.release(t)));
  }

  /** Removes every overlay immediately and forgets all targets. */
  hideAll(): void {
    this.pending.forEach((timer) => clearTimeout(timer));
    this.pending.clear();
    this.stopObserving();
    this.covered.clear();
    [...this.overlays.values()].forEach((ref) => ref.dispose());
    this.counts.set(new Map());
  }

  private acquire(target: LoadingTarget): void {
    const count = (this.counts().get(target) ?? 0) + 1;
    this.setCount(target, count);
    if (count > 1) return;

    if (typeof target === 'string') this.coverClass(target);
    else this.overlayFor(target).acquire();
  }

  private release(target: LoadingTarget): void {
    const count = this.counts().get(target) ?? 0;
    if (count === 0) return;
    this.setCount(target, count - 1);
    if (count > 1) return;

    if (typeof target === 'string') this.uncoverClass(target);
    else this.overlays.get(target)?.release();
  }

  private setCount(target: LoadingTarget, count: number): void {
    this.counts.update((counts) => {
      const next = new Map(counts);
      if (count > 0) next.set(target, count);
      else next.delete(target);
      return next;
    });
  }

  private coverClass(className: string): void {
    const elements = this.findByClass(className);
    if (elements.length) return this.cover(className, elements);

    // not rendered yet (e.g. behind an @if the app flips as the request starts) — wait for it
    const timer = setTimeout(() => this.stopWaiting(className, true), this.config.waitForTarget);
    this.pending.set(className, timer);
    this.observe();
  }

  private cover(className: string, elements: HTMLElement[]): void {
    this.covered.set(className, elements);
    elements.forEach((element) => this.overlayFor(element).acquire());
  }

  private uncoverClass(className: string): void {
    this.stopWaiting(className, false);
    this.covered.get(className)?.forEach((element) => this.overlays.get(element)?.release());
    this.covered.delete(className);
  }

  private stopWaiting(className: string, timedOut: boolean): void {
    const timer = this.pending.get(className);
    if (timer === undefined) return;

    clearTimeout(timer);
    this.pending.delete(className);
    if (!this.pending.size) this.stopObserving();

    if (timedOut && isDevMode()) {
      console.warn(
        `LoadingService: no element with class "${className}" appeared within ` +
          `${this.config.waitForTarget}ms, so no overlay was shown for it.`,
      );
    }
  }

  private observe(): void {
    if (this.observer || typeof MutationObserver === 'undefined') return;

    this.observer = new MutationObserver(() => this.resolvePending());
    this.observer.observe(this.document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private resolvePending(): void {
    for (const className of [...this.pending.keys()]) {
      const elements = this.findByClass(className);
      if (!elements.length) continue;
      this.stopWaiting(className, false);
      this.cover(className, elements);
    }
  }

  private stopObserving(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private findByClass(className: string): HTMLElement[] {
    return Array.from(this.document.getElementsByClassName(className)).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
  }

  private overlayFor(element: HTMLElement): LoadingOverlayRef {
    let ref = this.overlays.get(element);
    if (!ref) {
      ref = new LoadingOverlayRef(element, this.context);
      this.overlays.set(element, ref);
    }
    return ref;
  }
}

function isTargetList(
  target: LoadingTarget | readonly LoadingTarget[],
): target is readonly LoadingTarget[] {
  return Array.isArray(target);
}

function toList(target: LoadingTarget | readonly LoadingTarget[]): readonly LoadingTarget[] {
  return isTargetList(target) ? target : [target];
}
