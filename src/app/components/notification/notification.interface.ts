export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationOptions {
  /** Ms before it dismisses itself; 0 keeps it until dismissed. Default: per type, see `NotificationConfig`. */
  duration?: number;
}

/** One notification as shown on screen — a toast in the stack. (Not named `Notification`: that
 *  would shadow the DOM's global `Notification` in every file importing it.) */
export interface Toast {
  readonly id: number;
  readonly type: NotificationType;
  readonly message: string;
  /** Resolved auto-dismiss delay in ms; 0 means it stays until dismissed. */
  readonly duration: number;
}

export interface NotificationConfig {
  /** Default auto-dismiss per type, in ms (0 = until dismissed). */
  duration: Record<NotificationType, number>;
  /** Beyond this many visible toasts, the oldest are dropped. */
  maxVisible: number;
}
