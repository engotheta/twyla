import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { injectMessages } from '@services/i18n/message-bundle';
import { FILE_VIEWER_MESSAGES } from './file-viewer.messages';
import { ViewerController } from './viewer-controller';

const SEARCH_DELAY_MS = 250;
const TOGGLE =
  'inline-flex h-7 items-center rounded-full border border-black/15 px-2.5 text-xs aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary';

/**
 * "Find in document" for renderers that can search (PDF). Searches as you type; Enter / Shift+Enter
 * step through matches; Esc closes the bar (and only the bar — not the dialog around the viewer).
 */
@Component({
  selector: 'file-viewer-find-bar',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <form
      role="search"
      [attr.aria-label]="t().find.label"
      class="flex flex-wrap items-center gap-2 px-3 py-1.5"
      (submit)="$event.preventDefault(); step(false)"
    >
      <input
        #query
        type="search"
        autocomplete="off"
        [placeholder]="t().find.label"
        [attr.aria-label]="t().find.label"
        class="h-8 w-56 max-w-full rounded-lg border border-(--field-outline) px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        (input)="onInput(query.value)"
        (keydown)="onKeydown($event)"
      />
      <span class="min-w-24 text-xs text-black/70" role="status">{{ status() }}</span>
      <button
        type="button"
        mat-icon-button
        [attr.aria-label]="t().find.previous"
        [matTooltip]="t().find.previousTip"
        [disabled]="!total()"
        (click)="step(true)"
      >
        <mat-icon aria-hidden="true">keyboard_arrow_up</mat-icon>
      </button>
      <button
        type="button"
        mat-icon-button
        [attr.aria-label]="t().find.next"
        [matTooltip]="t().find.nextTip"
        [disabled]="!total()"
        (click)="step(false)"
      >
        <mat-icon aria-hidden="true">keyboard_arrow_down</mat-icon>
      </button>
      <button
        type="button"
        [class]="toggle"
        [attr.aria-pressed]="caseSensitive()"
        (click)="caseSensitive.set(!caseSensitive()); search()"
      >
        {{ t().find.matchCase }}
      </button>
      <button
        type="button"
        [class]="toggle"
        [attr.aria-pressed]="entireWord()"
        (click)="entireWord.set(!entireWord()); search()"
      >
        {{ t().find.wholeWords }}
      </button>
      <button
        type="button"
        mat-icon-button
        class="ms-auto"
        [attr.aria-label]="t().find.close"
        [matTooltip]="t().find.closeTip"
        (click)="close()"
      >
        <mat-icon aria-hidden="true">close</mat-icon>
      </button>
    </form>
  `,
  host: { class: 'block border-b border-black/10 bg-gray-50' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerFindBarComponent {
  /** the bar closed — the viewer puts focus back where it came from */
  readonly closed = output<void>();

  private readonly controller = inject(ViewerController);
  protected readonly t = injectMessages(FILE_VIEWER_MESSAGES);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('query');

  protected readonly toggle = TOGGLE;
  protected readonly caseSensitive = signal(false);
  protected readonly entireWord = signal(false);
  private readonly query = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly total = computed(() => this.controller.findResult().total);
  protected readonly status = computed(() => {
    const { state, current, total } = this.controller.findResult();
    if (!this.query()) return '';
    const text = this.t().find;
    if (state === 'pending') return text.searching;
    if (state === 'not-found' || !total) return text.noMatches;
    return text.matches(current, total, state === 'wrapped');
  });

  constructor() {
    afterNextRender(() => this.input().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search(), SEARCH_DELAY_MS);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // the bar, not the dialog
      this.close();
    } else if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      this.step(true);
    }
  }

  protected search(): void {
    clearTimeout(this.timer);
    this.controller.find({
      query: this.query(),
      caseSensitive: this.caseSensitive(),
      entireWord: this.entireWord(),
      type: '',
      findPrevious: false,
    });
  }

  protected step(previous: boolean): void {
    if (!this.query()) return;
    this.controller.find({
      query: this.query(),
      caseSensitive: this.caseSensitive(),
      entireWord: this.entireWord(),
      type: 'again',
      findPrevious: previous,
    });
  }

  protected close(): void {
    this.controller.closeFind();
    this.closed.emit();
  }
}
