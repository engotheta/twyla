import { ChangeDetectionStrategy, Component } from '@angular/core';
import { applog } from './applog';

/** The demos' "Last action" line — announced politely as it changes. */
@Component({
  selector: 'demo-log',
  template: `
    <p
      class="rounded-lg bg-white px-4 py-2 text-sm text-gray-700 ring-1 ring-gray-200"
      role="status"
    >
      <span class="font-medium text-gray-900">Last action:</span> {{ log() || 'none yet' }}
    </p>
  `,
  host: { class: 'block shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoLogComponent {
  protected readonly log = applog;
}
