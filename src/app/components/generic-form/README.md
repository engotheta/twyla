# Generic Form (form-config)

Config-driven form module for Angular + Material. Types define the contract,
`SPEC.md` defines the runtime semantics, `FormEngineService` implements them,
`GenericFormComponent` is the rendering shell, `fields/components/` is the
per-type renderer library.

## Layout

```
generic-form/
├── SPEC.md                       ← runtime rules; read FIRST
├── index.ts                      barrel
├── field-type.interface.ts      FieldType enum + variant literal unions
├── dynamic.interface.ts         Dynamic<T>, observe/obs, isObserver, Resolved<T>
├── form-state.interface.ts      FormState, FieldChange, Validator, Option
├── base-field.interface.ts     CoreField + ValueField
├── fields/
│   ├── container.fields.ts     ObjectField, StepField
│   ├── control.fields.ts       Input/Boolean/Select/Textarea/Date/Color/Attachment
│   ├── static.fields.ts        Button, Content, Label
│   └── components/             one folder per renderer, see below
├── form-field.interface.ts     FormField union + type guards
├── form-parameters.interface.ts FormParameters, CrossValidator
├── form-engine.service.ts       build / observers / submit / lists / attachments
├── generic-form.component.ts    renderer shell (stepper / footer / modal)
└── generic-form.component.html
```

`fields/components/` — every selector starts with `app-`, straight to the
name (`app-object-field`, not `app-generic-form-object-field`):

```
fields/components/
├── control-status.util.ts    reactive AbstractControl status/value/errors, for OnPush
├── field-errors.util.ts      resolves a control's first error into a display message
├── class.util.ts             joinClasses() — plain concatenation, not a Tailwind merge
├── field/                    app-field        — the dispatcher (§ below)
├── object-field/             app-object-field — container: nested fields, collapse, lists
├── input-field/               app-input-field
├── boolean-field/              app-boolean-field  (checkbox / toggle / radio)
├── select-field/               app-select-field   (dropdown / toggle / button / checkbox / radio)
│   └── options.util.ts        optionsParameter raw-data mapping
├── textarea-field/             app-textarea-field (textarea / richText)
├── date-field/                 app-date-field     (date / dateTime / time / monthYear / year)
├── color-field/                app-color-field
│   └── color.util.ts          hex/rgb/hsl/hsv conversion
├── attachment-field/           app-attachment-field
├── button-field/                app-button-field
├── content-field/               app-content-field
└── label-field/                 app-label-field
```

## Usage

```typescript
import { FieldType, FormParameters, observe } from './generic-form';

const params: FormParameters<{ name: string; country: string; city: string }> = {
  title: 'New License Company',
  fields: [
    { type: FieldType.input, key: 'name', validations: [required] },
    {
      type: FieldType.select,
      key: 'country',
      options: countries$, // a bare Observable works too — engine resolves it (SPEC §1)
    },
    {
      type: FieldType.select,
      key: 'city',
      // city options react to country (Dynamic prop)
      options: observe('country', (country) => citiesOf(country)),
      visible: observe('country', (country) => !!country),
    },
  ],
  crossValidators: [
    { type: 'requiredIf', field: 'city', when: 'country', showOn: 'city' },
  ],
  onSubmit: (value) => api.save(value),
};
```

```html
<app-generic-form [params]="params" />
```

## `fieldsClass` vs `fieldsContainerClass`

Every container that has a `fields` list (`ObjectField`, `StepField`,
top-level `FormParameters`) has both:

- **`fieldsClass`** — applied to **each** direct child field's own wrapper.
  It's a *descendant* class: `fieldsClass: 'mb-4'` puts `mb-4` on every field
  in that list, individually.
- **`fieldsContainerClass`** — applied **once**, to the element that wraps
  the whole `fields` list. It's a *container* class: `fieldsContainerClass:
  'grid grid-cols-2 gap-4'` lays the list of fields out as a grid.

They compose: a 2-column grid of fields, each with its own bottom margin, is
`fieldsContainerClass: 'grid grid-cols-2 gap-4', fieldsClass: 'mb-2'`.

## The dispatcher (`app-field`)

`app-field` is the one place that switches on `FieldType` — every container
(`app-object-field`, `GenericFormComponent`) renders its children through it
rather than importing leaf components directly. It owns the common wrapper
chrome only: `[hidden]` on `visible === false` (SPEC §6 — the control stays
registered either way), the merged `fieldsClass` + field's own `class`, and
`opacity`. Everything about how a field's own control looks and behaves
belongs to that field's own component.

`app-object-field` needs to recurse back into `app-field` for its children,
which would make `field.component.ts` and `object-field.component.ts` import
each other — a circular standalone-component reference that fails at
runtime with `NG0919`. It's avoided the same way `field-group.component.ts`
avoids it elsewhere in this repo: `app-field` hands `app-object-field` a
`TemplateRef` (self-referencing `app-field` — safe, self-import isn't
circular) instead of `app-object-field` importing `FieldComponent` directly.

## Rules of engagement for component authors

1. Never subscribe to `valueChanges` in a component — the engine owns wiring.
2. Never read `field.visible` / `field.label` / any `Dynamic` prop off the
   field config object directly — read `instance.fieldState(field)()`
   instead. The engine resolves Dynamic props by mutating the config object
   in place, which an OnPush component (project convention) will never
   notice on its own; `fieldState` is the signal bridge. See SPEC §13.
3. Use `instance.control(field)` for the `AbstractControl`, not
   `form.get(path)` string lookups — works uniformly for list items, whose
   paths shift on removal (SPEC §4).
4. All add/remove list buttons call `instance.addListItem` /
   `instance.removeListItem`. Object-field list items render via
   `instance.listItemFields(field, index)`, not the static `field.fields`
   template (that's per-item clones, not the fields with real controls).
5. Attachment selection/removal goes through `instance.selectAttachment` /
   `instance.clearAttachment` — never touch `uploadFn` or the control's
   value directly (SPEC §11).
6. If a behavior isn't in SPEC.md, propose a SPEC change — don't improvise.
