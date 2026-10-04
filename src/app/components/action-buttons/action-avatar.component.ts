import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { mergeClasses } from '@utils/class-name.helpers';
import { initialsOf } from './action-button.helpers';
import { ButtonAvatar } from './action-button.interface';

const CIRCLE = 'size-8 shrink-0 rounded-full';

/**
 * A button's avatar (`ActionButton.avatar`): the picture in a circle — or, with none to show or
 * one that fails to load, the initials of the name on the primary colour; a plain figure when
 * there is no name either. Decoration: the button's own label, or its `ariaLabel`, says whose.
 */
@Component({
  selector: 'action-avatar',
  imports: [MatIcon],
  template: `
    @let a = avatar();
    @if (a.src && !failed()) {
      <img
        alt=""
        width="32"
        height="32"
        [class]="imageClass()"
        [src]="a.src"
        (error)="failed.set(true)"
      />
    } @else {
      <span [class]="initialsClass()" aria-hidden="true">
        @if (initials()) {
          {{ initials() }}
        } @else {
          <mat-icon class="size-5! text-xl! leading-5!">person</mat-icon>
        }
      </span>
    }
  `,
  host: { class: 'inline-flex shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionAvatarComponent {
  readonly avatar = input.required<ButtonAvatar>();

  /** the image failed to load — until another one is given */
  protected readonly failed = linkedSignal({
    source: () => this.avatar().src,
    computation: () => false,
  });

  protected readonly initials = computed(() => initialsOf(this.avatar().name));

  protected readonly imageClass = computed(() =>
    mergeClasses(`${CIRCLE} bg-gray-100 object-cover`, this.avatar().class ?? ''),
  );
  protected readonly initialsClass = computed(() =>
    mergeClasses(
      `${CIRCLE} grid place-items-center bg-primary text-xs font-semibold text-white`,
      this.avatar().class ?? '',
    ),
  );
}
