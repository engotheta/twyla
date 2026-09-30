import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActionButtonsComponent } from './components/action-buttons/action-buttons.component';
import { DataGridComponent } from './components/data-grid';
import { ContentsViewComponent } from './components/contents-view';
import { getContentsParameter } from './put-together/contents';
import { gridParameter } from './put-together/data-grid';
import { getFormParameter } from './put-together/form';
import { GenericFormComponent } from './components/generic-form';
import { DetailsComponent } from './components/details/details.component';
import { detailsParameter } from './put-together/details';
import { actionButtons } from './put-together/buttons';
import { FetchDemoComponent } from './put-together/fetch-demo';

export const applog = signal('');

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ActionButtonsComponent,
    ContentsViewComponent,
    DataGridComponent,
    GenericFormComponent,
    DetailsComponent,
    FetchDemoComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly log = applog;

  gridParameter = gridParameter;

  formParameter = getFormParameter();

  detailsParameter = detailsParameter;

  contentsParameter = getContentsParameter();

  actionButtons = actionButtons;
}
