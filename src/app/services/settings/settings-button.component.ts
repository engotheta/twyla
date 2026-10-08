import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { injectMessages } from '@services/i18n/message-bundle';
import { ViewService } from '@services/view/view.service';
import { openSettingsSheet } from './settings-sheet';
import { SETTINGS_MESSAGES } from './settings.messages';

/**
 * The header's settings button. It opens the settings panel as a sheet at the edge of the
 * window (`openSettingsSheet`); the panel loads on the first click.
 */
@Component({
  selector: 'settings-button',
  imports: [MatIconButton, MatIcon, MatTooltip],
  template: `
    <button
      mat-icon-button
      type="button"
      aria-haspopup="dialog"
      [attr.aria-label]="t().title"
      [matTooltip]="t().title"
      (click)="open()"
    >
      <mat-icon aria-hidden="true">settings</mat-icon>
    </button>
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsButtonComponent {
  private readonly view = inject(ViewService);
  protected readonly t = injectMessages(SETTINGS_MESSAGES);

  private opening = false;

  protected async open(): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    try {
      await openSettingsSheet(this.view, () => this.t().title);
    } finally {
      this.opening = false;
    }
  }
}
