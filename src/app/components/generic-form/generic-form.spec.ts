import {
  ANIMATION_MODULE_TYPE,
  ApplicationRef,
  Component,
  Injector,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Validators } from '@angular/forms';
import { map, tap, timer } from 'rxjs';
import { FieldType } from './interfaces/field-type.interface';
import { observe } from './interfaces/dynamic.interface';
import { FormEngineService, FormInstance } from './form-engine.service';
import { FormField } from './interfaces/form-field.interface';
import { FormParameter } from './interfaces/form-parameter.interface';
import { ObjectField } from './interfaces/container-fields.interface';
import { GenericFormComponent } from './generic-form.component';
import { VALIDATOR_REQUIRED } from './validators';

describe('FormEngineService (logic)', () => {
  let engine: FormEngineService;
  let injector: Injector;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(FormEngineService);
    injector = TestBed.inject(Injector);
    appRef = TestBed.inject(ApplicationRef);
  });

  it('includes hidden and disabled fields on submit by default', async () => {
    const params: FormParameter<Record<string, unknown>> = {
      fields: [
        { type: FieldType.input, key: 'name', value: 'Ada' },
        { type: FieldType.input, key: 'secret', value: 'shh', visible: false },
        { type: FieldType.input, key: 'locked', value: 'fixed', disabled: true },
      ],
    };
    const instance = engine.build(signal(params), injector);
    const value = await instance.submitValue();
    expect(value).toEqual({ name: 'Ada', secret: 'shh', locked: 'fixed' });
  });

  it('excludeHiddenOnSubmit drops the field while hidden', async () => {
    const params: FormParameter<Record<string, unknown>> = {
      fields: [{ type: FieldType.input, key: 'secret', value: 'shh', visible: false, excludeHiddenOnSubmit: true }],
    };
    const instance = engine.build(signal(params), injector);
    const value = await instance.submitValue();
    expect(value).toEqual({});
  });

  it('seeds initial values from params.model', () => {
    const params: FormParameter<Record<string, unknown>> = {
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
    const instance = engine.build(signal(params), injector);
    expect(instance.form.getRawValue()).toEqual({ name: 'Grace', address: { city: 'NYC', zip: null } });
  });

  it('resolves Dynamic (observe) props, including cascades', async () => {
    const params: FormParameter<Record<string, unknown>> = {
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
    const instance = engine.build(signal(params), injector);
    await Promise.resolve(); // observer resolution is wrapped in a microtask (SPEC §1)
    await Promise.resolve();

    const cityField = instance.fields.find((f) => f.key === 'city')!;
    const state = instance.fieldState(cityField)();
    expect((state as { options: unknown[] }).options).toEqual([{ label: 'NYC', value: 'nyc' }]);
    expect(state.visible).toBe(true);
  });

  describe('isList object fields', () => {
    let instance: FormInstance;
    const params = (): FormParameter<Record<string, unknown>> => ({
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
      instance = engine.build(signal(params()), injector);
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

      // the removed item's own (now stale-pathed) field objects must not linger in `flat` —
      // a Map-only delete used to leave them behind, colliding with the reindexed survivor's
      // now-identical path
      expect(instance.fields.filter((f) => f.path === 'contacts.1.name').length).toBe(1);
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

  describe('isList: Dynamic<boolean> canAddItem + relative (./) observer paths', () => {
    it("canAddItem reacts to the list's own current value (not just a static flag)", async () => {
      const params: FormParameter<Record<string, unknown>> = {
        fields: [
          {
            type: FieldType.object,
            key: 'rows',
            isList: true,
            minItems: 1,
            value: [{ name: '' }] as unknown as Record<string, unknown>,
            canAddItem: observe('rows', (rows: { name: string }[]) => !!rows.at(-1)?.name),
            fields: [{ type: FieldType.input, key: 'name' }],
          },
        ],
      };
      const instance = engine.build(signal(params), injector);
      await Promise.resolve();
      await Promise.resolve();

      const rowsField = instance.fields.find((f) => f.key === 'rows')!;
      const canAddItem = () => (instance.fieldState(rowsField)() as { canAddItem?: boolean }).canAddItem;
      expect(canAddItem()).toBe(false);

      const item0Fields = instance.listItemFields(rowsField, 0);
      instance.control(item0Fields.find((f) => f.key === 'name')!)?.setValue('first');
      await Promise.resolve();
      await Promise.resolve();

      expect(canAddItem()).toBe(true);
    });

    it("'./sibling' resolves against the OBSERVING field's own isList item, independently per item", async () => {
      const params: FormParameter<Record<string, unknown>> = {
        fields: [
          {
            type: FieldType.object,
            key: 'rows',
            isList: true,
            value: [{ key: 'age' }, { key: 'name' }] as unknown as Record<string, unknown>,
            fields: [
              { type: FieldType.input, key: 'key' },
              { type: FieldType.input, key: 'label', value: observe('./key', (key: string) => `label-for-${key}`) },
            ],
          },
        ],
      };
      const instance = engine.build(signal(params), injector);
      await Promise.resolve();
      await Promise.resolve();

      expect(instance.form.getRawValue()).toEqual({
        rows: [
          { key: 'age', label: 'label-for-age' },
          { key: 'name', label: 'label-for-name' },
        ],
      });
    });
  });

  it('required marker check: sync validators run and block submit', async () => {
    const params: FormParameter<Record<string, unknown>> = {
      fields: [
        {
          type: FieldType.input,
          key: 'name',
          validations: [{ name: 'required', validator: Validators.required, message: 'Required' }],
        },
      ],
    };
    const instance = engine.build(signal(params), injector);
    const value = await instance.submitValue();
    expect(value).toBeNull();
    expect(instance.form.get('name')?.touched).toBe(true);
  });

  // The reconciliation effect (form-engine.service.ts SPEC §16) only actually runs when Angular
  // flushes pending effects — in a bare TestBed context (no component/view ever attached),
  // nothing does that automatically, not even after a real-time wait, so `appRef.tick()` is
  // called explicitly: once right after `build()` to flush its first (build-time) run BEFORE any
  // `paramsSig.set(...)` (otherwise that first run's own baseline capture races the test's own
  // `.set()` and silently coalesces both into one — Angular batches synchronous signal writes
  // between flushes, same reason the effect's own `firstReconcile` guard is safe in real usage:
  // a live app's regular per-CD-cycle flushing means this race is not reachable there), then
  // again after each `.set()` to actually trigger reconciliation.
  describe('params() reactivity', () => {
    function buildAndFlush<T extends Record<string, unknown>>(
      paramsSig: ReturnType<typeof signal<FormParameter<T>>>,
    ): FormInstance<T> {
      const instance = engine.build(paramsSig, injector);
      appRef.tick();
      return instance;
    }

    it('a user-typed control is never rebuilt by an unrelated params() re-emission', () => {
      const field = { type: FieldType.input, key: 'name' } as const;
      const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [field] });
      const instance = buildAndFlush(paramsSig);

      const control = instance.control(field);
      control?.setValue('Ada Lovelace');
      control?.markAsDirty();

      // same field reference, only a cosmetic prop changed — deliberately NOT the field-identity
      // scenario (that's the reconciliation test below)
      paramsSig.set({ fields: [field], showSubscript: false });
      appRef.tick();

      expect(instance.control(field)).toBe(control); // same control instance
      expect(instance.control(field)?.value).toBe('Ada Lovelace');
      expect(instance.control(field)?.dirty).toBe(true);
    });

    it('reconciles a fresh-reference-but-same-shape field on a later params() emission', () => {
      const originalField = { type: FieldType.input, key: 'name', value: 'Ada' } as const;
      const paramsSig = signal<FormParameter<Record<string, unknown>>>({
        fields: [originalField],
      });
      const instance = buildAndFlush(paramsSig);
      const originalControl = instance.control(originalField);
      originalControl?.setValue('Ada Lovelace');

      // fresh reference, same shape — what a computed() rebuilding its `fields` array on every
      // recompute hands back (e.g. grid-filter-panel's formParams, grid-cell's editFormParams)
      const newFieldRef = { ...originalField };
      paramsSig.set({ fields: [newFieldRef] });
      appRef.tick();

      expect(instance.control(newFieldRef)).toBeDefined();
      expect(instance.control(newFieldRef)).toBe(originalControl); // same AbstractControl instance
      expect(instance.control(newFieldRef)?.value).toBe('Ada Lovelace'); // live edit survived
    });

    it("adds a new field on a later emission without disturbing an existing sibling's live value", () => {
      const nameField = { type: FieldType.input, key: 'name' } as const;
      const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [nameField] });
      const instance = buildAndFlush(paramsSig);
      instance.control(nameField)?.setValue('Ada');

      const emailField = { type: FieldType.input, key: 'email' } as const;
      paramsSig.set({ fields: [nameField, emailField] });
      appRef.tick();

      expect(instance.control(emailField)).toBeDefined();
      expect(instance.control(nameField)?.value).toBe('Ada'); // untouched
      expect(instance.form.getRawValue()).toEqual({ name: 'Ada', email: null });
    });

    it('removes a field on a later emission, detaching its control, without disturbing a sibling', () => {
      const nameField = { type: FieldType.input, key: 'name' } as const;
      const emailField = { type: FieldType.input, key: 'email' } as const;
      const paramsSig = signal<FormParameter<Record<string, unknown>>>({
        fields: [nameField, emailField],
      });
      const instance = buildAndFlush(paramsSig);
      instance.control(nameField)?.setValue('Ada');
      const nameControl = instance.control(nameField);

      paramsSig.set({ fields: [nameField] });
      appRef.tick();

      expect(instance.form.get('email')).toBeNull();
      expect(instance.control(emailField)).toBeUndefined();
      expect(instance.control(nameField)).toBe(nameControl); // sibling untouched
      expect(instance.control(nameField)?.value).toBe('Ada');
    });

    it('reordering the SAME field references in a later emission is a no-op (same controls)', () => {
      const nameField = { type: FieldType.input, key: 'name' } as const;
      const emailField = { type: FieldType.input, key: 'email' } as const;
      const paramsSig = signal<FormParameter<Record<string, unknown>>>({
        fields: [nameField, emailField],
      });
      const instance = buildAndFlush(paramsSig);
      const nameControl = instance.control(nameField);
      const emailControl = instance.control(emailField);

      paramsSig.set({ fields: [emailField, nameField] }); // reordered, same references
      appRef.tick();

      expect(instance.control(nameField)).toBe(nameControl);
      expect(instance.control(emailField)).toBe(emailControl);
    });

    it('a mixed tree reconciles its plain fields while leaving an isList field as an island', () => {
      const nameField = { type: FieldType.input, key: 'name' } as const;
      const contactsField: FormField = {
        type: FieldType.object,
        key: 'contacts',
        isList: true,
        value: [{ email: 'a@x.com' }] as unknown as Record<string, unknown>,
        fields: [{ type: FieldType.input, key: 'email' }],
      };
      const paramsSig = signal<FormParameter<Record<string, unknown>>>({
        fields: [nameField, contactsField],
      });
      const instance = buildAndFlush(paramsSig);
      const listControl = instance.control(contactsField);

      const phoneField = { type: FieldType.input, key: 'phone' } as const;
      paramsSig.set({ fields: [nameField, contactsField, phoneField] });
      appRef.tick();

      expect(instance.control(phoneField)).toBeDefined();
      expect(instance.control(contactsField)).toBe(listControl); // untouched island
      expect(instance.form.get('contacts')?.value).toEqual([{ email: 'a@x.com' }]);
    });

    it("a step's children reconcile exactly like top-level fields", () => {
      const step = (fields: FormField[]) => ({ type: FieldType.step, fields }) as const;
      const nameField = { type: FieldType.input, key: 'name' } as const;
      const paramsSig = signal<FormParameter<Record<string, unknown>>>({
        fields: [step([nameField])],
      });
      const instance = buildAndFlush(paramsSig);
      instance.control(nameField)?.setValue('Ada');

      const emailField = { type: FieldType.input, key: 'email' } as const;
      paramsSig.set({ fields: [step([nameField, emailField])] });
      appRef.tick();

      expect(instance.control(emailField)).toBeDefined();
      expect(instance.control(nameField)?.value).toBe('Ada'); // untouched, still on the top form
      expect(instance.form.getRawValue()).toEqual({ name: 'Ada', email: null }); // no step wrapper key
    });

    describe('tier 2: rewireField (surgical rewire of a kept-but-changed field)', () => {
      it('rewires a changed observer prop, updating its resolved value without disturbing the control', async () => {
        const otherField = { type: FieldType.input, key: 'other', value: 'x' } as const;
        const labelField = {
          type: FieldType.input,
          key: 'name',
          value: 'Ada',
          label: observe('other', () => 'Label A'),
        } as const;
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({
          fields: [otherField, labelField],
        });
        const instance = buildAndFlush(paramsSig);
        await Promise.resolve();
        await Promise.resolve();
        expect((instance.fieldState(labelField)() as { label?: string }).label).toBe('Label A');

        instance.control(labelField)?.setValue('Ada Lovelace');
        const originalControl = instance.control(labelField);

        // fresh reference, DIFFERENT callback -> diffDeclaredConfig must flag `label` as changed
        const newLabelField = { ...labelField, label: observe('other', () => 'Label B') };
        paramsSig.set({ fields: [otherField, newLabelField] });
        appRef.tick();
        await Promise.resolve();
        await Promise.resolve();

        expect(instance.control(newLabelField)).toBe(originalControl); // same control instance
        expect(instance.control(newLabelField)?.value).toBe('Ada Lovelace'); // value undisturbed
        expect((instance.fieldState(newLabelField)() as { label?: string }).label).toBe('Label B');
      });

      it('applies a validations change on a kept field live, via setValidators', () => {
        const field: FormField = {
          type: FieldType.input,
          key: 'name',
          value: '',
          validations: [{ name: 'required', validator: Validators.required, message: 'Required' }],
        };
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [field] });
        const instance = buildAndFlush(paramsSig);
        expect(instance.control(field)?.valid).toBe(false); // required, empty -> invalid

        const relaxedField = { ...field, validations: [] };
        paramsSig.set({ fields: [relaxedField] });
        appRef.tick();

        expect(instance.control(relaxedField)?.valid).toBe(true); // validator lifted live
      });

      it('does not resubscribe an observer whose declared config is byte-identical across a reconciliation pass', async () => {
        const otherField = { type: FieldType.input, key: 'other', value: 'x' } as const;
        const callback = vi.fn((v: string) => `Label:${v}`);
        const labelField = {
          type: FieldType.input,
          key: 'name',
          value: 'Ada',
          label: observe('other', callback),
        } as const;
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({
          fields: [otherField, labelField],
        });
        buildAndFlush(paramsSig);
        await Promise.resolve();
        await Promise.resolve();
        const callsAfterInitial = callback.mock.calls.length;
        expect(callsAfterInitial).toBeGreaterThan(0);

        // fresh field reference, but the SAME `paths` + SAME callback reference on `label` —
        // diffDeclaredConfig must see this prop as unchanged and never tear down/resubscribe it
        const newFieldRef = { ...labelField };
        paramsSig.set({ fields: [otherField, newFieldRef] });
        appRef.tick();
        await Promise.resolve();
        await Promise.resolve();

        expect(callback.mock.calls.length).toBe(callsAfterInitial); // no new subscription fired
      });

      it("resets onChange's previousValue baseline when a category-4 prop is rewired (documented tradeoff)", async () => {
        const seen: { value: unknown; previousValue: unknown }[] = [];
        const field1 = {
          type: FieldType.input,
          key: 'name',
          value: 'Ada',
          onChange: (value: unknown, change?: { previousValue?: unknown }) => {
            seen.push({ value, previousValue: change?.previousValue });
          },
        } as const;
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [field1] });
        const instance = buildAndFlush(paramsSig);

        instance.control(field1)?.setValue('Ada L');
        await Promise.resolve();
        expect(seen.at(-1)).toEqual({ value: 'Ada L', previousValue: 'Ada' });

        // a fresh `onChange` reference -> category 4 changed, so the closure's `previous` baseline
        // resets to whatever the control's value is AT REWIRE TIME, not the true original value
        const field2 = {
          ...field1,
          onChange: (value: unknown, change?: { previousValue?: unknown }) => {
            seen.push({ value, previousValue: change?.previousValue });
          },
        };
        paramsSig.set({ fields: [field2] });
        appRef.tick();

        instance.control(field2)?.setValue('Ada Lovelace');
        await Promise.resolve();
        expect(seen.at(-1)).toEqual({ value: 'Ada Lovelace', previousValue: 'Ada L' }); // not 'Ada'
      });
    });

    describe('tier 3: isList item reconciliation', () => {
      // `itemKey` derives identity from each control's OWN raw value (SPEC §16 tier 3 — old keys
      // are recovered from the LIVE controls, not a separately-cached seed array), so 'id' must
      // be a real field alongside 'name', not just data sitting in the original seed array.
      const rowsField = (
        items: { id: string; name: string }[],
        nameField: FormField = { type: FieldType.input, key: 'name' },
      ): ObjectField => ({
        type: FieldType.object,
        key: 'rows',
        isList: true,
        itemKey: (item: unknown) => (item as { id: string }).id,
        value: items as unknown as Record<string, unknown>,
        fields: [{ type: FieldType.input, key: 'id' }, nameField],
      });

      it('reorders items via itemKey, moving the SAME control instance and preserving its live value', () => {
        const field = rowsField([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [field] });
        const instance = buildAndFlush(paramsSig);

        const liveField = instance.fields.find((f) => f.key === 'rows')!;
        const item1Fields = instance.listItemFields(liveField, 1); // 'b'
        const bNameControl = instance.control(item1Fields.find((f) => f.key === 'name')!);
        bNameControl?.setValue('B-edited');

        const reordered = {
          ...field,
          value: [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }] as unknown as Record<string, unknown>,
        };
        paramsSig.set({ fields: [reordered] });
        appRef.tick();

        expect(instance.form.getRawValue()).toEqual({
          rows: [{ id: 'b', name: 'B-edited' }, { id: 'a', name: 'A' }],
        });

        const liveField2 = instance.fields.find((f) => f.key === 'rows')!;
        const item0FieldsAfter = instance.listItemFields(liveField2, 0); // now 'b'
        const bNameControlAfter = instance.control(item0FieldsAfter.find((f) => f.key === 'name')!);
        expect(bNameControlAfter).toBe(bNameControl); // moved, not rebuilt
        expect(bNameControlAfter?.value).toBe('B-edited');
      });

      it('handles add + remove + reorder together in one value emission', () => {
        const field = rowsField([
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
          { id: 'c', name: 'C' },
        ]);
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [field] });
        const instance = buildAndFlush(paramsSig);

        const liveField = instance.fields.find((f) => f.key === 'rows')!;
        const item0Fields = instance.listItemFields(liveField, 0); // 'a'
        const aNameControl = instance.control(item0Fields.find((f) => f.key === 'name')!);
        aNameControl?.setValue('A-edited');

        // remove 'b', put 'c' before 'a', add 'd'
        const updated = {
          ...field,
          value: [
            { id: 'c', name: 'C' },
            { id: 'a', name: 'A' },
            { id: 'd', name: 'D' },
          ] as unknown as Record<string, unknown>,
        };
        paramsSig.set({ fields: [updated] });
        appRef.tick();

        expect(instance.form.getRawValue()).toEqual({
          rows: [{ id: 'c', name: 'C' }, { id: 'a', name: 'A-edited' }, { id: 'd', name: 'D' }],
        });

        const liveField2 = instance.fields.find((f) => f.key === 'rows')!;
        const item1FieldsAfter = instance.listItemFields(liveField2, 1); // now 'a'
        const aNameControlAfter = instance.control(item1FieldsAfter.find((f) => f.key === 'name')!);
        expect(aNameControlAfter).toBe(aNameControl); // 'a' survived, same control, moved
      });

      it('positional default (no itemKey): tail-append/tail-trim only, matching pre-tier-3 behavior', () => {
        const field: ObjectField = {
          type: FieldType.object,
          key: 'rows',
          isList: true,
          value: [{ name: 'A' }, { name: 'B' }] as unknown as Record<string, unknown>,
          fields: [{ type: FieldType.input, key: 'name' }],
        };
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [field] });
        const instance = buildAndFlush(paramsSig);

        const liveField = instance.fields.find((f) => f.key === 'rows')!;
        const item0Fields = instance.listItemFields(liveField, 0);
        const aNameControl = instance.control(item0Fields.find((f) => f.key === 'name')!);
        aNameControl?.setValue('A-edited');

        // tail-append a 3rd item; the first two keep their positions
        const appended = {
          ...field,
          value: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] as unknown as Record<string, unknown>,
        };
        paramsSig.set({ fields: [appended] });
        appRef.tick();

        expect(instance.form.getRawValue()).toEqual({
          rows: [{ name: 'A-edited' }, { name: 'B' }, { name: 'C' }],
        });

        const liveField2 = instance.fields.find((f) => f.key === 'rows')!;
        const item0FieldsAfter = instance.listItemFields(liveField2, 0);
        expect(instance.control(item0FieldsAfter.find((f) => f.key === 'name')!)).toBe(aNameControl);
      });

      it("3b: resyncs a kept item's own sub-field template when the item template changes (value unchanged)", async () => {
        const items = [{ id: 'a', name: 'A' }];
        const field = rowsField(items, {
          type: FieldType.input,
          key: 'name',
          label: observe('./name', () => 'Label A'),
        });
        const paramsSig = signal<FormParameter<Record<string, unknown>>>({ fields: [field] });
        const instance = buildAndFlush(paramsSig);
        await Promise.resolve();
        await Promise.resolve();

        const liveField = instance.fields.find((f) => f.key === 'rows')!;
        const item0Fields = instance.listItemFields(liveField, 0);
        const nameField0 = item0Fields.find((f) => f.key === 'name')!;
        expect((instance.fieldState(nameField0)() as { label?: string }).label).toBe('Label A');
        instance.control(nameField0)?.setValue('A-edited');
        const originalControl = instance.control(nameField0);

        // SAME `value` reference (no add/remove/reorder), fresh item TEMPLATE with a changed
        // observer callback on the item's own `name` field
        const updated: ObjectField = {
          ...field,
          fields: [
            { type: FieldType.input, key: 'id' },
            { type: FieldType.input, key: 'name', label: observe('./name', () => 'Label B') },
          ],
        };
        paramsSig.set({ fields: [updated] });
        appRef.tick();
        await Promise.resolve();
        await Promise.resolve();

        const liveField2 = instance.fields.find((f) => f.key === 'rows')!;
        const item0FieldsAfter = instance.listItemFields(liveField2, 0);
        const nameField0After = item0FieldsAfter.find((f) => f.key === 'name')!;

        expect(instance.control(nameField0After)).toBe(originalControl); // same control instance
        expect(instance.control(nameField0After)?.value).toBe('A-edited'); // value undisturbed
        expect((instance.fieldState(nameField0After)() as { label?: string }).label).toBe('Label B');
      });
    });
  });
});

describe('GenericFormComponent (render)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GenericFormComponent],
    });
  });

  it('mounts a form mixing every field type without throwing (circular-import / NG0919 guard)', async () => {
    const params: FormParameter<Record<string, unknown>> = {
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
    expect(html).toContain('object-field');
    expect(html).toContain('input-field');
    expect(html).toContain('boolean-field');
    expect(html).toContain('select-field');
  });

  it('typing into an input reaches the underlying control (signals wiring works end to end)', async () => {
    const params: FormParameter<Record<string, unknown>> = {
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

  it('a cosmetic-only params() change (showSubscript) propagates live to a mounted form', async () => {
    const params: FormParameter<Record<string, unknown>> = {
      fields: [{ type: FieldType.input, key: 'name' }],
      showSubscript: true,
    };
    const fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', params);
    fixture.detectChanges();
    await fixture.whenStable();

    const formField = () => (fixture.nativeElement as HTMLElement).querySelector('mat-form-field')!;
    expect(formField().classList.contains('hide-subscript')).toBe(false);

    fixture.componentRef.setInput('params', { ...params, showSubscript: false });
    fixture.detectChanges();

    expect(formField().classList.contains('hide-subscript')).toBe(true);
  });

  it('typed input survives an unrelated params() re-emission end to end', async () => {
    const baseParams: FormParameter<Record<string, unknown>> = {
      fields: [{ type: FieldType.input, key: 'name' }],
    };
    const fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', baseParams);
    fixture.detectChanges();
    await fixture.whenStable();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = 'Ada Lovelace';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const instance = (fixture.componentInstance as unknown as { instance: FormInstance }).instance;
    expect(instance.form.get('name')?.value).toBe('Ada Lovelace');

    fixture.componentRef.setInput('params', { ...baseParams, showSubscript: false });
    fixture.detectChanges();
    await fixture.whenStable();

    const instanceAfter = (fixture.componentInstance as unknown as { instance: FormInstance })
      .instance;
    expect(instanceAfter).toBe(instance); // build() only ever ran once
    expect(instanceAfter.form.get('name')?.value).toBe('Ada Lovelace'); // not wiped
  });

  it('the motivating scenario: a fresh-reference field set (e.g. a computed() rebuilding its ' +
    'fields array) does not throw, and a typed value survives', async () => {
    const nameField = { type: FieldType.input, key: 'name' } as const;
    const params: FormParameter<Record<string, unknown>> = { fields: [nameField] };
    const fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', params);
    fixture.detectChanges();
    await fixture.whenStable();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = 'Ada Lovelace';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // exactly what grid-filter-panel's formParams computed()/grid-cell's editFormParams do on
    // every recompute — a brand-new field object, same shape
    fixture.componentRef.setInput('params', { fields: [{ ...nameField }] });
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();
    fixture.detectChanges();

    const instance = (fixture.componentInstance as unknown as { instance: FormInstance }).instance;
    expect(instance.form.get('name')?.value).toBe('Ada Lovelace');

    const nameInput = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    expect(nameInput.value).toBe('Ada Lovelace');
  });

  it('clicking Add on a list-of-objects renders a new item row', async () => {
    const params: FormParameter<Record<string, unknown>> = {
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
