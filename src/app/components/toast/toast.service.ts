import { LiveAnnouncer } from '@angular/cdk/a11y';
import { createGlobalPositionStrategy, createOverlayRef, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DOCUMENT, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import { TOAST_CONFIG } from './toast-config.token';
import { TOAST_STACK_HOST, ToastStackComponent, ToastStackHost } from './toast-stack.component';
import { Toast, ToastOptions, ToastType } from './toast.interface';

interface ToastTimer {
  handle?: ReturnType<typeof setTimeout>;
  /** Ms left before auto-dismiss, updated whenever the timer is paused. */
  remaining: number;
  startedAt: number;
}

/**
 * App-wide toasts: `inject(ToastService).success('Saved')`. Mounts its own stack (a CDK overlay,
 * bottom-end) on first use, so there is nothing to add to templates. Toasts auto-dismiss per type
 * (`TOAST_CONFIG`), pause while the stack is hovered or focused, are announced to screen readers,
 * and an identical message that is already showing is refreshed instead of stacked twice.
 */
@Injectable({ providedIn: 'root' })
export class ToastService implements ToastStackHost {
  private readonly injector = inject(Injector);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(TOAST_CONFIG);

  private readonly list = signal<readonly Toast[]>([]);
  /** Visible toasts, oldest first. */
  readonly toasts = this.list.asReadonly();

  private readonly timers = new Map<number, ToastTimer>();
  private paused = false;
  private overlayRef?: OverlayRef;
  private nextId = 0;

  success(message: string, options?: ToastOptions): number {
    return this.show('success', message, options);
  }

  error(message: string, options?: ToastOptions): number {
    return this.show('error', message, options);
  }

  info(message: string, options?: ToastOptions): number {
    return this.show('info', message, options);
  }

  /**
   * Shows a toast (or refreshes an identical visible one) and returns its id. Safe to call from
   * an `effect`: the toast list it reads never becomes the effect's dependency.
   */
  show(type: ToastType, message: string, options: ToastOptions = {}): number {
    return untracked(() => this.add(type, message, options));
  }

  private add(type: ToastType, message: string, options: ToastOptions): number {
    const duration = options.duration ?? this.config.duration[type];
    const existing = this.list().find((toast) => toast.type === type && toast.message === message);
    const toast = existing ?? { id: ++this.nextId, type, message, duration };

    if (!existing) {
      const list = [...this.list(), toast];
      const overflow = Math.max(list.length - this.config.maxVisible, 0);
      list.slice(0, overflow).forEach((dropped) => this.clearTimer(dropped.id));
      this.list.set(list.slice(overflow));
    }

    this.startTimer(toast.id, duration);
    this.announcer.announce(message, type === 'error' ? 'assertive' : 'polite');
    this.mount();
    return toast.id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.list.update((list) => list.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer.handle));
    this.timers.clear();
    this.list.set([]);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;

    const now = Date.now();
    this.timers.forEach((timer) => {
      if (timer.handle === undefined) return;
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining -= now - timer.startedAt;
    });
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.timers.forEach((timer, id) => this.run(id, timer));
  }

  private startTimer(id: number, duration: number): void {
    this.clearTimer(id);
    if (duration <= 0) return;

    const timer: ToastTimer = { remaining: duration, startedAt: Date.now() };
    this.timers.set(id, timer);
    if (!this.paused) this.run(id, timer);
  }

  private run(id: number, timer: ToastTimer): void {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), Math.max(timer.remaining, 0));
  }

  private clearTimer(id: number): void {
    clearTimeout(this.timers.get(id)?.handle);
    this.timers.delete(id);
  }

  /** Mounts the stack once; afterwards keeps it above anything opened since (e.g. a dialog). */
  private mount(): void {
    if (this.overlayRef) return this.raise(this.overlayRef.hostElement);

    this.overlayRef = createOverlayRef(this.injector, {
      positionStrategy: createGlobalPositionStrategy(this.injector).bottom('16px').end('16px'),
    });
    const injector = Injector.create({
      parent: this.injector,
      providers: [{ provide: TOAST_STACK_HOST, useValue: this }],
    });
    this.overlayRef.attach(new ComponentPortal(ToastStackComponent, null, injector));
  }

  /**
   * CDK overlays (dialogs included) render in the browser's top layer, where the most recently
   * shown popover wins — re-showing the stack's popover host puts it back on top.
   */
  private raise(host: HTMLElement): void {
    if (!('showPopover' in host) || !host.matches(':popover-open')) return;

    const focused = this.document.activeElement;
    host.hidePopover();
    host.showPopover();
    if (focused instanceof HTMLElement && host.contains(focused)) focused.focus();
  }
}
