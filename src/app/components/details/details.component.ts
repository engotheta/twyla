import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { DetailsHeaderComponent } from './details-header/details-header.component';
import { FieldGroupComponent } from './field/field-group/field-group.component';
import { DetailsDialogData, DetailsParameter } from './detail.interface';
import { resolveDetailGroups } from './detail.helpers';
import { MergeClassesPipe } from './util/class-name/merge-classes.pipe';

/**
 * Renders a resolved `DetailsParameter` — as a plain embeddable component (`[parameter]`), or as
 * a dialog (`dialog.open(DetailsComponent, { data: {...} })`, matching `DetailsDialogData`).
 * Detects dialog mode via `MAT_DIALOG_DATA` and adds its own dialog chrome (title/close button)
 * only when opened that way — mirrors `FieldGroupComponent`'s own dual-mode pattern.
 */
@Component({
  selector: 'all-details',
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatDialogModule,
    MatIcon,
    MatTabsModule,
    DetailsHeaderComponent,
    FieldGroupComponent,
    MergeClassesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsComponent<Entity = Record<string, unknown>> {
  readonly parameter = input<DetailsParameter<Entity>>();

  // Set only when this instance was created via `dialog.open(DetailsComponent, { data })` instead
  // of being used as a normal embedded component.
  protected dialogData = inject<DetailsDialogData<Entity>>(MAT_DIALOG_DATA, { optional: true });

  protected readonly dialogRef = inject(MatDialogRef<DetailsComponent<Entity>>, { optional: true });

  protected readonly resolvedParameter = computed<DetailsParameter<Entity>>(
    () => this.dialogData ?? this.parameter() ?? {},
  );

  protected readonly fieldGroups = computed(() => resolveDetailGroups(this.resolvedParameter()));

  protected readonly showHeader = computed(() => {
    const header = this.resolvedParameter().header;
    return header?.show !== false && !!header?.title;
  });
}
