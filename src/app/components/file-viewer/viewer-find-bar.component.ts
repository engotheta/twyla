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
      aria-label="Find in document"
      class="flex flex-wrap items-center gap-2 px-3 py-1.5"
      (submit)="$event.preventDefault(); step(false)"
    >
      <input
        #query
        type="search"
        autocomplete="off"
        placeholder="Find in document"
        aria-label="Find in document"
        class="h-8 w-56 max-w-full rounded border border-black/25 px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        (input)="onInput(query.value)"
        (keydown)="onKeydown($event)"
      />
      <span class="min-w-24 text-xs text-black/70" role="status">{{ status() }}</span>
      <button
        type="button"
        mat-icon-button
        aria-label="Previous match"
        matTooltip="Previous (Shift+Enter)"
        [disabled]="!total()"
        (click)="step(true)"
      >
        <mat-icon aria-hidden="true">keyboard_arrow_up</mat-icon>
      </button>
      <button
        type="button"
        mat-icon-button
        aria-label="Next match"
        matTooltip="Next (Enter)"
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
        Match case
      </button>
      <button
        type="button"
        [class]="toggle"
        [attr.aria-pressed]="entireWord()"
        (click)="entireWord.set(!entireWord()); search()"
      >
        Whole words
      </button>
      <button
        type="button"
        mat-icon-button
        class="ms-auto"
        aria-label="Close find"
        matTooltip="Close (Esc)"
        (click)="close()"
      >
        <mat-icon aria-hidden="true">close</mat-icon>
      </button>
    </form>
  `,
  host: { class: 'block border-b border-black/10 bg-[#f9fafb]' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerFindBarComponent {
  /** the bar closed — the viewer puts focus back where it came from */
  readonly closed = output<void>();

  private readonly controller = inject(ViewerController);
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
    if (state === 'pending') return 'Searching…';
    if (state === 'not-found' || !total) return 'No matches';
    return `${current} of ${total}${state === 'wrapped' ? ' (wrapped)' : ''}`;
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
