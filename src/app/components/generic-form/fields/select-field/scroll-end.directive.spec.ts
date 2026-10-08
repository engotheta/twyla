import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollEndDirective } from './scroll-end.directive';

/** the browser's observer, as far as the directive uses it — with a way to say what it saw */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  see(isIntersecting: boolean): void {
    const entry = { isIntersecting } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
}

@Component({
  imports: [ScrollEndDirective],
  template: `<div scrollEnd [scrollEndKey]="count()" (scrollEnd)="reached = reached + 1"></div>`,
})
class HostComponent {
  readonly count = signal(0);
  reached = 0;
}

describe('ScrollEndDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const observer = () => FakeIntersectionObserver.instances[0];

  function render(): void {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('watches its element, and emits each time it comes into view', () => {
    render();
    const element = (fixture.nativeElement as HTMLElement).querySelector('div');
    expect(observer().observe).toHaveBeenCalledWith(element);

    observer().see(false);
    expect(fixture.componentInstance.reached).toBe(0);

    observer().see(true);
    observer().see(true);
    expect(fixture.componentInstance.reached).toBe(2);
  });

  it('watches anew when its key changes, so an end still in view is reported again', () => {
    render();
    expect(observer().observe).toHaveBeenCalledTimes(1);

    fixture.componentInstance.count.set(25);
    fixture.detectChanges();

    expect(observer().unobserve).toHaveBeenCalledTimes(2);
    expect(observer().observe).toHaveBeenCalledTimes(2);
  });

  it('stops watching when it is destroyed', () => {
    render();
    fixture.destroy();
    expect(observer().disconnect).toHaveBeenCalled();
  });

  it('does nothing where the browser has no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() => render()).not.toThrow();
  });
});
