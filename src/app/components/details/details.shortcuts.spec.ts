import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShortcutsService } from '@services/shortcuts/shortcuts.service';
import { DetailsComponent } from './details.component';
import { DetailsParameter } from './interfaces/details.interface';

describe('the details component answers its shortcuts', () => {
  let fixture: ComponentFixture<DetailsComponent>;
  let service: ShortcutsService;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function mount(params: DetailsParameter): Promise<void> {
    TestBed.configureTestingModule({
      imports: [DetailsComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
    service = TestBed.inject(ShortcutsService);
    fixture = TestBed.createComponent(DetailsComponent) as ComponentFixture<DetailsComponent>;
    fixture.componentRef.setInput('params', params);
    await settle();
  }

  const press = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  const arm = (): void => {
    for (let i = 0; i < service.presses; i++) press('d');
  };
  /** the hint's rows, by id: where each shortcut stands */
  const states = (): Record<string, string | undefined> =>
    Object.fromEntries((service.hint()?.shortcuts ?? []).map((row) => [row.id, row.state]));
  /** what is rendered, with each element's classes in one order: a re-render may shuffle them */
  const html = () =>
    (fixture.nativeElement as HTMLElement).innerHTML.replace(
      /class="([^"]*)"/g,
      (_, classes: string) => `class="${classes.split(/\s+/).sort().join(' ')}"`,
    );

  const ENTITY = { name: 'Ada', role: 'Engineer', tags: ['a', 'b'], nickname: undefined };

  afterEach(() => service.close());

  it('D, six times, lists them: a layout per digit, the one in use marked', async () => {
    await mount({ entity: ENTITY, header: { title: 'Employee' } });

    arm();

    expect(service.hint()!.title).toBe('Details: Employee');
    expect(states()).toMatchObject({
      list: 'on',
      inlineList: 'off',
      table: 'off',
      palettes: 'off',
    });
  });

  it('lays the entity out anew on a digit, and goes back on 0', async () => {
    await mount({ entity: ENTITY });
    const asList = html();
    arm();

    press('3');
    await settle();
    expect(states()).toMatchObject({ list: 'off', table: 'on' });
    expect(html()).not.toBe(asList);

    press('0');
    await settle();
    expect(states()['list']).toBe('on');
    expect(html()).toBe(asList);
  });

  it('starts from the layout the params ask for', async () => {
    await mount({ entity: ENTITY, layout: 'table' });
    arm();
    expect(states()).toMatchObject({ list: 'off', table: 'on' });
  });

  it('offers groups in tabs only where there are several groups', async () => {
    // plain values only: one group
    await mount({ entity: { name: 'Ada', role: 'Engineer' } });
    arm();
    expect(states()).not.toHaveProperty('tabs');
    service.close();

    // a list beside them makes a second group
    fixture.componentRef.setInput('params', { entity: ENTITY } satisfies DetailsParameter);
    await settle();
    arm();
    expect(states()['tabs']).toBe('off');

    press('t');
    await settle();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]')).toBeTruthy();
  });

  it('offers back-to-setup only once something was switched', async () => {
    await mount({ entity: ENTITY });
    arm();
    expect(states()).not.toHaveProperty('reset');

    press('e');
    await settle();
    expect(states()).toHaveProperty('reset');
    expect(states()['expandLists']).toBe('on');
  });

  it('has no shortcut for what was hidden on purpose', async () => {
    await mount({ entity: ENTITY });
    arm();
    const ids = Object.keys(states()).join(' ').toLowerCase();
    expect(ids).not.toContain('sensitive');
    expect(ids).not.toContain('hidden');
  });

  it('stays as configured when its params say `shortcuts: false`', async () => {
    await mount({ entity: ENTITY, shortcuts: false });
    arm();
    expect(service.hint()).toBeNull();
  });
});
