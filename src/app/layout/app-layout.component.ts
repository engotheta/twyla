import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AppFooterComponent } from './app-footer.component';
import { AppHeaderComponent } from './app-header/app-header.component';
import { AppSidebarComponent } from './app-sidebar/app-sidebar.component';
import { LayoutService } from './layout.service';
import { ModuleRailComponent } from './menu/module-rail.component';

/**
 * The signed-in layout (GASCO's admin layout), rendered by each module's shell: the module rail
 * (from `lg` up), the sidebar — docked from `lg`, a drawer below — then the header, the page and
 * the footer. A route with `data: { fullHeight: true }` gets a fixed-height page area for pages
 * that scroll inside themselves.
 */
@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    ModuleRailComponent,
    AppSidebarComponent,
    AppHeaderComponent,
    AppFooterComponent,
  ],
  template: `
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[1100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:shadow-lg focus:outline-2 focus:outline-primary"
      (click)="skipToMain($event)"
    >
      Skip to main content
    </a>

    <div class="flex h-full">
      @if (layout.large()) {
        <module-rail class="shrink-0" />
      }

      <mat-sidenav-container class="h-full min-w-0 flex-1">
        <mat-sidenav
          id="app-sidebar"
          class="w-[17rem] border-e border-gray-200 [--mat-sidenav-container-shape:0]"
          [mode]="layout.large() ? 'side' : 'over'"
          [opened]="layout.sidebarVisible()"
          (openedChange)="layout.sidebarChanged($event)"
        >
          <app-sidebar
            [switcher]="!layout.large()"
            [closable]="!layout.large()"
            (closed)="layout.closeDrawer()"
          />
        </mat-sidenav>

        <mat-sidenav-content
          class="flex! flex-col bg-gray-100"
          [class.overflow-hidden!]="fullHeight()"
        >
          <app-header class="sticky top-0 z-20" />
          <main
            #main
            id="main-content"
            tabindex="-1"
            class="flex flex-1 flex-col p-3 focus:outline-none sm:p-4 lg:p-6"
            [class.min-h-0]="fullHeight()"
          >
            <router-outlet />
          </main>
          <app-footer class="border-t border-gray-200" />
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayoutComponent {
  protected readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly announcer = inject(LiveAnnouncer);

  private readonly content = viewChild(MatSidenavContent);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  private readonly navigated$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
  );

  protected readonly fullHeight = toSignal(this.navigated$.pipe(map(() => this.isFullHeight())), {
    initialValue: this.isFullHeight(),
  });

  constructor() {
    const injector = inject(Injector);
    this.navigated$.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.layout.closeDrawer();
      const scroller = this.content()?.getElementRef().nativeElement;
      if (scroller) scroller.scrollTop = 0;
      // the title strategy has set the new title by now; the very first load is announced by the
      // browser itself
      if (event.id > 1) {
        afterNextRender(() => void this.announcer.announce(this.title.getTitle(), 'polite'), {
          injector,
        });
      }
    });
  }

  /** the skip link's target is in this document, not at `<base href>` + '#main-content' */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  /** the deepest route that says so wins */
  private isFullHeight(): boolean {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let fullHeight = false;
    while (route) {
      const value: unknown = route.data['fullHeight'];
      if (value !== undefined) fullHeight = value === true;
      route = route.firstChild;
    }
    return fullHeight;
  }
}
