import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { DetailsHeaderComponent } from './details-header/details-header.component';
import { FieldGroupComponent } from './field/field-group/field-group.component';
import { DetailsParameter } from './detail.interface';
import { resolveDetailGroups } from './detail.helpers';
import { MergeClassesPipe } from './util/class-name/merge-classes.pipe';

@Component({
  selector: 'app-details',
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss',
  imports: [MatTabsModule, DetailsHeaderComponent, FieldGroupComponent, MergeClassesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsComponent<TEntity = Record<string, unknown>> {
  readonly parameter = input.required<DetailsParameter<TEntity>>();

  protected readonly fieldGroups = computed(() => resolveDetailGroups(this.parameter()));

  protected readonly showHeader = computed(() => {
    const header = this.parameter().header;
    return header?.show !== false && !!header?.title;
  });
}
