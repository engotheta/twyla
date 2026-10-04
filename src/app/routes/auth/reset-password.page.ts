import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { GenericFormComponent } from '@components/generic-form';
import { injectMessages } from '@services/i18n';
import { NotificationService } from '@services/notification';
import { SessionService } from '@services/session';
import { AuthCardComponent } from './auth-card.component';
import { resetPasswordForm, ResetPasswordValue } from './auth.forms';
import { AUTH_MESSAGES } from './auth.messages';
import { PasswordChecklistComponent } from './password-checklist.component';

@Component({
  selector: 'reset-password-page',
  imports: [
    RouterLink,
    MatButton,
    MatIcon,
    GenericFormComponent,
    AuthCardComponent,
    PasswordChecklistComponent,
  ],
  template: `
    <ng-template #checklist>
      <password-checklist class="mb-3" [value]="password()" />
    </ng-template>

    <auth-card [heading]="t().reset.heading" [lead]="token() ? t().reset.lead : ''">
      @if (!token()) {
        <div class="flex flex-col gap-4">
          <div
            class="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200"
          >
            <mat-icon class="shrink-0" aria-hidden="true">link_off</mat-icon>
            <p class="text-sm">{{ t().reset.badLink }}</p>
          </div>
          <a mat-flat-button routerLink="/auth/forgot-password">{{ t().requestNewLink }}</a>
        </div>
      } @else {
        @if (error(); as error) {
          <div
            #alert
            class="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200 focus:outline-2 focus:outline-red-700"
            role="alert"
            tabindex="-1"
          >
            <mat-icon class="shrink-0" aria-hidden="true">error</mat-icon>
            <span>
              {{ error }}
              <a class="font-medium underline" routerLink="/auth/forgot-password">{{
                t().requestNewLink
              }}</a>
            </span>
          </div>
        }
        <generic-form [params]="params()" />
      }
    </auth-card>
  `,
  host: { class: 'flex flex-1 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly t = injectMessages(AUTH_MESSAGES);
  private readonly alert = viewChild<ElementRef<HTMLElement>>('alert');
  private readonly checklist = viewChild.required<TemplateRef<unknown>>('checklist');

  /** from the emailed link: `/auth/reset-password?token=…` */
  readonly token = input<string>();

  /** what the last attempt failed with… */
  private readonly failure = signal<{ error: unknown } | null>(null);
  /** …in the user's language, which it follows */
  protected readonly error = computed(() => {
    const failure = this.failure();
    return failure && this.session.errorMessage(failure.error);
  });
  protected readonly password = signal('');

  /** with the checklist template from this page's view; built again when the language changes,
   *  and the form keeps what was typed */
  protected readonly params = computed(() =>
    resetPasswordForm(
      this.t,
      (value) => this.reset(value),
      this.checklist(),
      (password) => this.password.set(password),
    ),
  );

  private async reset({ password }: ResetPasswordValue): Promise<void> {
    this.failure.set(null);
    try {
      await this.session.resetPassword({ token: this.token() ?? '', password });
      this.notifications.success(this.t().reset.done);
      await this.router.navigateByUrl('/auth/login');
    } catch (error) {
      this.failure.set({ error });
      afterNextRender(() => this.alert()?.nativeElement.focus(), { injector: this.injector });
    }
  }
}
