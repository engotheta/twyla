import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SESSION_CONFIG } from './session-config.token';
import { SessionService } from './session.service';

/**
 * Adds `Authorization: Bearer <token>` to requests for `SessionConfig.tokenUrls` while signed in
 * — never to other hosts, never over a header the request already set.
 * `provideHttpClient(withInterceptors([sessionInterceptor]))`.
 */
export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(SessionService).token();
  if (!token || request.headers.has('Authorization')) return next(request);
  const matches = inject(SESSION_CONFIG).tokenUrls.some((rule) =>
    typeof rule === 'string' ? request.url.startsWith(rule) : rule.test(request.url),
  );
  return next(
    matches ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request,
  );
};
