import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { GenericFormComponent } from '@components/generic-form';
import { injectMessages } from '@services/i18n';
import { SessionService } from '@services/session';
import { AuthCardComponent } from './auth-card.component';
import { forgotPasswordForm, ForgotPasswordValue } from './auth.forms';
import { AUTH_MESSAGES } from './auth.messages';

/** seconds before the link can be sent again */
const RESEND_AFTER = 30;

@Component({
  selector: 'forgot-password-page',
  imports: [RouterLink, MatButton, MatIcon, GenericFormComponent, AuthCardComponent],
  template: `
    <auth-card [heading]="t().forgot.heading" [lead]="sentTo() ? '' : t().forgot.lead">
      @if (sentTo(); as email) {
        <div class="flex flex-col gap-4">
          <div
            class="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200"
          >
            <mat-icon class="shrink-0" aria-hidden="true">mark_email_read</mat-icon>
            <div>
              <h2 #sentHeading class="font-semibold focus:outline-none" tabindex="-1">
                {{ t().forgot.sentHeading }}
              </h2>
              @let sent = sentParts();
              <p class="mt-1 text-sm">
                {{ sent.before }}<strong>{{ email }}</strong
                >{{ sent.after }}
              </p>
            </div>
          </div>

          @if (demoLink(); as link) {
            <a mat-stroked-button [routerLink]="link">
              <mat-icon aria-hidden="true">science</mat-icon>
              {{ t().forgot.demoLink }}
            </a>
          }

          <button mat-button type="button" [disabled]="cooldown() > 0" (click)="resend()">
            {{ cooldown() > 0 ? t().forgot.resendIn(cooldown()) : t().forgot.resend }}
          </button>
          <a mat-flat-button routerLink="/auth/login">{{ t().backToSignIn }}</a>
        </div>
      } @else {
        @if (error(); as error) {
          <div
            class="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200"
            role="alert"
          >
            <mat-icon class="shrink-0" aria-hidden="true">error</mat-icon>
            <span>{{ error }}</span>
          </div>
        }
        <generic-form [params]="params()" />
        <p class="mt-6 text-center text-sm">
          <a
            class="font-medium text-blue-700 underline-offset-2 hover:underline"
            routerLink="/auth/login"
          >
            {{ t().backToSignIn }}
          </a>
        </p>
      }
    </auth-card>
  `,
  host: { class: 'flex flex-1 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly t = injectMessages(AUTH_MESSAGES);
  private readonly sentHeading = viewChild<ElementRef<HTMLElement>>('sentHeading');

  /** built again when the language changes: the form keeps what was typed */
  protected readonly params = computed(() =>
    forgotPasswordForm(this.t, (value) => this.send(value)),
  );
  /** what the last attempt failed with… */
  private readonly failure = signal<{ error: unknown } | null>(null);
  /** …in the user's language, which it follows */
  protected readonly error = computed(() => {
    const failure = this.failure();
    return failure && this.session.errorMessage(failure.error);
  });
  /** set once the request went through — the form gives way to "Check your email" */
  protected readonly sentTo = signal<string | null>(null);
  /** the "sent" sentence on either side of the address, which is shown in bold */
  protected readonly sentParts = computed(() => {
    const [before, after = ''] = this.t().forgot.sent.split('{email}');
    return { before, after };
  });
  private readonly demoResetUrl = signal<string | undefined>(undefined);
  protected readonly demoLink = computed(() => {
    const url = this.demoResetUrl();
    return url ? this.router.parseUrl(url) : undefined;
  });
  protected readonly cooldown = signal(0);

  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected async resend(): Promise<void> {
    const email = this.sentTo();
    if (email && this.cooldown() === 0) await this.send({ email });
  }

  private async send({ email }: ForgotPasswordValue): Promise<void> {
    this.failure.set(null);
    try {
      const result = await this.session.forgotPassword({ email: email.trim() });
      const firstTime = !this.sentTo();
      this.sentTo.set(email.trim());
      this.demoResetUrl.set(result.demoResetUrl);
      this.startCooldown();
      if (firstTime) {
        afterNextRender(() => this.sentHeading()?.nativeElement.focus(), {
          injector: this.injector,
        });
      }
    } catch (error) {
      this.failure.set({ error });
    }
  }

  private startCooldown(): void {
    clearInterval(this.timer);
    this.cooldown.set(RESEND_AFTER);
    this.timer = setInterval(() => {
      this.cooldown.update((seconds) => Math.max(0, seconds - 1));
      if (this.cooldown() === 0) clearInterval(this.timer);
    }, 1000);
  }
}
