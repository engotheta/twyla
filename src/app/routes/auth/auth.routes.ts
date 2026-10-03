import { Routes } from '@angular/router';
import { guestGuard } from '@services/session';
import { AuthLayoutComponent } from '@layout/auth-layout/auth-layout.component';

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
        loadComponent: () => import('./login.page').then((m) => m.LoginPage),
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
        loadComponent: () => import('./register.page').then((m) => m.RegisterPage),
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
        loadComponent: () => import('./forgot-password.page').then((m) => m.ForgotPasswordPage),
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
        loadComponent: () => import('./reset-password.page').then((m) => m.ResetPasswordPage),
      },
    ],
  },
];

export default AUTH_ROUTES;
