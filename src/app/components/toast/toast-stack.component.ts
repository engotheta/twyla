import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  InjectionToken,
  Signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Toast, ToastType } from './toast.interface';

/** What `ToastStackComponent` needs from whoever mounts it — `ToastService`. */
export interface ToastStackHost {
  readonly toasts: Signal<readonly Toast[]>;
  dismiss(id: number): void;
  /** Freezes auto-dismiss while the user hovers or focuses the stack (WCAG 2.2.1). */
  pause(): void;
  resume(): void;
}

/** Provided by `ToastService` when it mounts the stack, so this file never imports the service. */
export const TOAST_STACK_HOST = new InjectionToken<ToastStackHost>('TOAST_STACK_HOST');

const ICONS: Record<ToastType, string> = { success: 'check_circle', error: 'error', info: 'info' };

/**
 * Renders `ToastService`'s toasts. Screen-reader announcements go through `LiveAnnouncer` in the
 * service, so toasts carry no live-region roles of their own (that would read them twice).
 */
@Component({
  selector: 'toast-stack',
  imports: [MatIcon],
  host: {
    '[attr.role]': 'host.toasts().length ? "region" : null',
    '[attr.aria-label]': 'host.toasts().length ? "Notifications" : null',
    '(mouseenter)': 'onPointer(true)',
    '(mouseleave)': 'onPointer(false)',
    '(focusin)': 'onFocusIn($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    @for (toast of host.toasts(); track toast.id) {
      <div
        class="toast toast-{{ toast.type }}"
        animate.enter="toast-enter"
        animate.leave="toast-leave"
      >
        <mat-icon class="toast-icon" aria-hidden="true">{{ icons[toast.type] }}</mat-icon>
        <p class="toast-message">{{ toast.message }}</p>
        <button
          type="button"
          class="toast-dismiss"
          aria-label="Dismiss notification"
          [attr.data-toast-id]="toast.id"
          (click)="dismiss(toast.id)"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: min(24rem, calc(100vw - 2rem));
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 0.75rem 0.75rem 1rem;
      border-radius: 0.75rem;
      box-shadow: var(--mat-sys-level3);
      font: var(--mat-sys-body-medium);
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
    }

    .toast-icon {
      flex: none;
    }

    .toast-success .toast-icon,
    .toast-info .toast-icon {
      color: var(--mat-sys-inverse-primary);
    }

    .toast-error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .toast-message {
      flex: 1;
      margin: 0;
      padding-block: 0.125rem;
      overflow-wrap: anywhere;
    }

    .toast-dismiss {
      flex: none;
      display: inline-grid;
      place-items: center;
      inline-size: 2rem;
      block-size: 2rem;
      margin-block: -0.25rem;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .toast-dismiss:hover {
      background: color-mix(in srgb, currentColor 12%, transparent);
    }

    .toast-dismiss:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .toast-dismiss mat-icon {
      width: 1.25rem;
      height: 1.25rem;
      font-size: 1.25rem;
    }

    .toast-enter {
      animation: toast-in 180ms ease-out;
    }

    .toast-leave {
      animation: toast-out 150ms ease-in forwards;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }

    @keyframes toast-out {
      to {
        opacity: 0;
        transform: translateX(1rem);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast-enter,
      .toast-leave {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastStackComponent {
  protected readonly host = inject(TOAST_STACK_HOST);
  protected readonly icons = ICONS;

  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private hovered = false;
  /** Where keyboard focus was before it entered the stack; it returns there once the stack empties. */
  private returnFocusTo?: HTMLElement;

  constructor() {
    // a toast can leave while hovered/focused (auto-dismissed, pushed out by a newer one) —
    // re-check whether the stack is still engaged once the DOM has caught up
    afterRenderEffect(() => {
      this.host.toasts();
      this.syncPause(this.focusInside());
    });
  }

  protected onPointer(hovered: boolean): void {
    this.hovered = hovered;
    this.syncPause(this.focusInside());
  }

  protected onFocusIn(event: FocusEvent): void {
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !this.element.contains(from)) this.returnFocusTo = from;
    this.syncPause(true);
  }

  protected onFocusOut(event: FocusEvent): void {
    this.syncPause(event.relatedTarget instanceof Node && this.element.contains(event.relatedTarget));
  }

  /** Keyboard users keep their place: focus moves to the next toast, or back where it came from. */
  protected dismiss(id: number): void {
    const index = this.host.toasts().findIndex((toast) => toast.id === id);
    const hadFocus = this.focusInside();
    this.host.dismiss(id);
    if (!hadFocus) return;

    const remaining = this.host.toasts();
    const next = remaining[Math.min(index, remaining.length - 1)];
    const target = next
      ? this.element.querySelector<HTMLElement>(`[data-toast-id="${next.id}"]`)
      : this.returnFocusTo;

    if (target?.isConnected) target.focus();
    else if (this.document.activeElement instanceof HTMLElement) this.document.activeElement.blur();
    this.syncPause(this.focusInside());
  }

  private focusInside(): boolean {
    return this.element.contains(this.document.activeElement);
  }

  private syncPause(focused: boolean): void {
    if (this.hovered || focused) this.host.pause();
    else this.host.resume();
  }
}
