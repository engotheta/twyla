import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { injectMessages } from '@services/i18n/message-bundle';
import { ViewService } from '@services/view/view.service';
import { SETTINGS_MESSAGES } from './settings.messages';

/**
 * The header's settings button. It opens the settings panel as a sheet at the edge of the
 * window: a dialog (focus trapped, Esc closes, focus back on the button) over a clear backdrop,
 * so each change shows on the page behind it. The panel loads on the first click.
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
      const { SettingsPanelComponent } = await import('./settings-panel/settings-panel.component');
      this.view.open(SettingsPanelComponent, {
        // read as the sheet renders: the title follows a change of language made inside it
        title: () => this.t().title,
        icon: 'settings',
        position: { top: '0', right: '0' },
        height: '100%',
        maxHeight: '100vh',
        width: '26rem',
        maxWidth: '100vw',
        panelClass: 'settings-sheet',
        backdropClass: 'cdk-overlay-transparent-backdrop',
      });
    } finally {
      this.opening = false;
    }
  }
}
