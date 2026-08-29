import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Directionality } from '@angular/cdk/bidi';
import { EMPTY } from 'rxjs';
import { PanelResizeDirective } from './panel-resize.directive';

@Component({
  imports: [PanelResizeDirective],
  template: `<div
    panelResize
    [axis]="axis()"
    [keyStep]="step()"
    (resizeStart)="log.push('start')"
    (resize)="log.push($event)"
    (resizeEnd)="log.push('end')"
  ></div>`,
})
class HostComponent {
  readonly axis = signal<'x' | 'y'>('x');
  readonly step = signal(24);
  readonly log: (string | number)[] = [];
}

function mount(rtl = false) {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: rtl
      ? [{ provide: Directionality, useValue: { value: 'rtl', change: EMPTY } }]
      : [],
  });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[panelResize]')!;
  return { fixture, el, host: fixture.componentInstance };
}

function pointer(type: string, coords: { clientX?: number; clientY?: number }): PointerEvent {
  const e = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(e, 'clientX', { value: coords.clientX ?? 0 });
  Object.defineProperty(e, 'clientY', { value: coords.clientY ?? 0 });
  return e;
}

describe('PanelResizeDirective', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('wires the window-splitter ARIA per axis', () => {
    const { el, host, fixture } = mount();
    expect(el.getAttribute('role')).toBe('separator');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-orientation')).toBe('vertical'); // axis 'x'

    host.axis.set('y');
    fixture.detectChanges();
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('emits start → signed px delta → end for a pointer drag along the x axis', () => {
    const { el, host } = mount();
    el.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 130 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 70 }));
    document.dispatchEvent(pointer('pointerup', {}));
    expect(host.log).toEqual(['start', 30, -30, 'end']);

    // listener detached on pointerup
    document.dispatchEvent(pointer('pointermove', { clientX: 999 }));
    expect(host.log).toEqual(['start', 30, -30, 'end']);
  });

  it('uses clientY for the y axis', () => {
    const { el, host, fixture } = mount();
    host.axis.set('y');
    fixture.detectChanges();
    el.dispatchEvent(pointer('pointerdown', { clientY: 200 }));
    document.dispatchEvent(pointer('pointermove', { clientY: 260 }));
    document.dispatchEvent(pointer('pointerup', {}));
    expect(host.log).toEqual(['start', 60, 'end']);
  });

  it('arrow keys emit a keyStep delta through the same sequence, cross-axis keys ignored', () => {
    const { el, host, fixture } = mount();
    fixture.detectChanges();
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    el.dispatchEvent(right);
    expect(host.log).toEqual(['start', 24, 'end']);
    expect(right.defaultPrevented).toBe(true);

    host.log.length = 0;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    expect(host.log).toEqual(['start', -24, 'end']);

    host.log.length = 0;
    const up = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    el.dispatchEvent(up); // cross-axis for 'x'
    expect(host.log).toEqual([]);
    expect(up.defaultPrevented).toBe(false);
  });

  it('respects keyStep', () => {
    const { el, host, fixture } = mount();
    host.step.set(10);
    fixture.detectChanges();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
    expect(host.log).toEqual(['start', 10, 'end']);
  });

  it('negates the x-axis delta under RTL (pointer and keyboard); y unaffected', () => {
    const { el, host } = mount(true);
    el.dispatchEvent(pointer('pointerdown', { clientX: 100 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 140 }));
    document.dispatchEvent(pointer('pointerup', {}));
    expect(host.log).toEqual(['start', -40, 'end']);

    host.log.length = 0;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
    expect(host.log).toEqual(['start', -24, 'end']);
  });
});
