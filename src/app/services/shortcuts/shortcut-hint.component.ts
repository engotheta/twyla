import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { injectMessages } from '@services/i18n/message-bundle';
import { HELP_KEY, KEY_CAP_CLASS, keyCap } from './shortcuts.helpers';
import { SHORTCUTS_MESSAGES } from './shortcuts.messages';
import { ShortcutsService } from './shortcuts.service';

/**
 * What `ShortcutsService` shows while a scope is armed: its keys and where each stands, bottom-end
 * of the window, and a ring around the component they act on. It is only looked at — the keys go
 * to the page, nothing in it takes focus, and what it says the service announces — so it is
 * hidden from assistive technology rather than read twice. The panel is the list that can be
 * operated.
 */
@Component({
  selector: 'shortcut-hint',
  template: `
    <!-- the ring around what the keys act on: here, in the hint's own layer, it is above
         everything and nothing clips it -->
    @if (service.targetBox(); as box) {
      <div
        class="pointer-events-none fixed rounded-sm border-2 border-primary"
        aria-hidden="true"
        [style.left.px]="box.left"
        [style.top.px]="box.top"
        [style.width.px]="box.width"
        [style.height.px]="box.height"
      ></div>
    }

    @if (service.hint(); as hint) {
      <div
        class="surface-glass w-80 max-w-[calc(100vw-2rem)] border border-gray-200 p-3 text-sm text-gray-900"
        aria-hidden="true"
      >
        <p class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 truncate font-semibold">{{ hint.title }}</span>
          @if (hint.position; as position) {
            <span class="shrink-0 text-xs text-gray-700">{{
              t().hint.position(position.index, position.count)
            }}</span>
          }
        </p>

        <ul class="mt-2 flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          @for (row of hint.shortcuts; track row.id) {
            <li class="flex items-center gap-2">
              <kbd [class]="cap">{{ keyCap(row.key) }}</kbd>
              <span class="min-w-0 flex-1 truncate">{{ row.label }}</span>
              @if (row.state) {
                <span class="shrink-0 text-xs text-gray-700">{{ row.state }}</span>
              }
            </li>
          }
        </ul>

        @if (hint.said) {
          <p class="mt-2 truncate border-t border-gray-200 pt-2 font-medium">{{ hint.said }}</p>
        }

        <p
          class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-200 pt-2 text-xs text-gray-700"
        >
          @if (hint.position) {
            <span class="inline-flex items-center gap-1">
              <kbd [class]="cap">{{ keyCap(hint.key) }}</kbd> {{ t().hint.next }}
            </span>
          }
          <span class="inline-flex items-center gap-1">
            <kbd [class]="cap">{{ helpKey }}</kbd> {{ t().hint.all }}
          </span>
          <span class="inline-flex items-center gap-1">
            <kbd [class]="cap">{{ t().keys.escape }}</kbd> {{ t().hint.close }}
          </span>
        </p>
      </div>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShortcutHintComponent {
  protected readonly service = inject(ShortcutsService);
  protected readonly t = injectMessages(SHORTCUTS_MESSAGES);

  protected readonly keyCap = keyCap;
  protected readonly helpKey = HELP_KEY;
  protected readonly cap = KEY_CAP_CLASS;
}
