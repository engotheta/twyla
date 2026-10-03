import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ActionButton } from '@components/action-buttons';
import { PageHeaderComponent, PageHeaderParameter, PageHeaderToggle } from '@layout/page-header';
import { applog } from '../shared/applog';
import { DemoLogComponent } from '../shared/demo-log.component';

const ACTIONS: ActionButton[] = [
  { label: 'New user', icon: 'person_add', click: () => applog.set('New user clicked') },
  { label: 'Export', icon: 'download', click: () => applog.set('Export clicked') },
];

const VIEWS: PageHeaderToggle<string>[] = [
  { label: 'List', value: 'list', icon: 'view_list' },
  { label: 'Board', value: 'board', icon: 'view_kanban' },
  { label: 'Calendar', value: 'calendar', icon: 'calendar_month' },
];

/** The page header's options, one example each (examples use `<h2>`; the page's own is the `<h1>`). */
@Component({
  selector: 'page-header-page',
  imports: [PageHeaderComponent, DemoLogComponent],
  template: `
    <page-header
      subtitle="Title, breadcrumbs, Back, icon, toggles, actions and projected controls"
    />
    <demo-log />

    <p class="mt-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
      Back button, icon and an explicit trail (nav)
    </p>
    <page-header [params]="detail" />

    <p class="mt-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">Action buttons</p>
    <page-header
      title="Users"
      subtitle="128 people in 6 teams"
      [headingLevel]="2"
      [showBreadcrumb]="false"
      [actionButtons]="actions"
    />

    <p class="mt-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
      Toggle buttons — picked: {{ view() }}
    </p>
    <page-header
      title="Tasks"
      toggleLabel="Task view"
      [headingLevel]="2"
      [showBreadcrumb]="false"
      [toggleButtons]="views"
      [value]="view()"
      (toggleValue)="pickView($event)"
    />

    <p class="mt-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
      Projected controls (filters, search)
    </p>
    <page-header title="Reports" [headingLevel]="2" [showBreadcrumb]="false">
      <label class="relative block">
        <span class="sr-only">Search reports</span>
        <input
          type="search"
          placeholder="Search reports"
          class="h-10 w-56 rounded-lg border border-gray-300 px-3 text-sm placeholder:text-gray-500 focus:border-primary focus:outline-2 focus:outline-primary/30"
        />
      </label>
    </page-header>
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderPage {
  protected readonly detail: PageHeaderParameter = {
    title: 'Invoice #1042',
    subtitle: 'Issued 2 Oct 2026 · due in 14 days',
    icon: 'receipt_long',
    headingLevel: 2,
    showBackBtn: true,
    goBackUrl: '/layout/levels/one',
    nav: [{ label: 'Billing', route: '/layout/levels/one' }, 'Invoices', 'Invoice #1042'],
  };
  protected readonly actions = ACTIONS;
  protected readonly views = VIEWS;
  protected readonly view = signal('list');

  protected pickView(value: unknown): void {
    this.view.set(String(value));
    applog.set(`View switched to ${String(value)}`);
  }
}
