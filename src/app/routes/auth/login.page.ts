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
import { FormInstance, GenericFormComponent } from '@components/generic-form';
import { injectMessages } from '@services/i18n';
import { safeReturnUrl, SESSION_CONFIG, SessionService } from '@services/session';
import { AuthCardComponent } from './auth-card.component';
import { loginForm, LoginValue } from './auth.forms';
import { AUTH_MESSAGES } from './auth.messages';

@Component({
  selector: 'login-page',
  imports: [RouterLink, MatButton, MatIcon, GenericFormComponent, AuthCardComponent],
  template: `
    <ng-template #forgotLink>
      <p class="-mt-3 mb-2 text-end text-sm">
        <a
          class="font-medium text-blue-700 underline-offset-2 hover:underline"
          routerLink="/auth/forgot-password"
        >
          {{ t().login.forgot }}
        </a>
      </p>
    </ng-template>

    <auth-card [heading]="t().login.heading" [lead]="t().login.lead">
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
        <div
          class="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 ring-1 ring-blue-200"
        >
          <p>
            {{ t().login.demoAccount }} <strong>{{ demo.username }}</strong> /
            <strong>{{ demo.password }}</strong>
          </p>
          <button mat-stroked-button type="button" (click)="useDemoAccount()">
            {{ t().login.useDemo }}
          </button>
        </div>
      }

      <generic-form [params]="params()" (instanceChange)="form = $event" />

      <p class="mt-6 text-center text-sm text-gray-600">
        {{ t().login.newHere }}
        <a
          class="font-medium text-blue-700 underline-offset-2 hover:underline"
          routerLink="/auth/register"
        >
          {{ t().login.createAccount }}
        </a>
      </p>
    </auth-card>
  `,
  host: { class: 'flex flex-1 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly session = inject(SessionService);
  private readonly config = inject(SESSION_CONFIG);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly t = injectMessages(AUTH_MESSAGES);
  private readonly alert = viewChild<ElementRef<HTMLElement>>('alert');
  private readonly forgotLink = viewChild.required<TemplateRef<unknown>>('forgotLink');

  /** where to go once signed in — set by `authGuard`; in-app paths only */
  readonly returnUrl = input<string>();

  protected readonly demo = this.config.demoCredentials;
  /** what the last attempt failed with… */
  private readonly failure = signal<{ error: unknown } | null>(null);
  /** …in the user's language, which it follows */
  protected readonly error = computed(() => {
    const failure = this.failure();
    return failure && this.session.errorMessage(failure.error);
  });
  protected form?: FormInstance;

  /** with the "Forgot password?" template from this page's view; built again when the language
   *  changes, and the form keeps what was typed */
  protected readonly params = computed(() =>
    loginForm(this.t, (value) => this.signIn(value), this.forgotLink()),
  );

  protected useDemoAccount(): void {
    if (this.demo) this.form?.form.patchValue(this.demo);
  }

  private async signIn({ username, password, remember }: LoginValue): Promise<void> {
    this.failure.set(null);
    try {
      await this.session.login({ username: username.trim(), password }, remember);
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? this.config.homeUrl);
    } catch (error) {
      this.failure.set({ error });
      // take the user to the message, which says what to fix
      afterNextRender(() => this.alert()?.nativeElement.focus(), { injector: this.injector });
    }
  }
}
