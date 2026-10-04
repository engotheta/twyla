import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Tells the backend which language the user reads, so it can answer in it:
 * `Accept-Language: sw-TZ`. Never over a header the request already set.
 * `provideHttpClient(withInterceptors([languageInterceptor]))`.
 */
export const languageInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.headers.has('Accept-Language')) return next(request);
  const locale = inject(I18nService).locale();
  return next(request.clone({ setHeaders: { 'Accept-Language': locale } }));
};
