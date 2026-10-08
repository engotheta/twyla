import { ViewService } from '@services/view/view.service';

/**
 * Opens the settings panel as a sheet at the edge of the window: a dialog (focus trapped, Esc
 * closes, focus back where it was) over a clear backdrop, so each change shows on the page behind
 * it. The panel loads the first time. `title` is read as the sheet renders: it follows a change
 * of language made inside it.
 */
export async function openSettingsSheet(view: ViewService, title: () => string): Promise<void> {
  const { SettingsPanelComponent } = await import('./settings-panel/settings-panel.component');
  view.open(SettingsPanelComponent, {
    title,
    icon: 'settings',
    position: { top: '0', right: '0' },
    height: '100%',
    maxHeight: '100vh',
    width: '26rem',
    maxWidth: '100vw',
    panelClass: 'settings-sheet',
    backdropClass: 'cdk-overlay-transparent-backdrop',
  });
}
