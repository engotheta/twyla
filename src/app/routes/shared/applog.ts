import { signal } from '@angular/core';

/** The demos' "Last action" line: buttons, grids and details write what was clicked, and the demo
 *  pages show it (`DemoLogComponent`). */
export const applog = signal('');
