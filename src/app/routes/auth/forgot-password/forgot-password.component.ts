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
import { GenericFormComponent } from '../../../components/generic-form';
import { SessionService } from '../../../services/session';
import { AuthCardComponent } from '../auth-card.component';
import { forgotPasswordForm, ForgotPasswordValue } from '../auth.forms';

/** seconds before the link can be sent again */
const RESEND_AFTER = 30;

@Component({
  selector: 'forgot-password-page',
  imports: [RouterLink, MatButton, MatIcon, GenericFormComponent, AuthCardComponent],
  template: `
    <auth-card
      heading="Forgot your password?"
      [lead]="
        sentTo()
          ? ''
          : 'Enter the email you signed up with and we\\'ll send you a link to reset it.'
      "
    >
      @if (sentTo(); as email) {
        <div class="flex flex-col gap-4">
          <div
            class="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-900 ring-1 ring-emerald-200"
          >
            <mat-icon class="shrink-0" aria-hidden="true">mark_email_read</mat-icon>
            <div>
              <h2 #sentHeading class="font-semibold focus:outline-none" tabindex="-1">
                Check your email
              </h2>
              <p class="mt-1 text-sm">
                If an account exists for <strong>{{ email }}</strong
                >, a link to reset your password is on its way. It may take a few minutes.
              </p>
            </div>
          </div>

          @if (demoLink(); as link) {
            <a mat-stroked-button [routerLink]="link">
              <mat-icon aria-hidden="true">science</mat-icon>
              Demo: open the reset link
            </a>
          }

          <button mat-button type="button" [disabled]="cooldown() > 0" (click)="resend()">
            {{ cooldown() > 0 ? 'Resend the link in ' + cooldown() + 's' : 'Resend the link' }}
          </button>
          <a mat-flat-button routerLink="/auth/login">Back to sign in</a>
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
        <generic-form [params]="params" />
        <p class="mt-6 text-center text-sm">
          <a
            class="font-medium text-blue-700 underline-offset-2 hover:underline"
            routerLink="/auth/login"
          >
            Back to sign in
          </a>
        </p>
      }
    </auth-card>
  `,
  host: { class: 'flex flex-1 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly sentHeading = viewChild<ElementRef<HTMLElement>>('sentHeading');

  protected readonly params = forgotPasswordForm((value) => this.send(value));
  protected readonly error = signal<string | null>(null);
  /** set once the request went through — the form gives way to "Check your email" */
  protected readonly sentTo = signal<string | null>(null);
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
    this.error.set(null);
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
      this.error.set(this.session.errorMessage(error));
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
