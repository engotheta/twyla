import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActionButtonsComponent } from '@components/action-buttons';
import { PageHeaderComponent } from '@layout/page-header';
import { actionButtons } from './buttons.demo';
import { DemoLogComponent } from '../../shared/demo-log.component';

@Component({
  selector: 'buttons-page',
  imports: [PageHeaderComponent, ActionButtonsComponent, DemoLogComponent],
  template: `
    <page-header
      subtitle="Buttons from config — menus, confirmations, file pickers, loading states"
    />
    <demo-log />
    <div class="rounded-xl bg-white p-4 ring-1 ring-gray-200 sm:p-6">
      <action-buttons [buttons]="buttons" />
    </div>
  `,
  host: { class: 'flex flex-col gap-3' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonsPage {
  protected readonly buttons = actionButtons;
}
