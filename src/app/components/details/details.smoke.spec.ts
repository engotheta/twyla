import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { DetailsComponent } from './details.component';
import { DetailsParameter } from './detail.interface';

describe('DetailsComponent — fetchFn', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DetailsComponent] });
  });

  function mount(parameter: DetailsParameter) {
    const fixture = TestBed.createComponent(DetailsComponent);
    fixture.componentRef.setInput('parameter', parameter);
    return fixture;
  }

  // `loading`/`error` are `protected` (render-facing internals, not part of DetailsComponent's
  // public contract) — this narrow accessor is test-only, doesn't widen the real API surface.
  function state(fixture: ReturnType<typeof mount>) {
    return fixture.componentInstance as unknown as {
      loading: () => boolean;
      error: () => unknown;
    };
  }

  it('resolves an Observable fetchFn into the rendered entity', async () => {
    const fixture = mount({ fetchFn: () => of({ name: 'Ada' }) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ada');
  });

  it('resolves a Promise fetchFn into the rendered entity', async () => {
    const fixture = mount({ fetchFn: () => Promise.resolve({ name: 'Grace' }) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Grace');
  });

  it('resolves a plain-value fetchFn into the rendered entity', async () => {
    const fixture = mount({ fetchFn: () => ({ name: 'Alan' }) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Alan');
  });

  it('falls back to a static entity while no fetchFn is set at all', async () => {
    const fixture = mount({ entity: { name: 'Static Sam' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Static Sam');
    expect(state(fixture).loading()).toBe(false);
  });

  it('sets loading true while pending and false once resolved, using a static entity as a fallback meanwhile', async () => {
    const subject = new Subject<{ name: string }>();
    const fixture = mount({ entity: { name: 'Fallback Fiona' }, fetchFn: () => subject });
    fixture.detectChanges();

    expect(state(fixture).loading()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Fallback Fiona');

    subject.next({ name: 'Resolved Rita' });
    subject.complete();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(state(fixture).loading()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Resolved Rita');
  });

  it('sets error when the fetchFn source errors, without throwing', async () => {
    const fixture = mount({ fetchFn: () => throwError(() => new Error('boom')) });
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(state(fixture).loading()).toBe(false);
    expect(state(fixture).error()).toBeInstanceOf(Error);
  });

  it("a dynamic field resolver (icon/class/tooltip) sees the FETCHED entity, not a stale/undefined one", async () => {
    const fixture = mount({
      fetchFn: () => of({ name: 'Vip Vince', vip: true }),
      fieldsProperties: {
        name: { icon: (entity: { vip?: boolean }) => (entity?.vip ? 'star' : 'person') },
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // proves the dynamic resolver received the FETCHED entity ({ vip: true }), not the
    // parameter's static/undefined entity — the bug the effectiveParameter() fix guards against
    expect((fixture.nativeElement as HTMLElement).innerHTML).toContain('star');
  });
});
