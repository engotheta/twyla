import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
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
import { FormParameter, GenericFormComponent } from '../../../components/generic-form';
import { NotificationService } from '../../../services/notification';
import { SessionService } from '../../../services/session';
import { AuthCardComponent } from '../auth-card.component';
import { resetPasswordForm, ResetPasswordValue } from '../auth.forms';
import { PasswordChecklistComponent } from '../password-checklist.component';

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

    <auth-card
      heading="Choose a new password"
      [lead]="token() ? 'Use one you don\\'t use anywhere else.' : ''"
    >
      @if (!token()) {
        <div class="flex flex-col gap-4">
          <div
            class="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200"
          >
            <mat-icon class="shrink-0" aria-hidden="true">link_off</mat-icon>
            <p class="text-sm">
              This reset link is incomplete or has expired. Links work once, for a limited time.
            </p>
          </div>
          <a mat-flat-button routerLink="/auth/forgot-password">Request a new link</a>
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
              <a class="font-medium underline" routerLink="/auth/forgot-password"
                >Request a new link</a
              >
            </span>
          </div>
        }
        <generic-form [params]="formFor(checklist)" />
      }
    </auth-card>
  `,
  host: { class: 'flex flex-1 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly alert = viewChild<ElementRef<HTMLElement>>('alert');

  /** from the emailed link: `/auth/reset-password?token=…` */
  readonly token = input<string>();

  protected readonly error = signal<string | null>(null);
  protected readonly password = signal('');
  private params?: FormParameter;

  /** built once, with the checklist template from this page's view */
  protected formFor(checklist: TemplateRef<unknown>): FormParameter {
    return (this.params ??= resetPasswordForm(
      (value) => this.reset(value),
      checklist,
      (password) => this.password.set(password),
    ));
  }

  private async reset({ password }: ResetPasswordValue): Promise<void> {
    this.error.set(null);
    try {
      await this.session.resetPassword({ token: this.token() ?? '', password });
      this.notifications.success('Your password has been reset — sign in with the new one.');
      await this.router.navigateByUrl('/auth/login');
    } catch (error) {
      this.error.set(this.session.errorMessage(error));
      afterNextRender(() => this.alert()?.nativeElement.focus(), { injector: this.injector });
    }
  }
}
