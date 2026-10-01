export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  /** Ms before it dismisses itself; 0 keeps it until dismissed. Default: per type, see `ToastConfig`. */
  duration?: number;
}

export interface Toast {
  readonly id: number;
  readonly type: ToastType;
  readonly message: string;
  /** Resolved auto-dismiss delay in ms; 0 means it stays until dismissed. */
  readonly duration: number;
}

export interface ToastConfig {
  /** Default auto-dismiss per type, in ms (0 = until dismissed). */
  duration: Record<ToastType, number>;
  /** Beyond this many visible toasts, the oldest are dropped. */
  maxVisible: number;
}
