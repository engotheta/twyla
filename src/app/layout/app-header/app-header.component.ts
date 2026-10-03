import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadge } from '@angular/material/badge';
import { MatIconButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTooltip } from '@angular/material/tooltip';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
} from '@angular/router';
import { ActionButtonsComponent } from '@components/action-buttons/action-buttons.component';
import { BrandLogoComponent } from '../brand-logo.component';
import { LAYOUT_CONFIG, LayoutNotification } from '../layout-config.token';
import { LayoutService } from '../layout.service';
import { UserMenuComponent } from '../menu/user-menu.component';

/** a navigation shorter than this never shows the progress bar */
const PROGRESS_DELAY = 150;

/**
 * The top bar: the navigation toggle, the brand while the sidebar is hidden, then the configured
 * actions, full screen, notifications and the user menu. A thin bar runs along its bottom edge
 * while a lazy page loads.
 */
@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    MatBadge,
    MatDivider,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressBar,
    MatTooltip,
    ActionButtonsComponent,
    BrandLogoComponent,
    UserMenuComponent,
  ],
  templateUrl: './app-header.component.html',
  host: {
    class: 'block shrink-0',
    '(document:fullscreenchange)': 'syncFullscreen()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly config = inject(LAYOUT_CONFIG);
  private readonly document = inject(DOCUMENT);

  protected readonly notifications = this.config.notifications;
  protected readonly unread = computed(
    () => this.notifications?.().filter((notification) => notification.unread).length ?? 0,
  );

  protected readonly fullscreen = signal(false);
  protected readonly fullscreenSupported = !!this.document.fullscreenEnabled;

  protected readonly loading = signal(false);

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          clearTimeout(timer);
          timer = setTimeout(() => this.loading.set(true), PROGRESS_DELAY);
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
        ) {
          clearTimeout(timer);
          this.loading.set(false);
        }
      });
  }

  protected toggleFullscreen(): void {
    if (this.document.fullscreenElement) void this.document.exitFullscreen();
    else void this.document.documentElement.requestFullscreen();
  }

  protected syncFullscreen(): void {
    this.fullscreen.set(!!this.document.fullscreenElement);
  }

  protected openNotification(notification: LayoutNotification): void {
    this.config.onNotification?.(notification);
  }

  protected markAllRead(): void {
    this.config.markAllRead?.();
  }
}
