import { FocusKeyManager } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import { hasModifierKey } from '@angular/cdk/keycodes';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { mergeClasses } from '../../details/util/class-name/class-name.helpers';
import { TabNavItemDirective } from './tab-nav-item.directive';
import { TabNavClasses, TabNavItem } from './tab-nav.interface';

/** Material's paginated tab header: a held arrow starts repeating after this long… */
const PAGING_DELAY_MS = 650;
/** …then pages again this often */
const PAGING_INTERVAL_MS = 100;
/** room left past a toggle scrolled into view, so its neighbour peeks in */
const REVEAL_MARGIN_PX = 32;

// Visual defaults are Tailwind classes, not SCSS, so every `TabNavClasses` hook can override any
// of them through `mergeClasses` — Angular's unlayered component CSS would beat Tailwind v4's
// layered utilities whatever a consumer passed. No font size anywhere: toggles inherit the
// surrounding text, and `mergeClasses` treats every `text-*` as one group, so a default size
// would vanish the moment a consumer set a text colour.
const CONTAINER = {
  horizontal:
    'inline-flex max-w-full min-w-0 self-start items-center gap-1 rounded-[15px] border border-gray-200 bg-white p-1',
  vertical:
    'flex max-h-full min-h-0 w-max max-w-56 flex-col rounded-[15px] border border-gray-200 bg-white p-1',
};
const TAB =
  'flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[12px] px-3.5 font-medium text-[var(--color-black)] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary aria-disabled:cursor-default aria-disabled:opacity-50';
const TAB_VERTICAL = 'w-full justify-start';
const ACTIVE_TAB = 'text-white';
/** sized and moved through the `--cv-tab-*` box of the active toggle (set by `placeIndicator`) —
 *  as classes, so a consumer can reshape it: `h-0.5 top-auto bottom-0 rounded-none` underlines */
const INDICATOR =
  'left-0 top-0 h-(--cv-tab-h) w-(--cv-tab-w) translate-x-(--cv-tab-x) translate-y-(--cv-tab-y) rounded-[12px] bg-primary';
/** added once the indicator has been placed, so it never sweeps in from the corner */
const INDICATOR_MOTION =
  'transition-[translate,width,height] duration-300 ease-in-out motion-reduce:transition-none';
const ARROW =
  'grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-full text-[var(--color-black)] hover:bg-black/5 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent';

/**
 * The tab toggles of a contents-view tabs level. The level renders them itself at the root; a
 * nested level hands them to the content owning the tabs, which shows them in its header
 * (horizontal) or as a sidebar beside its body (vertical). Owns no selection: it shows
 * `activeKey` and emits `tabSelect`.
 *
 * Behaves like Material's tab header:
 *  - WAI-ARIA tabs — `role="tablist"`/`"tab"`, `aria-selected`/`aria-controls`, one roving tab
 *    stop. Arrow keys move focus (←/→, or ↑/↓ when vertical; wrapping), Home/End jump, and
 *    Enter/Space select: manual activation, so arrowing past a panel that fetches doesn't load
 *    it. A disabled toggle is focusable but never selected.
 *  - an indicator sliding behind the active toggle, along either axis.
 *  - horizontal overflow — native scrolling (touch, trackpad) plus prev/next arrows paging a
 *    third of the strip (held, they repeat), each disabled at its end; the focused or active
 *    toggle is kept in view. The arrows are `aria-hidden` and untabbable: keyboard users page
 *    with the toggles themselves.
 */
@Component({
  selector: 'contents-tab-nav',
  imports: [MatIconModule, TabNavItemDirective],
  templateUrl: './tab-nav.component.html',
  styleUrl: './tab-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'containerClass()',
    '[attr.data-orientation]': 'orientation()',
  },
})
export class ContentsTabNavComponent {
  readonly tabs = input.required<readonly TabNavItem[]>();
  readonly activeKey = input<string>();
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** the tablist's accessible name — e.g. the owning content's label */
  readonly ariaLabel = input<string>();
  readonly classes = input<TabNavClasses>({});
  /** a toggle was picked (click, Enter, Space) — its key */
  readonly tabSelect = output<string>();

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dir = inject(Directionality, { optional: true });

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly tablist = viewChild.required<ElementRef<HTMLElement>>('tablist');
  private readonly indicator = viewChild.required<ElementRef<HTMLElement>>('indicator');
  private readonly items = viewChildren(TabNavItemDirective);

  protected readonly vertical = computed(() => this.orientation() === 'vertical');
  protected readonly rtl = computed(() => this.dir?.valueSignal() === 'rtl');
  private readonly activeIndex = computed(() =>
    this.tabs().findIndex((tab) => tab.key === this.activeKey()),
  );
  /** the roving tab stop while focus is in the tablist; `null` → the active toggle */
  private readonly focusIndex = signal<number | null>(null);
  /** the toggles overflow the strip — the arrows show */
  protected readonly paginated = signal(false);
  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(true);
  private readonly indicatorPlaced = signal(false);

  protected readonly containerClass = computed(() =>
    mergeClasses(CONTAINER[this.orientation()], this.classes().container ?? ''),
  );
  protected readonly indicatorClass = computed(() =>
    mergeClasses(
      this.indicatorPlaced() ? `${INDICATOR} ${INDICATOR_MOTION}` : INDICATOR,
      this.classes().indicator ?? '',
    ),
  );
  private readonly inactiveTabClass = computed(() =>
    mergeClasses(this.vertical() ? `${TAB} ${TAB_VERTICAL}` : TAB, this.classes().tab ?? ''),
  );
  private readonly activeTabClass = computed(() =>
    mergeClasses(this.inactiveTabClass(), mergeClasses(ACTIVE_TAB, this.classes().activeTab ?? '')),
  );
  protected readonly arrowClass = ARROW;

  private readonly keyManager = new FocusKeyManager(this.items, this.injector)
    .withHomeAndEnd()
    .withWrap()
    // like Material's tabs: a disabled toggle still takes focus — it just never selects
    .skipPredicate(() => false);

  /** the active key last scrolled into view — re-rendering the same tabs doesn't yank the strip */
  private revealedKey?: string;
  private endsFrame = 0;
  private syncFrame = 0;
  private pagingDelay?: ReturnType<typeof setTimeout>;
  private pagingRepeat?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const vertical = this.vertical();
      this.keyManager
        .withVerticalOrientation(vertical)
        .withHorizontalOrientation(vertical ? null : this.rtl() ? 'rtl' : 'ltr');
    });

    // an arrow key moved focus: that toggle is the tab stop now, and comes into view
    const focusMoves = this.keyManager.change.subscribe((index) => {
      this.focusIndex.set(index);
      this.reveal(index);
    });

    // what's shown changed: re-place the indicator, re-check the arrows — and, when the active
    // toggle itself changed, bring it into view
    effect(() => {
      const key = this.activeKey();
      this.tabs();
      this.orientation();
      afterNextRender(
        () => {
          this.sync();
          if (key !== this.revealedKey) {
            this.revealedKey = key;
            this.reveal(this.activeIndex());
          }
        },
        { injector: this.injector },
      );
    });

    // a resize (the strip squeezed, fonts landing, a hidden nav shown) re-measures everything; a
    // scroll only moves the ends
    afterNextRender(() => {
      const viewport = this.viewport().nativeElement;
      const onScroll = (): void => {
        cancelAnimationFrame(this.endsFrame);
        this.endsFrame = requestAnimationFrame(() => this.checkEnds());
      };
      viewport.addEventListener('scroll', onScroll, { passive: true });
      const resizes =
        typeof ResizeObserver === 'undefined'
          ? undefined
          : new ResizeObserver(() => {
              cancelAnimationFrame(this.syncFrame);
              this.syncFrame = requestAnimationFrame(() => this.sync());
            });
      resizes?.observe(this.host);
      resizes?.observe(this.tablist().nativeElement);
      this.destroyRef.onDestroy(() => {
        viewport.removeEventListener('scroll', onScroll);
        resizes?.disconnect();
      });
    });

    this.destroyRef.onDestroy(() => {
      focusMoves.unsubscribe();
      this.keyManager.destroy();
      this.stopPaging();
      cancelAnimationFrame(this.endsFrame);
      cancelAnimationFrame(this.syncFrame);
    });
  }

  protected tabClass(tab: TabNavItem): string {
    return tab.key === this.activeKey() ? this.activeTabClass() : this.inactiveTabClass();
  }

  /** one tab stop: the toggle last focused while inside the list, else the active one */
  protected tabIndexOf(index: number): number {
    const stop = this.focusIndex() ?? Math.max(this.activeIndex(), 0);
    return index === Math.min(stop, this.tabs().length - 1) ? 0 : -1;
  }

  /** Enter / Space need nothing here — each toggle is a real `<button>`, so they click it */
  protected onKeydown(event: KeyboardEvent): void {
    if (!hasModifierKey(event)) this.keyManager.onKeydown(event);
  }

  /** a toggle took focus (Tab into the list, a click, an arrow key) — it's the tab stop now */
  protected onTabFocus(index: number): void {
    this.focusIndex.set(index);
    this.keyManager.updateActiveItem(index);
  }

  /** focus left the list — the active toggle is the tab stop again */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.tablist().nativeElement.contains(next)) this.focusIndex.set(null);
  }

  protected choose(tab: TabNavItem): void {
    if (!tab.disabled && tab.key !== this.activeKey()) this.tabSelect.emit(tab.key);
  }

  /** press an arrow: page once now and, while held, again and again — Material's timings */
  protected startPaging(direction: -1 | 1, event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.stopPaging();
    this.page(direction);
    this.pagingDelay = setTimeout(() => {
      this.pagingRepeat = setInterval(() => this.page(direction), PAGING_INTERVAL_MS);
    }, PAGING_DELAY_MS);
    this.document.addEventListener('pointerup', this.stopPaging);
    this.document.addEventListener('pointercancel', this.stopPaging);
  }

  private readonly stopPaging = (): void => {
    clearTimeout(this.pagingDelay);
    clearInterval(this.pagingRepeat);
    this.document.removeEventListener('pointerup', this.stopPaging);
    this.document.removeEventListener('pointercancel', this.stopPaging);
  };

  private page(direction: -1 | 1): void {
    if (direction < 0 ? this.atStart() : this.atEnd()) return this.stopPaging();
    const viewport = this.viewport().nativeElement;
    // in physical px — toward the end runs leftward in RTL
    const step = (viewport.clientWidth / 3) * direction * (this.rtl() ? -1 : 1);
    viewport.scrollBy({ left: step, behavior: this.scrollBehavior() });
  }

  private sync(): void {
    this.placeIndicator();
    this.checkPagination();
    this.checkEnds();
  }

  /** hands the indicator the active toggle's box — `--cv-tab-x/y/w/h`, relative to the tablist —
   *  which its classes turn into the same translate + size on either axis */
  private placeIndicator(): void {
    const indicator = this.indicator().nativeElement;
    const tab = this.items()[this.activeIndex()]?.element;
    // nothing active, or not laid out (a hidden nav — the ResizeObserver catches it showing)
    if (!tab?.offsetWidth) {
      indicator.style.visibility = 'hidden';
      return;
    }
    indicator.style.visibility = '';
    indicator.style.setProperty('--cv-tab-x', `${tab.offsetLeft}px`);
    indicator.style.setProperty('--cv-tab-y', `${tab.offsetTop}px`);
    indicator.style.setProperty('--cv-tab-w', `${tab.offsetWidth}px`);
    indicator.style.setProperty('--cv-tab-h', `${tab.offsetHeight}px`);
    if (!this.indicatorPlaced()) requestAnimationFrame(() => this.indicatorPlaced.set(true));
  }

  /** the arrows show while the toggles' full width exceeds the strip's — measured against the
   *  host's own content box, which (arrows or not) is what the toggles would have to fit in */
  private checkPagination(): void {
    if (this.vertical()) {
      this.paginated.set(false);
      return;
    }
    const style = getComputedStyle(this.host);
    const room =
      this.host.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
    this.paginated.set(this.tablist().nativeElement.scrollWidth > room + 1);
  }

  /** whether the strip is scrolled to either end — `Math.abs`, as RTL scroll offsets go negative */
  private checkEnds(): void {
    const viewport = this.viewport().nativeElement;
    const vertical = this.vertical();
    const offset = Math.abs(vertical ? viewport.scrollTop : viewport.scrollLeft);
    const max = vertical
      ? viewport.scrollHeight - viewport.clientHeight
      : viewport.scrollWidth - viewport.clientWidth;
    this.atStart.set(offset <= 1);
    this.atEnd.set(offset >= max - 1);
  }

  /** scroll the toggle at `index` into view, plus a margin — by rects, so RTL needs nothing */
  private reveal(index: number): void {
    const tab = this.items()[index]?.element;
    if (!tab) return;
    const viewport = this.viewport().nativeElement;
    const view = viewport.getBoundingClientRect();
    if (!view.width || !view.height) return; // not laid out
    const box = tab.getBoundingClientRect();
    const [start, end, viewStart, viewEnd] = this.vertical()
      ? [box.top, box.bottom, view.top, view.bottom]
      : [box.left, box.right, view.left, view.right];
    const delta =
      start < viewStart
        ? start - viewStart - REVEAL_MARGIN_PX
        : end > viewEnd
          ? end - viewEnd + REVEAL_MARGIN_PX
          : 0;
    if (!delta) return;
    const behavior = this.scrollBehavior();
    viewport.scrollBy(this.vertical() ? { top: delta, behavior } : { left: delta, behavior });
  }

  private scrollBehavior(): ScrollBehavior {
    const reduce = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    return reduce?.matches ? 'auto' : 'smooth';
  }
}
