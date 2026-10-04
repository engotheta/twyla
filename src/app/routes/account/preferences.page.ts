import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@layout/page-header';
import { injectMessages } from '@services/i18n';
import { SettingsPanelComponent } from '@services/settings';
import { ACCOUNT_MESSAGES } from './account.messages';

/** The person's settings as a page: the same panel the header's settings button opens. */
@Component({
  selector: 'preferences-page',
  imports: [PageHeaderComponent, SettingsPanelComponent],
  template: `
    <page-header [subtitle]="t().preferences.subtitle" />
    <div class="max-w-3xl rounded-xl bg-white p-6 ring-1 ring-gray-200">
      <settings-panel [headingLevel]="2" />
    </div>
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreferencesPage {
  protected readonly t = injectMessages(ACCOUNT_MESSAGES);
}
