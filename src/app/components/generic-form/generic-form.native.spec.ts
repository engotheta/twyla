import { ANIMATION_MODULE_TYPE, Component, Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { map, tap, timer } from 'rxjs';
import { FormEngineService, FormInstance } from './form-engine.service';
import { GenericFormComponent } from './generic-form.component';
import { FieldType } from './interfaces/field-type.interface';
import { FormParameter } from './interfaces/form-parameter.interface';
import { VALIDATOR_REQUIRED } from './validators';

@Component({
  imports: [GenericFormComponent],
  template: `<generic-form [params]="params" (instanceChange)="instance = $event" />`,
})
class HostComponent {
  params!: FormParameter;
  instance?: FormInstance;
}

describe('GenericFormComponent — sign-in style forms', () => {
  let fixture: ComponentFixture<HostComponent>;
  let finishSubmit: () => void;
  const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finishSubmit = resolve)));

  const signIn = (overrides: Partial<FormParameter> = {}): FormParameter => ({
    nativeForm: true,
    submitButtonLabel: 'Sign in',
    fields: [
      { type: FieldType.input, key: 'username', validations: [VALIDATOR_REQUIRED] },
      {
        type: FieldType.input,
        key: 'password',
        inputType: 'password',
        validations: [VALIDATOR_REQUIRED],
      },
    ],
    onSubmit,
    ...overrides,
  });

  const element = <T extends Element>(selector: string) =>
    fixture.nativeElement.querySelector(selector) as T;

  const type = (selector: string, value: string) => {
    const input = element<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    TestBed.tick();
  };

  function render(params: FormParameter): void {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.params = params;
    fixture.detectChanges();
  }

  beforeEach(() => {
    onSubmit.mockClear();
  });

  it('nativeForm renders a real <form> whose submit button is type="submit"', () => {
    render(signIn());
    const button = element<HTMLButtonElement>('form button[type="submit"]');
    expect(element('form')).toBeTruthy();
    expect(button.textContent).toContain('Sign in');
  });

  it('leaves other forms as they were: no <form>, a type="button" submit', () => {
    render(signIn({ nativeForm: undefined }));
    expect(element('form')).toBeNull();
    const submit = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Sign in'));
    expect(submit?.type).toBe('button');
  });

  it('submits once while busy; the button stays focusable but reads as disabled', async () => {
    render(signIn());
    type('input[type="text"]', 'ada');
    type('input[type="password"]', 'secret');

    element('form').dispatchEvent(new Event('submit'));
    await settle();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]).toEqual([
      { username: 'ada', password: 'secret' },
      expect.anything(),
    ]);
    expect(fixture.componentInstance.instance?.submitting()).toBe(true);
    const button = element<HTMLButtonElement>('button[type="submit"]');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(button.querySelector('mat-progress-spinner')).toBeTruthy();

    element('form').dispatchEvent(new Event('submit')); // impatient Enter
    await settle();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    finishSubmit();
    await settle();
    expect(fixture.componentInstance.instance?.submitting()).toBe(false);
    expect(button.querySelector('mat-progress-spinner')).toBeNull();
  });

  it('an invalid submit takes focus to the first field to fix', async () => {
    render(signIn());
    type('input[type="text"]', 'ada');

    element('form').dispatchEvent(new Event('submit'));
    await settle();
    await settle();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(element('input[type="password"]'));
    // the untouched field shows its message too (markAllAsTouched only emits a touched event)
    expect(element('mat-error')?.textContent).toContain('This field is required');
  });

  it('a password field has a "Show password" toggle', async () => {
    render(signIn());
    const toggle = element<HTMLButtonElement>('button[aria-label="Show password"]');
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    await settle();
    expect(element<HTMLInputElement>('input[type="password"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('input[type="text"]')).toHaveLength(2);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('revealable: false drops the toggle', () => {
    render({
      nativeForm: true,
      fields: [{ type: FieldType.input, key: 'pin', inputType: 'password', revealable: false }],
    });
    expect(element('button[aria-label="Show password"]')).toBeNull();
  });
});

describe('FormInstance.submit()', () => {
  it('awaits an Observable onSubmit and reports it in `submitting`', async () => {
    TestBed.configureTestingModule({});
    let saved = false;
    const instance = TestBed.inject(FormEngineService).build(
      signal<FormParameter>({
        fields: [{ type: FieldType.input, key: 'name', value: 'Ada' }],
        onSubmit: () =>
          timer(5).pipe(
            tap(() => (saved = true)),
            map(() => 'ok'),
          ),
      }),
      TestBed.inject(Injector),
    );

    const done = instance.submit();
    expect(instance.submitting()).toBe(true);
    await expect(done).resolves.toEqual({ name: 'Ada' });
    expect(saved).toBe(true);
    expect(instance.submitting()).toBe(false);
  });

  it('resets `submitting` when onSubmit throws', async () => {
    TestBed.configureTestingModule({});
    const instance = TestBed.inject(FormEngineService).build(
      signal<FormParameter>({
        fields: [{ type: FieldType.input, key: 'name', value: 'Ada' }],
        onSubmit: () => Promise.reject(new Error('offline')),
      }),
      TestBed.inject(Injector),
    );

    await expect(instance.submit()).rejects.toThrow('offline');
    expect(instance.submitting()).toBe(false);
  });
});
