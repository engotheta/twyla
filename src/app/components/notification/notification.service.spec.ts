import { LiveAnnouncer } from '@angular/cdk/a11y';
import { effect, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideToastConfig } from './toast-config.token';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toasts: ToastService;
  let announce: ReturnType<typeof vi.fn>;

  const messages = () => toasts.toasts().map((toast) => toast.message);

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideToastConfig({ maxVisible: 3 })] });
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.overrideProvider(LiveAnnouncer, { useValue: { announce } });
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => {
    toasts.clear();
    vi.useRealTimers();
  });

  it('auto-dismisses each type after its own duration', () => {
    toasts.success('Saved');
    toasts.error('Failed');

    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual(['Failed']);

    vi.advanceTimersByTime(4000);
    expect(messages()).toEqual([]);
  });

  it('keeps a toast with duration 0 until it is dismissed', () => {
    const id = toasts.info('Sticky', { duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(messages()).toEqual(['Sticky']);

    toasts.dismiss(id);
    expect(messages()).toEqual([]);
  });

  it('pauses auto-dismiss and resumes with the time that was left', () => {
    toasts.success('Saved');
    vi.advanceTimersByTime(3000);

    toasts.pause();
    vi.advanceTimersByTime(10_000);
    expect(messages()).toEqual(['Saved']);

    toasts.resume();
    vi.advanceTimersByTime(999);
    expect(messages()).toEqual(['Saved']);
    vi.advanceTimersByTime(1);
    expect(messages()).toEqual([]);
  });

  it('refreshes an identical visible toast instead of stacking a second one', () => {
    const first = toasts.error('Offline');
    vi.advanceTimersByTime(6000);
    const second = toasts.error('Offline');

    expect(second).toBe(first);
    expect(messages()).toEqual(['Offline']);

    vi.advanceTimersByTime(6000); // would have expired on the first timer
    expect(messages()).toEqual(['Offline']);
  });

  it('drops the oldest toasts beyond maxVisible', () => {
    ['one', 'two', 'three', 'four'].forEach((message) => toasts.info(message));
    expect(messages()).toEqual(['two', 'three', 'four']);
  });

  it('announces errors assertively and everything else politely', () => {
    toasts.error('Failed');
    toasts.success('Saved');

    expect(announce).toHaveBeenCalledWith('Failed', 'assertive');
    expect(announce).toHaveBeenCalledWith('Saved', 'polite');
  });

  it('can be called from an effect without the toast list becoming its dependency', () => {
    const trigger = signal(0);
    let runs = 0;
    TestBed.runInInjectionContext(() =>
      effect(() => {
        trigger();
        runs++;
        toasts.info('From an effect');
      }),
    );
    TestBed.tick();

    toasts.info('Unrelated');
    TestBed.tick();

    expect(runs).toBe(1);
  });

  it('renders the stack as a labelled region whose dismiss button removes the toast', () => {
    toasts.info('Hello');
    TestBed.tick();

    const stack = document.querySelector('toast-stack');
    expect(stack?.getAttribute('role')).toBe('region');
    expect(stack?.getAttribute('aria-label')).toBe('Notifications');
    expect(stack?.textContent).toContain('Hello');

    stack?.querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]')?.click();
    expect(messages()).toEqual([]);
  });
});
