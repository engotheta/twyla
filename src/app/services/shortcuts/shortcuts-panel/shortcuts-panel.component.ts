import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { injectMessages } from '@services/i18n/message-bundle';
import { KEY_CAP_CLASS, keyCap } from '../shortcuts.helpers';
import { ShortcutRow, ShortcutTarget } from '../shortcuts.interface';
import { SHORTCUTS_MESSAGES } from '../shortcuts.messages';
import { ShortcutsService } from '../shortcuts.service';

let nextId = 0;

/**
 * Every shortcut of what could be reached when the panel was asked for, by scope, each of them a
 * button: the way to them without a keyboard, and the place to look a key up. Opened by
 * `ShortcutsService.openPanel()`, in a `ViewService` dialog that gives it its title.
 *
 * A row shows where its shortcut stands (on / off, a value) and follows it as it changes; the
 * panel stays open, so several can be run in a row. One that opens something of its own closes
 * the panel first.
 */
@Component({
  selector: 'shortcuts-panel',
  templateUrl: './shortcuts-panel.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortcutsPanelComponent {
  /** what could be reached as the panel was opened — taken then, before its own dialog was in
   *  the way */
  readonly targets = input<readonly ShortcutTarget[]>([]);
  /** set by `ViewService` on what it hosts */
  readonly dialogRef = input<MatDialogRef<unknown>>();

  private readonly service = inject(ShortcutsService);
  protected readonly t = injectMessages(SHORTCUTS_MESSAGES);

  protected readonly presses = this.service.presses;
  protected readonly keyCap = keyCap;
  protected readonly cap = KEY_CAP_CLASS;
  /** keeps this panel's ids apart from another's */
  protected readonly id = `shortcuts-${nextId++}`;

  protected readonly groups = computed(() =>
    this.targets()
      .map((target) => ({ target, ...this.service.describe(target) }))
      .filter((group) => group.shortcuts.length > 0),
  );

  /** a row's button, as a screen reader names it: "Paginator: on, key P" — what it shows, in
   *  one phrase instead of three words run together */
  protected name(row: ShortcutRow): string {
    const text = this.t();
    const shortcut = row.state ? text.result(row.label, row.state) : row.label;
    return text.panel.row(shortcut, keyCap(row.key));
  }

  protected run(target: ShortcutTarget, id: string): void {
    if (this.service.runRow(target, id)) this.dialogRef()?.close();
  }
}
