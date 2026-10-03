import { ANIMATION_MODULE_TYPE, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, Subject } from 'rxjs';
import { MULTI_EVENT_WINDOW_MS, ViewService } from './view.service';

@Component({
  selector: 'probe',
  template: `<p class="probe">probe {{ params()?.label }}</p>`,
})
class ProbeComponent {
  readonly params = input<{ label?: string; title?: string; icon?: string }>();
}

@Component({
  selector: 'dialog-aware-probe',
  template: `<button type="button" class="finish" (click)="dialogRef()?.close('done')">finish</button>`,
})
class DialogAwareProbeComponent {
  readonly dialogRef = input<MatDialogRef<unknown>>();
}

describe('ViewService — dialogs', () => {
  let view: ViewService;

  const overlay = () => document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  const button = (text: string) =>
    Array.from(overlay().querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Material dialogs open and close synchronously instead of on animation timers
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
    view = TestBed.inject(ViewService);
  });

  afterEach(() => view.closeAll());

  it('hosts a component with its inputs under a title bar taken from params.title', () => {
    view.open(ProbeComponent, { inputs: { params: { label: 'x', title: 'From params' } } });
    TestBed.tick();

    expect(overlay().querySelector('.probe')?.textContent).toContain('probe x');
    expect(overlay().querySelector('h2')?.textContent).toContain('From params');
    expect(overlay().querySelector('button[aria-label="Close dialog"]')).toBeTruthy();
  });

  it('an explicit title wins; with no title and showClose: false there is no title bar', async () => {
    const titled = view.open(ProbeComponent, {
      title: 'Explicit',
      inputs: { params: { title: 'Ignored' } },
    });
    TestBed.tick();
    expect(overlay().querySelector('h2')?.textContent).toContain('Explicit');
    titled.close();
    await firstValueFrom(titled.afterClosed());

    view.open(ProbeComponent, { showClose: false });
    TestBed.tick();
    expect(overlay().querySelector('h2')).toBeNull();
    expect(overlay().querySelector('button[aria-label="Close dialog"]')).toBeNull();
    expect(overlay().querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Dialog');
  });

  it('binds its ref to a hosted component that declares a dialogRef input — and only then', async () => {
    const errors = vi.spyOn(console, 'error');
    view.open(ProbeComponent); // no `dialogRef` input: nothing extra is set on it
    TestBed.tick();
    expect(errors).not.toHaveBeenCalled();

    const ref = view.open(DialogAwareProbeComponent);
    TestBed.tick();
    button('finish').click();
    expect(await firstValueFrom(ref.afterClosed())).toBe('done');
  });

  it('openModal binds params to the params input and sizes the dialog', () => {
    view.openModal(ProbeComponent, { label: 'y' }, '300px');
    TestBed.tick();

    expect(overlay().querySelector('.probe')?.textContent).toContain('probe y');
    expect(overlay().querySelector<HTMLElement>('.cdk-overlay-pane')!.style.width).toBe('300px');
  });

  it('closes on the first closeAction$ emission', async () => {
    const close$ = new Subject<void>();
    const ref = view.open(ProbeComponent, { closeAction$: close$ });
    TestBed.tick();

    close$.next();
    await firstValueFrom(ref.afterClosed());
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
  });

  it('confirm() resolves true on Confirm, false on Cancel', async () => {
    const yes = view.confirm({ message: 'Sure?' });
    TestBed.tick();
    expect(overlay().textContent).toContain('Sure?');
    button('Confirm').click();
    expect(await yes).toBe(true);

    const no = view.confirm({ message: 'Really?' });
    TestBed.tick();
    button('Cancel').click();
    expect(await no).toBe(false);
  });

  it('closeTopDialog closes only the most recent dialog', async () => {
    view.open(ProbeComponent, { inputs: { params: { label: 'first' } } });
    const top = view.open(ProbeComponent, { inputs: { params: { label: 'second' } } });
    TestBed.tick();

    view.closeTopDialog();
    await firstValueFrom(top.afterClosed());
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
  });
});

describe('ViewService — multi-click helpers', () => {
  let view: ViewService;

  beforeEach(() => {
    vi.useFakeTimers();
    view = TestBed.inject(ViewService);
  });

  afterEach(() => vi.useRealTimers());

  it('onMultiClick fires once the threshold is reached in one quick run', () => {
    const callback = vi.fn();
    view.onMultiClick(callback, 3, 'a');
    view.onMultiClick(callback, 3, 'a');
    expect(callback).not.toHaveBeenCalled();

    view.onMultiClick(callback, 3, 'a');
    expect(callback).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('a pause as long as the window ends the run', () => {
    const callback = vi.fn();
    view.onMultiClick(callback, 3);
    view.onMultiClick(callback, 3);
    vi.advanceTimersByTime(MULTI_EVENT_WINDOW_MS);
    view.onMultiClick(callback, 3);
    expect(callback).not.toHaveBeenCalled();

    view.onMultiClick(callback, 3);
    view.onMultiClick(callback, 3);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('an event for a different input starts a new run', () => {
    const callback = vi.fn();
    view.onMultiClick(callback, 3, 'a');
    view.onMultiClick(callback, 3, 'a');
    view.onMultiClick(callback, 3, 'b');
    expect(callback).not.toHaveBeenCalled();

    view.onMultiClick(callback, 3, 'b');
    view.onMultiClick(callback, 3, 'b');
    expect(callback).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('onMultipleEvent runs the action whose threshold is closest to the count, once reached', async () => {
    const once = vi.fn();
    const seven = vi.fn();
    const actions = [
      { callback: once, threshold: 1 },
      { callback: seven, threshold: 7 },
    ];

    for (let i = 0; i < 3; i++) view.onMultipleEvent<string>(actions, 'row');
    expect(once).not.toHaveBeenCalled(); // the run hasn't ended yet
    await vi.advanceTimersByTimeAsync(MULTI_EVENT_WINDOW_MS);
    expect(once).toHaveBeenCalledExactlyOnceWith('row'); // 3 is closer to 1 than to 7

    for (let i = 0; i < 5; i++) view.onMultipleEvent<string>(actions, 'row');
    await vi.advanceTimersByTimeAsync(MULTI_EVENT_WINDOW_MS);
    expect(once).toHaveBeenCalledTimes(1); // 5 is closer to 7, which it didn't reach
    expect(seven).not.toHaveBeenCalled();
  });

  it('reaching the highest threshold runs at once — tuples and callbackInput included', async () => {
    const seven = vi.fn();
    for (let i = 0; i < 7; i++) {
      view.onMultipleEvent<string>(
        [
          [vi.fn(), 1],
          [seven, 7, 'override'],
        ],
        'event',
      );
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(seven).toHaveBeenCalledExactlyOnceWith('override');
  });

  it('queryMapFunction maps the input before the callback', async () => {
    const callback = vi.fn();
    view.onMultipleEvent<number>(
      [{ callback, queryMapFunction: async (id?: number) => (id ?? 0) * 10 }],
      4,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenCalledExactlyOnceWith(40);
  });

  it('delayedExecution runs only once the calls stop for its delay', () => {
    const callback = vi.fn();
    view.delayedExecution(callback, 100);
    vi.advanceTimersByTime(50);
    view.delayedExecution(callback, 100);

    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
