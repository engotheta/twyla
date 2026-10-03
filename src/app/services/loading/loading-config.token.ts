import { InjectionToken, Provider } from '@angular/core';

/** Timing and look of the overlays `LoadingService` puts on loading targets. */
export interface LoadingConfig {
  /** Ms to wait before showing an overlay, so fast requests never flash a spinner. */
  delay: number;
  /** Once shown, an overlay stays at least this many ms, so it never flickers. */
  minDuration: number;
  /** Ms to wait for a class-name target that isn't in the DOM yet before giving up on it. */
  waitForTarget: number;
  /** Spinner diameter in px. */
  diameter: number;
  /** Accessible name of the spinner (it is exposed as a `progressbar`). */
  label: string;
}

export const DEFAULT_LOADING_CONFIG: LoadingConfig = {
  delay: 150,
  minDuration: 400,
  waitForTarget: 3000,
  diameter: 32,
  label: 'Loading',
};

export const LOADING_CONFIG = new InjectionToken<LoadingConfig>('LOADING_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_LOADING_CONFIG,
});

/** Overrides part of the loading config, e.g. `provideLoadingConfig({ delay: 0 })` in tests. */
export function provideLoadingConfig(config: Partial<LoadingConfig>): Provider {
  return { provide: LOADING_CONFIG, useValue: { ...DEFAULT_LOADING_CONFIG, ...config } };
}
