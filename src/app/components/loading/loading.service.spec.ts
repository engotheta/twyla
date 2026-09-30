import { TestBed } from '@angular/core/testing';
import { LoadingConfig, provideLoadingConfig } from './loading-config.token';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;
  let host: HTMLElement;

  function setup(config: Partial<LoadingConfig> = { delay: 0, minDuration: 0 }) {
    TestBed.configureTestingModule({ providers: [provideLoadingConfig(config)] });
    service = TestBed.inject(LoadingService);
  }

  const overlayIn = (element: Element) => element.querySelector('loading-overlay');
  // MutationObserver callbacks run as microtasks; a macrotask lets them all settle
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    host = document.createElement('div');
    host.className = 'card';
    document.body.appendChild(host);
  });

  afterEach(() => {
    service?.hideAll();
    host.remove();
    vi.useRealTimers();
  });

  it('covers an element, marks it busy, and restores it on release', () => {
    setup();
    const release = service.show(host);

    expect(overlayIn(host)).not.toBeNull();
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.style.position).toBe('relative');

    release();

    expect(overlayIn(host)).toBeNull();
    expect(host.hasAttribute('aria-busy')).toBe(false);
    expect(host.style.position).toBe('');
  });

  it('gives the spinner an accessible name', () => {
    setup();
    service.show(host);

    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Loading');
  });

  it('keeps the overlay until every overlapping show() is released', () => {
    setup();
    const first = service.show('card');
    const second = service.show('card');

    first();
    first(); // releasing twice is a no-op, not a second release
    expect(overlayIn(host)).not.toBeNull();

    second();
    expect(overlayIn(host)).toBeNull();
  });

  it('covers every element with the class, including one rendered after show()', async () => {
    setup();
    const other = document.createElement('section');
    other.className = 'card';
    document.body.appendChild(other);

    const release = service.show('late-card');
    const late = document.createElement('section');
    late.className = 'late-card';
    document.body.appendChild(late);
    await settle();

    expect(overlayIn(late)).not.toBeNull();

    service.show('card');
    expect(overlayIn(host)).not.toBeNull();
    expect(overlayIn(other)).not.toBeNull();

    release();
    expect(overlayIn(late)).toBeNull();
    late.remove();
    other.remove();
  });

  it('never shows the overlay when released within the delay', () => {
    vi.useFakeTimers();
    setup({ delay: 150, minDuration: 0 });

    const release = service.show(host);
    vi.advanceTimersByTime(100);
    release();
    vi.advanceTimersByTime(500);

    expect(overlayIn(host)).toBeNull();
    expect(host.hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps a shown overlay up for at least minDuration', () => {
    vi.useFakeTimers();
    setup({ delay: 0, minDuration: 400 });

    const release = service.show(host);
    vi.advanceTimersByTime(100);
    release();
    expect(overlayIn(host)).not.toBeNull();

    vi.advanceTimersByTime(300);
    expect(overlayIn(host)).toBeNull();
  });

  it('reports busy and per-target loading state', () => {
    setup();
    expect(service.busy()).toBe(false);

    const release = service.show('card');
    expect(service.busy()).toBe(true);
    expect(service.isLoading('card')).toBe(true);
    expect(service.isLoading(host)).toBe(false);

    release();
    expect(service.busy()).toBe(false);
  });
});
