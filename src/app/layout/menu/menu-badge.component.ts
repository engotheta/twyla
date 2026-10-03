import { ChangeDetectionStrategy, Component, computed, input, isSignal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { isObservable, of, switchMap } from 'rxjs';
import { MenuBadge, MenuTag, MenuTone } from './menu.interface';

/** static, so Tailwind generates them (a class built at runtime never would be) */
const TONE_CLASS: Record<MenuTone, string> = {
  primary: 'bg-blue-100 text-blue-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-700',
};

/** A menu item's `label` chip and `badge` pill; a badge may be an Observable or a Signal. */
@Component({
  selector: 'menu-badge',
  template: `
    @if (label(); as label) {
      <span class="rounded-full px-2 py-0.5 text-xs font-medium {{ toneClass() }}">{{
        label.value
      }}</span>
    }
    @if (hasValue()) {
      <span
        class="min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums"
        [class]="value() === 0 ? 'bg-gray-100 text-gray-600' : 'bg-primary text-white'"
      >
        {{ value() }}
      </span>
    }
  `,
  host: { class: 'inline-flex shrink-0 items-center gap-1' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuBadgeComponent {
  readonly label = input<MenuTag>();
  readonly badge = input<MenuBadge>();

  private readonly emitted = toSignal(
    toObservable(this.badge).pipe(
      switchMap((badge) => (isObservable(badge) ? badge : of(undefined))),
    ),
  );

  protected readonly value = computed(() => {
    const badge = this.badge();
    if (isObservable(badge)) return this.emitted();
    return isSignal(badge) ? badge() : badge;
  });

  protected readonly hasValue = computed(() => {
    const value = this.value();
    return value !== undefined && value !== '';
  });

  protected readonly toneClass = computed(() => TONE_CLASS[this.label()?.tone ?? 'primary']);
}
