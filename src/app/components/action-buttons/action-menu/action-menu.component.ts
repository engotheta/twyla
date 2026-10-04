import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { combineLatest, map, merge, of, switchMap } from 'rxjs';
import { injectMessages } from '@services/i18n/message-bundle';
import { ViewService } from '@services/view';
import { ActionAvatarComponent } from '../action-avatar.component';
import {
  acceptAttribute,
  actionButtonViewModel$,
  ActionButtonViewModel,
  displayLabel,
  DividedEntry,
  isFileButton,
  reportFiles,
  tidyDividers,
} from '../action-button.helpers';
import { ActionButton } from '../action-button.interface';
import { ACTION_BUTTONS_MESSAGES } from '../action-buttons.messages';

/** one entry of the menu — a child button, the data it acts on and its resolved props — or a
 *  divider between two groups of them */
interface ActionMenuItem<D> extends DividedEntry {
  button: ActionButton<D>;
  data: D;
  vm: ActionButtonViewModel;
}

let nextId = 0;

/**
 * An action button's child buttons, as a real menu: each child is a `mat-menu-item`, so arrow
 * keys, Home / End, type-ahead, Esc and the return of focus all come from Material, and a child
 * with children of its own opens a submenu (this same component, to any depth).
 *
 * A row keeps what a button does — `click`, a confirmation first, a file picker, `disabled`,
 * `visible`, `loading`, a tooltip — but not how a button looks: a child's `type` (`fab`,
 * `icon`, …) has no meaning in a menu. A child with a `link` is a real link; one that is a
 * `divider` is a line between two groups, and with a label the heading of the group below.
 *
 * What the parent's `menuConfig` says arrives as `title` and `subtitle` (a heading on top, which
 * also names the menu), `xPosition`, and `panelClass` (with its `childrenHolderClass`).
 *
 * The trigger lives with whoever opens it: `[matMenuTriggerFor]="children.menu()"`.
 */
@Component({
  selector: 'action-menu',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatDivider,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressSpinner,
    MatTooltip,
    ActionAvatarComponent,
    ActionMenuComponent,
  ],
  templateUrl: './action-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionMenuComponent<D = unknown> {
  readonly buttons = input.required<ActionButton<D>[]>();
  /** what the buttons act on, unless a button carries `data` of its own */
  readonly data = input<D>();
  readonly panelClass = input<string>();
  /** a heading on top of the menu, and a smaller line under it */
  readonly title = input<string>();
  readonly subtitle = input<string>();
  /** which way the menu opens from its trigger */
  readonly xPosition = input<'before' | 'after'>('after');

  readonly menu = viewChild.required(MatMenu);

  /** the heading's id: the menu is labelled by it */
  protected readonly headingId = `action-menu-${nextId++}-title`;

  private readonly view = inject(ViewService);
  private readonly document = inject(DOCUMENT);
  private readonly t = injectMessages(ACTION_BUTTONS_MESSAGES);

  protected readonly items = toSignal(
    combineLatest([toObservable(this.buttons), toObservable(this.data)]).pipe(
      switchMap(([buttons, data]) => {
        const items = buttons.map((button) => {
          const own = (button.data ?? data) as D;
          return actionButtonViewModel$(button, own).pipe(
            map((vm): ActionMenuItem<D> => ({
              button,
              data: own,
              vm,
              divider: button.divider === true,
              visible: vm.visible,
              heading: button.divider === true && !!vm.label,
            })),
          );
        });
        return items.length ? combineLatest(items) : of([]);
      }),
    ),
    { initialValue: [] as ActionMenuItem<D>[] },
  );

  /** what shows: the visible entries, and only the dividers with something to divide */
  protected readonly rows = computed(() => tidyDividers(this.items()));

  /** the files each file item last picked: its label, until `removeFile$` clears them */
  private readonly picked = signal<ReadonlyMap<ActionButton<D>, string[]>>(new Map());

  constructor() {
    toObservable(this.items)
      .pipe(
        switchMap((items) =>
          merge(
            ...items.map(
              (item) => item.vm.fileConfig?.removeFile$?.pipe(map(() => item.button)) ?? of(),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((button) => this.setPicked(button, []));
  }

  /** a row always says something: its label, else its tooltip (an icon-only button's name) */
  protected label(item: ActionMenuItem<D>): string {
    const names = this.picked().get(item.button) ?? [];
    return displayLabel(item.button, item.vm, names) || item.vm.tooltip || this.t().action;
  }

  /** a link item is followed by the router; its own `click`, if it has one, runs as it goes */
  protected follow(item: ActionMenuItem<D>): void {
    if (!item.vm.disabled && !item.vm.loading) item.button.click?.(item.data);
  }

  /** what a click on the button would do: its file picker, its confirmation, then `click` */
  protected run(item: ActionMenuItem<D>): void {
    const { button, vm, data } = item;
    if (vm.disabled || vm.loading) return;

    if (isFileButton(button)) {
      this.pickFiles(item);
      return;
    }

    if (vm.confirmMessage || vm.confirmConfig) {
      const config = {
        ...vm.confirmConfig,
        message: vm.confirmConfig?.message ?? vm.confirmMessage,
      };
      void this.view.confirm(config).then((ok) => ok && button.click?.(data));
      return;
    }

    button.click?.(data);
  }

  /**
   * The menu closes on the click that picks, taking its panel out of the page — so the file
   * input can't live in it. One is made for the occasion, beside the page (inside the full-screen
   * element, when there is one: everything outside that is inert), and removed once the picker
   * closes.
   */
  private pickFiles(item: ActionMenuItem<D>): void {
    const { button, vm } = item;
    const input = this.document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    input.multiple = vm.fileConfig?.multiple ?? false;
    const accept = acceptAttribute(vm.fileConfig?.extensions);
    if (accept) input.accept = accept;

    input.addEventListener('change', (event) => {
      if (input.files?.length) {
        const names = reportFiles(button, vm.fileConfig, input.files, event);
        if (vm.fileConfig?.updateLabel ?? true) this.setPicked(button, names);
      }
      input.remove();
    });
    input.addEventListener('cancel', () => input.remove());

    (this.document.fullscreenElement ?? this.document.body).appendChild(input);
    input.click();
  }

  private setPicked(button: ActionButton<D>, names: string[]): void {
    this.picked.update((picked) => {
      const next = new Map(picked);
      if (names.length) next.set(button, names);
      else next.delete(button);
      return next;
    });
  }
}
