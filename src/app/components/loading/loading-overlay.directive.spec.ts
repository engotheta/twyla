import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLoadingConfig } from './loading-config.token';
import { LoadingOverlayDirective } from './loading-overlay.directive';
import { LoadingService } from './loading.service';

@Component({
  imports: [LoadingOverlayDirective],
  template: `<section class="card" [loadingOverlay]="loading()">content</section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly loading = signal(false);
}

describe('LoadingOverlayDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideLoadingConfig({ delay: 0, minDuration: 0 })],
    });
  });

  it('covers the host while the bound value is true', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    const section: HTMLElement = fixture.nativeElement.querySelector('section');
    await fixture.whenStable();
    expect(section.querySelector('loading-overlay')).toBeNull();

    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    expect(section.querySelector('loading-overlay')).not.toBeNull();
    expect(section.getAttribute('aria-busy')).toBe('true');

    fixture.componentInstance.loading.set(false);
    await fixture.whenStable();
    expect(section.querySelector('loading-overlay')).toBeNull();
    expect(section.hasAttribute('aria-busy')).toBe(false);
  });

  it('releases the overlay when the host is destroyed', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();

    fixture.destroy();
    expect(TestBed.inject(LoadingService).busy()).toBe(false);
  });
});

describe('LoadingService inside reactive contexts', () => {
  it('does not make show()/hide() dependencies of the calling effect', async () => {
    TestBed.configureTestingModule({
      providers: [provideLoadingConfig({ delay: 0, minDuration: 0 })],
    });
    const loading = TestBed.inject(LoadingService);
    const host = document.createElement('div');
    const trigger = signal(0);
    let runs = 0;

    TestBed.runInInjectionContext(() =>
      effect(() => {
        trigger();
        runs++;
        loading.hide(host);
        loading.show(host);
      }),
    );
    TestBed.tick();
    TestBed.tick();

    expect(runs).toBe(1);
    loading.hideAll();
  });
});
