import { TestBed } from '@angular/core/testing';
import { Validators } from '@angular/forms';
import { FieldType } from './field-type.interface';
import { observe } from './dynamic.interface';
import { FormEngineService, FormInstance } from './form-engine.service';
import { FormParameters } from './form-parameters.interface';
import { GenericFormComponent } from './generic-form.component';

describe('FormEngineService (logic)', () => {
  let engine: FormEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(FormEngineService);
  });

  it('includes hidden and disabled fields on submit by default', async () => {
    const params: FormParameters<Record<string, unknown>> = {
      fields: [
        { type: FieldType.input, key: 'name', value: 'Ada' },
        { type: FieldType.input, key: 'secret', value: 'shh', visible: false },
        { type: FieldType.input, key: 'locked', value: 'fixed', disabled: true },
      ],
    };
    const instance = engine.build(params);
    const value = await instance.submitValue();
    expect(value).toEqual({ name: 'Ada', secret: 'shh', locked: 'fixed' });
  });

  it('excludeHiddenOnSubmit drops the field while hidden', async () => {
    const params: FormParameters<Record<string, unknown>> = {
      fields: [{ type: FieldType.input, key: 'secret', value: 'shh', visible: false, excludeHiddenOnSubmit: true }],
    };
    const instance = engine.build(params);
    const value = await instance.submitValue();
    expect(value).toEqual({});
  });

  it('seeds initial values from params.model', () => {
    const params: FormParameters<Record<string, unknown>> = {
      model: { name: 'Grace', address: { city: 'NYC' } },
      fields: [
        { type: FieldType.input, key: 'name' },
        {
          type: FieldType.object,
          key: 'address',
          fields: [{ type: FieldType.input, key: 'city' }, { type: FieldType.input, key: 'zip' }],
        },
      ],
    };
    const instance = engine.build(params);
    expect(instance.form.getRawValue()).toEqual({ name: 'Grace', address: { city: 'NYC', zip: null } });
  });

  it('resolves Dynamic (observe) props, including cascades', async () => {
    const params: FormParameters<Record<string, unknown>> = {
      fields: [
        { type: FieldType.select, key: 'country', value: 'us', options: [] },
        {
          type: FieldType.select,
          key: 'city',
          options: observe('country', (country: string) => (country === 'us' ? [{ label: 'NYC', value: 'nyc' }] : [])),
          visible: observe('country', (country: string) => !!country),
        },
      ],
    };
    const instance = engine.build(params);
    await Promise.resolve(); // observer resolution is wrapped in a microtask (SPEC §1)
    await Promise.resolve();

    const cityField = instance.fields.find((f) => f.key === 'city')!;
    const state = instance.fieldState(cityField)();
    expect((state as { options: unknown[] }).options).toEqual([{ label: 'NYC', value: 'nyc' }]);
    expect(state.visible).toBe(true);
  });

  describe('isList object fields', () => {
    let instance: FormInstance;
    const params = (): FormParameters<Record<string, unknown>> => ({
      fields: [
        {
          type: FieldType.object,
          key: 'contacts',
          isList: true,
          // isList value is V[] at runtime; see the type-gap note on ValueField.value
          value: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] as unknown as Record<string, unknown>,
          fields: [{ type: FieldType.input, key: 'name' }, { type: FieldType.input, key: 'phone' }],
        },
      ],
    });

    beforeEach(() => {
      instance = engine.build(params());
    });

    it('gives each initial item its own control at the right index (not a shared/colliding one)', () => {
      expect(instance.form.getRawValue()).toEqual({
        contacts: [{ name: 'A', phone: null }, { name: 'B', phone: null }, { name: 'C', phone: null }],
      });

      const contactsField = instance.fields.find((f) => f.key === 'contacts')!;
      const item1Fields = instance.listItemFields(contactsField, 1);
      const nameControl = instance.control(item1Fields.find((f) => f.key === 'name')!);
      nameControl?.setValue('B-edited');
      expect(instance.form.getRawValue()).toEqual({
        contacts: [{ name: 'A', phone: null }, { name: 'B-edited', phone: null }, { name: 'C', phone: null }],
      });
    });

    it('reindexes remaining items after removing a middle item', () => {
      instance.removeListItem('contacts', 1); // remove 'B'
      expect(instance.form.getRawValue()).toEqual({
        contacts: [{ name: 'A', phone: null }, { name: 'C', phone: null }],
      });

      const contactsField = instance.fields.find((f) => f.key === 'contacts')!;
      const item1Fields = instance.listItemFields(contactsField, 1); // now 'C', was index 2
      const nameField = item1Fields.find((f) => f.key === 'name')!;
      expect(nameField.path).toBe('contacts.1.name');
      instance.control(nameField)?.setValue('C-edited');
      expect(instance.form.getRawValue()).toEqual({
        contacts: [{ name: 'A', phone: null }, { name: 'C-edited', phone: null }],
      });
    });

    it('addListItem appends a correctly-wired new item', () => {
      instance.addListItem('contacts');
      expect((instance.form.getRawValue() as { contacts: unknown[] }).contacts.length).toBe(4);

      const contactsField = instance.fields.find((f) => f.key === 'contacts')!;
      const newItemFields = instance.listItemFields(contactsField, 3);
      instance.control(newItemFields.find((f) => f.key === 'name')!)?.setValue('D');
      expect((instance.form.getRawValue() as { contacts: { name: string }[] }).contacts[3].name).toBe('D');
    });
  });

  it('required marker check: sync validators run and block submit', async () => {
    const params: FormParameters<Record<string, unknown>> = {
      fields: [
        {
          type: FieldType.input,
          key: 'name',
          validations: [{ name: 'required', validator: Validators.required, message: 'Required' }],
        },
      ],
    };
    const instance = engine.build(params);
    const value = await instance.submitValue();
    expect(value).toBeNull();
    expect(instance.form.get('name')?.touched).toBe(true);
  });
});

describe('GenericFormComponent (render)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GenericFormComponent],
    });
  });

  it('mounts a form mixing every field type without throwing (circular-import / NG0919 guard)', async () => {
    const params: FormParameters<Record<string, unknown>> = {
      fields: [
        { type: FieldType.input, key: 'name' },
        { type: FieldType.checkbox, key: 'subscribe' },
        { type: FieldType.toggle, key: 'darkMode' },
        { type: FieldType.select, key: 'country', options: [{ label: 'USA', value: 'us' }] },
        { type: FieldType.textarea, key: 'bio' },
        { type: FieldType.date, key: 'birthday' },
        { type: FieldType.color, key: 'favColor' },
        { type: FieldType.attachment, key: 'avatar' },
        { type: FieldType.content, value: 'hello' },
        { type: FieldType.label, value: 'a label' },
        {
          type: FieldType.object,
          key: 'address',
          collapsible: true,
          fields: [{ type: FieldType.input, key: 'street' }],
        },
        {
          type: FieldType.object,
          key: 'contacts',
          isList: true,
          minItems: 1,
          fields: [{ type: FieldType.input, key: 'name' }],
        },
      ],
      onSubmit: () => undefined,
    };

    const fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', params);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('app-object-field');
    expect(html).toContain('app-input-field');
    expect(html).toContain('app-boolean-field');
    expect(html).toContain('app-select-field');
  });

  it('typing into an input reaches the underlying control (signals wiring works end to end)', async () => {
    const params: FormParameters<Record<string, unknown>> = {
      fields: [{ type: FieldType.input, key: 'name' }],
    };
    const fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', params);
    fixture.detectChanges();
    await fixture.whenStable();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'Ada Lovelace';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const instance = (fixture.componentInstance as unknown as { instance: FormInstance }).instance;
    expect(instance.form.get('name')?.value).toBe('Ada Lovelace');
  });

  it('clicking Add on a list-of-objects renders a new item row', async () => {
    const params: FormParameters<Record<string, unknown>> = {
      fields: [
        {
          type: FieldType.object,
          key: 'contacts',
          isList: true,
          fields: [{ type: FieldType.input, key: 'name' }],
        },
      ],
    };
    const fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', params);
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input').length).toBe(0);

    const addButton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.getAttribute('aria-label')?.startsWith('Add'),
    ) as HTMLButtonElement;
    expect(addButton).toBeTruthy();
    addButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input').length).toBe(1);
  });
});
