import { Routes } from '@angular/router';
import { guestGuard } from '../../services/session';
import { AuthLayoutComponent } from './auth-layout.component';

/**
 * The session pages (GASCO `auth.routes.ts`), each inside the auth layout. Signing in, signing up
 * and asking for a reset link are for visitors (`guestGuard`); a reset link works either way.
 */
export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    title: 'Sign in',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
      },
    ],
  },
  {
    path: 'register',
    title: 'Create an account',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./register/register.component').then((m) => m.RegisterComponent),
      },
    ],
  },
  {
    path: 'forgot-password',
    title: 'Forgot password',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent,
          ),
      },
    ],
  },
  {
    path: 'reset-password',
    title: 'Reset password',
    component: AuthLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
      },
    ],
  },
];

export default AUTH_ROUTES;
