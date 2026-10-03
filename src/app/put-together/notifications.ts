import { signal } from '@angular/core';
import type { LayoutNotification } from '../layout/layout-config.token';

/** The header bell's demo items; "Mark all as read" and opening one clear their dots. */
export const demoNotifications = signal<readonly LayoutNotification[]>([
  {
    id: 1,
    icon: 'person_add',
    title: 'New user registered',
    text: 'Sophia Brown joined the Viewers team.',
    time: '5 min ago',
    unread: true,
  },
  {
    id: 2,
    icon: 'task_alt',
    title: 'Export finished',
    text: 'employees.xlsx is ready to download.',
    time: '1 h ago',
    unread: true,
  },
  {
    id: 3,
    icon: 'update',
    title: 'Scheduled maintenance',
    text: 'Saturday, 02:00–03:00.',
    time: 'Yesterday',
  },
]);

export function markNotificationRead(notification: LayoutNotification): void {
  demoNotifications.update((items) =>
    items.map((item) => (item.id === notification.id ? { ...item, unread: false } : item)),
  );
}

export function markAllNotificationsRead(): void {
  demoNotifications.update((items) => items.map((item) => ({ ...item, unread: false })));
}
