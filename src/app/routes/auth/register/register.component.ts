import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { FormParameter, GenericFormComponent } from '../../../components/generic-form';
import { NotificationService } from '../../../services/notification';
import { SESSION_CONFIG, SessionService } from '../../../services/session';
import { AuthCardComponent } from '../auth-card.component';
import { registerForm, RegisterValue } from '../auth.forms';
import { PasswordChecklistComponent } from '../password-checklist.component';

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

    <auth-card heading="Create an account" lead="It takes a minute — you'll sign in right after.">
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
          Demo: accounts aren't saved. Afterwards, sign in with the demo account.
        </p>
      }

      <generic-form [params]="formFor(checklist)" />

      <p class="mt-6 text-center text-sm text-gray-600">
        Already have an account?
        <a
          class="font-medium text-blue-700 underline-offset-2 hover:underline"
          routerLink="/auth/login"
        >
          Sign in
        </a>
      </p>
    </auth-card>
  `,
  host: { class: 'flex flex-1 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly session = inject(SessionService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly alert = viewChild<ElementRef<HTMLElement>>('alert');

  protected readonly demo = inject(SESSION_CONFIG).demoCredentials;
  protected readonly error = signal<string | null>(null);
  /** feeds the checklist as the password is typed */
  protected readonly password = signal('');
  private params?: FormParameter;

  /** built once, with the checklist template from this page's view */
  protected formFor(checklist: TemplateRef<unknown>): FormParameter {
    return (this.params ??= registerForm(
      (value) => this.register(value),
      checklist,
      (password) => this.password.set(password),
    ));
  }

  private async register(value: RegisterValue): Promise<void> {
    this.error.set(null);
    try {
      await this.session.register({ ...value });
      this.notifications.success('Your account is ready — sign in to continue.');
      await this.router.navigateByUrl('/auth/login');
    } catch (error) {
      this.error.set(this.session.errorMessage(error));
      afterNextRender(() => this.alert()?.nativeElement.focus(), { injector: this.injector });
    }
  }
}
