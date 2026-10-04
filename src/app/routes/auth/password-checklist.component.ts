import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { FORM_MESSAGES, passwordChecks, PasswordRules } from '@components/generic-form';
import { injectMessages } from '@services/i18n';
import { AUTH_MESSAGES } from './auth.messages';

/**
 * The password rules, ticked off as they're met — sits under a new-password field. Not a live
 * region (it would chatter on every key); the field's own error message carries the rules.
 */
@Component({
  selector: 'password-checklist',
  imports: [MatIcon],
  template: `
    <ul class="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2" [attr.aria-label]="t().checklist.label">
      @for (check of checks(); track check.key) {
        <li
          class="flex items-center gap-1.5"
          [class]="check.met ? 'text-emerald-700' : 'text-gray-600'"
        >
          <mat-icon class="size-4! shrink-0 text-base! leading-4!" aria-hidden="true">
            {{ check.met ? 'check_circle' : 'radio_button_unchecked' }}
          </mat-icon>
          <span>
            {{ check.label
            }}<span class="sr-only">
              {{ check.met ? t().checklist.met : t().checklist.unmet }}</span
            >
          </span>
        </li>
      }
    </ul>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordChecklistComponent {
  readonly value = input<unknown>('');
  readonly rules = input<Partial<PasswordRules>>({});

  protected readonly t = injectMessages(AUTH_MESSAGES);
  /** the rules are the form's own text: the same words its error message uses */
  private readonly formText = injectMessages(FORM_MESSAGES);

  protected readonly checks = computed(() =>
    passwordChecks(this.value(), this.rules(), this.formText().password),
  );
}
