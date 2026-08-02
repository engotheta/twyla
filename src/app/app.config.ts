import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { ROW_DETAILS_COMPONENT } from './components/data-grid/row-details.token';
import { DetailsComponent } from './components/details/details.component';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: ROW_DETAILS_COMPONENT, useValue: DetailsComponent },
  ],
};
