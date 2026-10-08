import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShortcutsService } from '@services/shortcuts/shortcuts.service';
import { FormInstance } from './form-engine.service';
import { GenericFormComponent } from './generic-form.component';
import { FieldType } from './interfaces/field-type.interface';
import { FormParameter } from './interfaces/form-parameter.interface';
import { VALIDATOR_REQUIRED } from './validators';

describe('the generic form answers its shortcuts', () => {
  let fixture: ComponentFixture<GenericFormComponent>;
  let service: ShortcutsService;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function mount(params: FormParameter): Promise<void> {
    TestBed.configureTestingModule({
      imports: [GenericFormComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
    service = TestBed.inject(ShortcutsService);
    fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', params);
    await settle();
  }

  const host = () => fixture.nativeElement as HTMLElement;
  const instance = () =>
    (fixture.componentInstance as unknown as { instance: FormInstance }).instance;
  const press = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  const arm = (): void => {
    for (let i = 0; i < service.presses; i++) press('f');
  };
  const ids = () => (service.hint()?.shortcuts ?? []).map((row) => row.id);
  const field = () => host().querySelector('mat-form-field')!;

  const PLAIN: FormParameter = {
    title: 'New employee',
    fields: [{ type: FieldType.input, key: 'name', validations: [VALIDATOR_REQUIRED] }],
  };
  const STEPPED: FormParameter = {
    fields: [
      { type: FieldType.step, label: 'One', fields: [{ type: FieldType.input, key: 'a' }] },
      { type: FieldType.step, label: 'Two', fields: [{ type: FieldType.input, key: 'b' }] },
    ],
  };

  afterEach(() => service.close());

  it('F, six times, lists them under the form’s title — the steps’ only where it has steps', async () => {
    await mount(PLAIN);
    arm();

    expect(service.hint()!.title).toBe('Form: New employee');
    expect(ids()).toEqual(['filled', 'hints', 'firstInvalid']);
  });

  it('redraws the fields on a key, and keeps what was typed in them', async () => {
    await mount(PLAIN);
    instance().form.get('name')!.setValue('Ada');
    const control = instance().form.get('name');
    expect(field().classList).toContain('mat-form-field-appearance-outline');
    arm();

    press('a');
    await settle();
    expect(field().classList).toContain('mat-form-field-appearance-fill');

    press('h');
    await settle();
    expect(field().classList).toContain('hide-subscript');

    // the same control, with its value: the engine had nothing to rebuild
    expect(instance().form.get('name')).toBe(control);
    expect(control!.value).toBe('Ada');
  });

  it('goes back to the form as it was set up on 0', async () => {
    await mount(PLAIN);
    arm();
    press('a');
    await settle();
    expect(ids()).toContain('reset');

    press('0');
    await settle();
    expect(field().classList).toContain('mat-form-field-appearance-outline');
    expect(ids()).not.toContain('reset');
  });

  it('walks the steps, and lays them down the side', async () => {
    await mount(STEPPED);
    const selected = () =>
      Array.from(host().querySelectorAll('mat-step-header')).findIndex(
        (header) => header.getAttribute('aria-selected') === 'true',
      );
    arm();
    expect(ids()).toEqual(['filled', 'hints', 'vertical', 'linear', 'nextStep', 'firstInvalid']);

    press('n');
    await settle();
    expect(selected()).toBe(1);
    expect(ids()).toContain('previousStep');
    expect(ids()).not.toContain('nextStep');

    press('p');
    await settle();
    expect(selected()).toBe(0);

    press('o');
    await settle();
    expect(host().querySelector('.mat-stepper-vertical')).toBeTruthy();
  });

  it('shows the errors and goes to the first field to fix, closing the hint', async () => {
    await mount(PLAIN);
    arm();

    press('i');
    await settle();

    expect(service.hint()).toBeNull();
    expect(instance().form.get('name')!.touched).toBe(true);
    expect(document.activeElement).toBe(host().querySelector('input'));
  });

  it('has no shortcut that submits or empties the form', async () => {
    await mount(STEPPED);
    arm();
    expect(ids().join(' ').toLowerCase()).not.toMatch(/submit|clear|empty/);
  });

  it('stays as configured when its params say `shortcuts: false`', async () => {
    await mount({ ...PLAIN, shortcuts: false });
    arm();
    expect(service.hint()).toBeNull();
  });
});
