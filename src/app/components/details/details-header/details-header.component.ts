import { ChangeDetectionStrategy, Component, computed, input, Signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MergeClassesPipe } from '../util/class-name/merge-classes.pipe';
import { SignalPipe } from '../util/pipes/signal.pipe';
import { ActionButton } from '../../action-buttons/action-button.interface';
import { ActionButtonsComponent } from '../../action-buttons/action-buttons.component';

export interface HeaderParameter<D = unknown> {
  title?: string;
  titleClass?: string;
  subtitle?: string | number;
  subtitleClass?: string;
  animation?: string;

  icon?: string;
  iconClass?: string;

  data?: D;
  containerClass?: string;
  actionButtons?: ActionButton<D>[];
}

@Component({
  selector: 'details-header',
  templateUrl: './details-header.component.html',
  styleUrl: './details-header.component.scss',
  imports: [MatIcon, MergeClassesPipe, SignalPipe, ActionButtonsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailsHeaderComponent<D = unknown> {
  /** Accepts either a full parameter object, or the individual props below. */
  readonly parameter = input<HeaderParameter<D>>();

  readonly title = input<string | Signal<string>>();
  readonly titleClass = input<string>();
  readonly animation = input<string>();

  readonly subtitle = input<string | number>();
  readonly subtitleClass = input<string>();

  readonly icon = input<string>();
  readonly iconClass = input<string>();

  readonly data = input<D>();
  readonly containerClass = input<string>();
  readonly actionButtons = input<ActionButton<D>[]>();

  //derived signals for inputs and parameter props
  protected readonly animation_ = computed(() => this.animation() ?? this.parameter()?.animation);

  protected readonly icon_ = computed(() => this.icon() ?? this.parameter()?.icon);

  protected readonly iconClass_ = computed(
    () => this.iconClass() ?? this.parameter()?.iconClass ?? '',
  );

  protected readonly title_ = computed(() => this.title() ?? this.parameter()?.title);

  protected readonly titleClass_ = computed(
    () => this.titleClass() ?? this.parameter()?.titleClass ?? '',
  );

  protected readonly subtitle_ = computed(() => this.subtitle() ?? this.parameter()?.subtitle);

  protected readonly subtitleClass_ = computed(
    () => this.subtitleClass() ?? this.parameter()?.subtitleClass ?? '',
  );

  protected readonly data_ = computed(() => this.data() ?? this.parameter()?.data);

  protected readonly containerClass_ = computed(
    () => this.containerClass() ?? this.parameter()?.containerClass ?? '',
  );

  protected readonly actionButtons_ = computed(
    () => this.actionButtons() ?? this.parameter()?.actionButtons ?? [],
  );
}
