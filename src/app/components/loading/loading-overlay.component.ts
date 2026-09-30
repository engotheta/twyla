import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { LOADING_CONFIG } from './loading-config.token';

/**
 * The scrim + spinner `LoadingService` mounts inside a loading target. Not meant for templates —
 * use `[loadingOverlay]` or `LoadingService.show()`, which also handle `aria-busy` and timing.
 */
@Component({
  selector: 'loading-overlay',
  imports: [MatProgressSpinner],
  template: `
    <mat-progress-spinner
      mode="indeterminate"
      [diameter]="config.diameter"
      [attr.aria-label]="config.label"
    />
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: grid;
      place-items: center;
      border-radius: inherit;
      background: color-mix(in srgb, var(--mat-sys-surface, #fff) 72%, transparent);
      backdrop-filter: blur(1px);
      cursor: progress;
      animation: loading-overlay-in 150ms ease-out;
    }

    @keyframes loading-overlay-in {
      from {
        opacity: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  protected readonly config = inject(LOADING_CONFIG);
}
