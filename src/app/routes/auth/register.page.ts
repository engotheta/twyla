import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { GenericFormComponent } from '@components/generic-form';
import { injectMessages } from '@services/i18n';
import { NotificationService } from '@services/notification';
import { SESSION_CONFIG, SessionService } from '@services/session';
import { AuthCardComponent } from './auth-card.component';
import { registerForm, RegisterValue } from './auth.forms';
import { AUTH_MESSAGES } from './auth.messages';
import { PasswordChecklistComponent } from './password-checklist.component';

@Component({
  selector: 'register-page',
  imports: [
    RouterLink,
    MatIcon,
    GenericFormComponent,
    AuthCardComponent,
    PasswordChecklistComponent,
  ],
  template: `
    <ng-template #checklist>
      <password-checklist class="mb-3" [value]="password()" />
    </ng-template>

    <auth-card [heading]="t().register.heading" [lead]="t().register.lead">
      @if (error(); as error) {
        <div
          #alert
          class="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200 focus:outline-2 focus:outline-red-700"
          role="alert"
          tabindex="-1"
        >
          <mat-icon class="shrink-0" aria-hidden="true">error</mat-icon>
          <span>{{ error }}</span>
        </div>
      }

      @if (demo) {
        <p class="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {{ t().register.demoNote }}
        </p>
      }

      <generic-form [params]="params()" />

      <p class="mt-6 text-center text-sm text-gray-600">
        {{ t().register.haveAccount }}
        <a
          class="font-medium text-blue-700 underline-offset-2 hover:underline"
          routerLink="/auth/login"
        >
          {{ t().register.signIn }}
        </a>
      </p>
    </auth-card>
  `,
  host: { class: 'flex flex-1 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly t = injectMessages(AUTH_MESSAGES);
  private readonly alert = viewChild<ElementRef<HTMLElement>>('alert');
  private readonly checklist = viewChild.required<TemplateRef<unknown>>('checklist');

  protected readonly demo = inject(SESSION_CONFIG).demoCredentials;
  /** what the last attempt failed with… */
  private readonly failure = signal<{ error: unknown } | null>(null);
  /** …in the user's language, which it follows */
  protected readonly error = computed(() => {
    const failure = this.failure();
    return failure && this.session.errorMessage(failure.error);
  });
  /** feeds the checklist as the password is typed */
  protected readonly password = signal('');

  /** with the checklist template from this page's view; built again when the language changes,
   *  and the form keeps what was typed */
  protected readonly params = computed(() =>
    registerForm(
      this.t,
      (value) => this.register(value),
      this.checklist(),
      (password) => this.password.set(password),
    ),
  );

  private async register(value: RegisterValue): Promise<void> {
    this.failure.set(null);
    try {
      await this.session.register({ ...value });
      this.notifications.success(this.t().register.ready);
      await this.router.navigateByUrl('/auth/login');
    } catch (error) {
      this.failure.set({ error });
      afterNextRender(() => this.alert()?.nativeElement.focus(), { injector: this.injector });
    }
  }
}
