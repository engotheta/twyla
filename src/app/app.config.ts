import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { ROW_DETAILS_COMPONENT } from './components/data-grid/row-details.token';
import { DetailsComponent } from './components/details/details.component';
import { provideFetchConfig } from './components/fetch';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    // the put-together demos talk to dummyjson.com, so their slugs resolve against it
    provideFetchConfig({ apiBaseUrl: 'https://dummyjson.com' }),
    { provide: ROW_DETAILS_COMPONENT, useValue: DetailsComponent },
  ],
};
