import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { NotificationService } from '@services/notification/notification.service';
import { SESSION_CONFIG } from './session-config.token';
import { AccessRule } from './session.interface';
import { SessionService } from './session.service';

/**
 * Signed-in users only; everyone else goes to the sign-in page, which brings them back here
 * afterwards (`?returnUrl=`). Works as `canActivate` and `canActivateChild`.
 */
export const authGuard: CanActivateFn & CanActivateChildFn = (_route, state) => {
  if (inject(SessionService).isAuthenticated()) return true;
  return inject(Router).createUrlTree([inject(SESSION_CONFIG).loginUrl], {
    queryParams: { returnUrl: state.url },
  });
};

/** The sign-in / sign-up pages: a signed-in user goes to `homeUrl` instead. */
export const guestGuard: CanActivateFn = () =>
  inject(SessionService).isAuthenticated()
    ? inject(Router).parseUrl(inject(SESSION_CONFIG).homeUrl)
    : true;

/**
 * GASCO's module guard: the route's `data.permissions` (any one) and `data.visibleFor` must
 * allow the user, else they go to `homeUrl` with a notice. Leaves signed-out visitors to
 * `authGuard` (put that first).
 */
export const permissionGuard: CanActivateFn & CanActivateChildFn = (route) => {
  const session = inject(SessionService);
  const rule: AccessRule = {
    permissions: route.data['permissions'] as string[] | undefined,
    visibleFor: route.data['visibleFor'] as string[] | undefined,
  };
  if (!session.isAuthenticated() || session.canAccess(rule)) return true;
  inject(NotificationService).warn("You don't have access to that page.");
  return inject(Router).parseUrl(inject(SESSION_CONFIG).homeUrl);
};

/** whether the page showing now sits behind `authGuard` */
export function requiresSession(router: Router): boolean {
  for (let route = router.routerState.snapshot.root; route;) {
    const config = route.routeConfig;
    if (config?.canActivate?.includes(authGuard) || config?.canActivateChild?.includes(authGuard)) {
      return true;
    }
    if (!route.firstChild) break;
    route = route.firstChild;
  }
  return false;
}

/** `returnUrl` if it's a path in this app — never another site (`//evil.example`, `/\evil`) */
export function safeReturnUrl(url: string | null | undefined): string | undefined {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\'))
    return undefined;
  return url;
}
