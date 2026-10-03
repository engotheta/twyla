import { ActionButton } from '../../components/action-buttons/action-button.interface';

export interface Breadcrumb {
  label: string;
  /** a link; the last crumb (the current page) never is one */
  route?: string;
}

export interface PageHeaderToggle<V = unknown> {
  label: string;
  value: V;
  icon?: string;
  disabled?: boolean;
}

/** GASCO's `HeaderParameter`, typed. Every prop is also an input of `<page-header>`. */
export interface PageHeaderParameter<D = unknown> {
  /** default: the page's menu name / route title */
  title?: string;
  subtitle?: string;
  icon?: string;
  /** the breadcrumb trail; default: module › menu groups › page, from the side menu */
  nav?: (string | Breadcrumb)[];
  /** default true (shown when the trail has more than the page itself) */
  showBreadcrumb?: boolean;
  /** default false */
  showBackBtn?: boolean;
  /** Back always goes here; without it, Back returns to the previous in-app page */
  goBackUrl?: string;
  /** passed to the action buttons' callbacks */
  data?: D;
  actionButtons?: ActionButton<D>[];
  /** a segmented switch (list / board, week / month…) — `toggleValue` emits the picked value */
  toggleButtons?: PageHeaderToggle[];
  /** the selected toggle */
  value?: unknown;
  /** the toggle group's name for screen readers; default 'View' */
  toggleLabel?: string;
  /** 1 (default): the page's `<h1>`; 2 for a header inside a page section or dialog */
  headingLevel?: 1 | 2;
  /** extra classes for the header's box */
  class?: string;
}
