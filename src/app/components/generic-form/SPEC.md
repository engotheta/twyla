# Generic Form — Runtime Specification

Types define **what** a config is; this document defines **how** the engine behaves.
Any renderer/component work MUST follow these rules. If a rule needs changing,
change it here first.

Vocabulary: "the engine" = `FormEngineService` + `FormInstance`. "config" = a
`FormField` object. "control" = the Angular `AbstractControl` backing a field.

---

## 1. Observer graph (Dynamic props)

- At init, every observer fires **once, in declaration order** (outer fields
  first, then depth-first into containers), using current control values.
- Observer-driven **value writes DO emit** `valueChanges`, so cascades are
  allowed (A → B → C works).
- **Cycle protection:** during one synchronous cascade the engine keeps a
  visited set of written paths. A second write to an already-visited path in
  the same cascade is **skipped and logged** (`console.warn`). The set clears
  on the next microtask. A observes B and B observes A therefore settles after
  one round instead of looping.
- Writes performed by `valueFn` and observers never mark the control dirty
  (`{ emitEvent: true }`, no `markAsDirty`). Dirtiness is user-only.

## 2. Async Dynamic callbacks

- Callbacks may return `T | Promise<T>`. Resolution is **latest-wins**
  (`switchMap` semantics): if the observed controls change again before the
  previous promise resolves, the stale result is discarded.
- While a promise is pending the prop keeps its previous resolved value
  (no flicker to `undefined`).

## 3. `field` batched patch

- The patch is **shallow-merged** into the field config on every emission.
- Patch keys win over static props. Individual per-prop observers still
  re-apply on their own triggers — overall rule is **last write wins**.
- `value` inside a patch writes to the control (cycle guard applies).
- `visible` / `disabled` inside a patch behave exactly like the standalone
  dynamic props (see §6 for visibility semantics).

## 4. Lists (`isList`)

- `isList: true` ⇒ the control is a `FormArray`.
  - Value control ⇒ `FormArray<FormControl>`; object field ⇒ `FormArray<FormGroup>`.
- `validations` apply **per item**. `listValidations` apply to the **array**
  (e.g. uniqueness). `minItems` / `maxItems` are enforced twice: as array-level
  validators AND as add/remove button gates in the UI.
- Path grammar for observers uses numeric indices: `'items.0.name'`.
  Wildcards (`items.*.name`) are **not supported** in v1 — observe the array
  path itself (`'items'`) and read the array value in the callback instead.
- Items added at runtime are wired (observers, onChange) at add time; their
  subscriptions are torn down at remove time (§10).
- Object-field items are **clones** of the template `fields` array, isolated
  per item; `FormInstance.listItemFields(field, index)` returns a given
  item's own top-level field instances (what a renderer should walk — it
  mirrors the template's shape, unlike the engine's internal flat list).
- Removing an item shifts every later item down one index. The engine
  re-derives those items' `.path` afterward so submit assembly and observer
  paths keep pointing at the right control — component code never needs to
  do this itself.
- `params.model` seeds initial `value` for any field whose config doesn't
  already define one (including per-row values for `isList` object fields,
  applied via `patchValue` on each seeded item). An explicit `field.value`
  (static or `Dynamic`) always wins over `model`.
- `canAddItem` is `Dynamic<boolean>` — an `observe(...)` targeting the list's
  own path (e.g. `'items'`) receives the whole current array value, so the
  add button can react to it (e.g. "only once the last item has a value").
  Components must read the RESOLVED value off `fieldState`, never the raw
  config prop (§13) — `ObjectFieldComponent.canAdd`/`canRemove` do this.
- A path starting with `'./'` (e.g. `'./key'`) resolves against the
  OBSERVING field's own `isList` item group instead of the top form — the
  narrow, scoped answer to the "wildcards aren't supported" note above:
  it doesn't let one observer watch _every_ item, but it does let a
  per-item field reference a _sibling_ within its own item, independently
  per clone (`searchFields.2.value` observing `'./key'` resolves to
  `searchFields.2.key`). Not meaningful outside an isList item — use an
  absolute path there. See `dynamic.interface.ts` and
  `FormEngineService.resolveObservedPath`.

## 5. Steps flatten

- **Steps are presentational chrome, not data.** Children of a `StepField`
  register their controls on the **top-level form**; the submitted value has
  no step wrapper keys. This is why `StepField` has no required `key`.
- If any outer field is a step, all non-step outer fields are collected into
  one auto-generated step (`FormParameter.mixedStepLabel`, default
  `'More Info'`; `mixedStepPosition`, default `'last'`).
- When steps are present the form footer is hidden; stepper buttons replace it
  (first step: cancel-if-modal instead of previous; last step: submit).

## 6. Visibility vs value retention (two orthogonal switches)

- `visible: false` hides the field. Its control **stays registered** and its
  validators are **suspended** (a hidden required field can't block submit).
- `clearOnHide` (default `false`): whether the control's value resets to
  `defaultValue ?? null` when hidden. Value otherwise **survives** hiding.
- Hidden fields are **included in the submit payload by default** — same
  default as disabled fields (`FormParameter.includeDisabled`, §7). Set
  `excludeHiddenOnSubmit: true` on the field to drop it while hidden instead.
  Retention in the control and inclusion in the payload are independent
  decisions.

## 7. Submit assembly order

`FormInstance.submitValue()` (assemble only) / `FormInstance.submit()`
(assemble **and** invoke `params.onSubmit`) produce the payload in exactly
this order. Both are **async** — see §11, deferred attachment uploads happen
first and can fail the whole assembly.

1. Await any pending `uploadOn: 'submit'` attachment uploads (§11); if any
   failed, abort (mark all touched, return `null`) without checking validity.
2. `form.getRawValue()` (disabled controls included).
3. Drop every field with `ignoreOnSubmit: true` (content/label default `true`).
4. Drop fields currently hidden, if `excludeHiddenOnSubmit: true` (default:
   keep them — see §6).
5. If `FormParameter.includeDisabled === false`, drop disabled fields.
6. Run each remaining field's `toSubmit(value, formState)` transform (leaf
   fields first, then containers).
7. Cross validators (§9) must pass and the form must be valid **before**
   `onSubmit` fires; otherwise the engine marks all touched and aborts.

`valueFn` is NOT part of submit — see §8. `submit()` is what the footer's
auto submit button and any inline `type: 'submit'` button field call;
`submitValue()` is the lower-level primitive for callers that just want the
assembled value without triggering `onSubmit`/modal-close side effects.

## 8. `valueFn` vs `toSubmit` timing

- `valueFn(value, formState)` transforms the value **on the way into the
  control**, on every user-driven `valueChanges`, honoring the field's
  `updateOn` and `debounce`. Its write does not re-trigger itself (guard).
- `toSubmit(value, formState)` transforms the value **only at submit** and
  never touches the control (e.g. `Date` → ISO string, option object → id).

## 9. Cross validators

- Registered as form-level validators on the top-most form.
- `match` / `requiredIf` are sync; `custom` may be async (attached as an async
  validator).
- Error placement: if `showOn` (a field path) is set, the error is ALSO set on
  that control so it renders inline under the field; otherwise it is
  form-level only (banner area above the footer). Error key = rule `type`,
  error value = rule `message`.

## 10. Subscription lifecycle

- Every subscription the engine creates is registered in a **per-field bag**.
- Removing a list item tears down the bags of the item's fields (recursively).
- `FormInstance.destroy()` tears down everything. The rendering component
  calls it in `ngOnDestroy`. No engine subscription may be created outside a
  bag.

## 11. Attachment lifecycle

- The engine owns the whole lifecycle (README rule #1: components render, the
  engine wires). A component calls `FormInstance.selectAttachment(field,
file, index?)` on file pick/drop and `FormInstance.clearAttachment(field,
index?)` to remove one — it never touches `uploadFn`, status, or the
  control's value itself. `index` is only for `isList` attachment fields,
  where `field.attachment` is an array kept parallel to the `FormArray`.
- `uploadOn` (default `'select'`): `selectAttachment` uploads immediately.
  `'submit'` just records `attachment.status = 'pending'` with the file
  attached; the actual upload runs inside `submit()`/`submitValue()` (§7 step
  1), which awaits it before assembling the payload.
- During upload: control value stays `null`, `attachment.status = 'uploading'`,
  and the control carries error `{ uploading: true }` so a linear stepper /
  submit can't proceed mid-upload.
- Success: value = URL (with `uploadFn`) or base64 (without),
  `status = 'done'`. Failure: `status = 'error'`, `attachment.error` set,
  control error `{ upload: message }`. A failed deferred (`'submit'`) upload
  aborts the whole submit.
- `uploadFn` may return a `Promise<string>` or an `Observable<string>`; if an
  Observable, the engine awaits its **last** emission (`lastValueFrom`) — it
  does not currently distinguish progress emissions from the final URL, so
  `AttachmentMeta.progress` is not populated (a real gap, not a design choice
  — there's no way to tell "in-progress update" from "final value" apart in
  the current `uploadFn` contract).

## 12. Misc rules (gap fills)

- `Validator.async: true` marks an `AsyncValidatorFn`; the engine cannot
  distinguish sync from async at runtime, so the flag is required for async.
- `autoLabels` derives a label from `key` by splitting camelCase/snake_case
  and title-casing (`firstName` → `First Name`).
- `readonly` renders the control non-editable but keeps it enabled — it stays
  in the form value (unlike `disabled`).
- `hasNoneOption` prepends `{ label: 'None', value: null }` after options
  resolve, before sorting.
- Deprecated `onModalClose` / `onCloseAction` both forward to `onClose`.

## 13. Component reactivity (why `fieldState` exists)

- Every render component in this app is `ChangeDetectionStrategy.OnPush`
  (project convention). The engine resolves Dynamic props by **mutating the
  field config object in place** — a plain property write, not a signal
  `.set()`. An OnPush component reading `field.label` directly would never
  re-render when that mutation happens; nothing marks it dirty.
- `FormInstance.fieldState(field)` is the fix: it returns a `Signal` that
  re-emits a **fresh shallow clone** of the field every time the engine
  writes a resolved prop onto it, so signal consumers (`computed()`, an
  `@if`/interpolation reading the signal in a template) see a reference
  change and correctly re-render. Components must read `label` / `hint` /
  `tooltip` / `visible` / `disabled` / `class` / `opacity` / `icon` / etc.
  through `fieldState(field)()`, never off the field object directly.
- `FormInstance.control(field)` is the matching accessor for the
  `AbstractControl` — components should use it instead of `form.get(path)`
  string lookups (works uniformly for list items, whose paths shift on
  removal — see §4).
- This also covers plain user-driven interaction on a _distant_ ancestor —
  don't assume it doesn't need one. It's tempting to assume a leaf field's own
  DOM event (e.g. a checkbox toggle inside `app-boolean-field`) automatically
  propagates a re-check up through `app-field` → `app-object-field` →
  `mat-step` → `GenericFormComponent`, since that's the common mental model
  for Angular's dirty-propagation. Empirically (verified in a real browser,
  not just unit tests) it does **not** reach reliably that many components
  up in this OnPush + zoneless app: `GenericFormComponent`'s own template
  calling a _plain method_ like `stepValid(entry)` went stale and never
  re-disabled the stepper's Next button after the underlying controls became
  valid. The fix was the same pattern as `fieldState`/`controlStatus`: build
  a real `Signal<boolean>` per step (`DisplayStep.valid`, via `controlStatus`
  over each field's control) instead of a plain method, so the template reads
  a signal directly rather than relying on ambient re-check propagation.
  Rule of thumb: any container/shell component (not a single leaf field) that
  derives UI state from descendant controls should do it through a signal,
  not a plain method — don't rely on "some descendant fired an event" to
  guarantee that component's own template gets re-evaluated.

## 14. Two AbstractControl gotchas that bit the stepper gating specifically

- **`ngOnInit` is not an injection context.** Only the constructor, field
  initializers, factory functions, and `runInInjectionContext` are (per
  Angular's own `assertInInjectionContext`). `controlStatus()` calls
  `toObservable()` internally, which needs one — building step-validity
  signals inside `ngOnInit` throws `NG0203`. `GenericFormComponent` captures
  `inject(Injector)` as a field initializer and wraps its `ngOnInit` work
  needing DI in `runInInjectionContext(this.injector, () => …)`.
- **A disabled control's `.valid` is `false`, not `true`.** Its `status` is
  `'DISABLED'` — neither `VALID` nor `INVALID` — so `control.valid` and
  `control.invalid` are _both_ false. Angular's own `FormGroup`/`FormArray`
  aggregate validity already knows to skip disabled children, so this only
  bites code that reads a disabled leaf control's `.valid` directly (exactly
  what step-validity gating does, per field). The fix: treat `status().disabled`
  as passing, same as skipping non-value fields — `s().disabled || s().valid
!== false`, not just `s().valid !== false`.

## 15. Live `onChange` + external instance access

Added so a parent embedding `<generic-form>` (e.g. a data-grid's advanced
filter panel) can react to changes live and drive the form programmatically,
without subscribing to internals it isn't supposed to touch.

- `FormParameter.onChange`, when set, subscribes to `form.valueChanges` —
  plain `valueChanges`, no `startWith`, so (unlike §1's Dynamic-prop
  observers, which also fire once at init) it does **not** fire on init, only
  on subsequent user-driven changes. It's wired _after_ the initial observer
  pass (§1) completes inside `build()`, specifically so synchronous value
  writes during that initial resolution don't themselves count as a "change."
- Debounced via `FormParameter.changeDebounce` (ms) when set — same pattern
  as the existing per-field `debounce` (§8).
- Its subscription lives in a form-level bag (separate from the per-field
  `rt.subs` bags), torn down in `instance.destroy()` (§10) alongside them.
- `GenericFormComponent.instanceChange` (`output<FormInstance>()`) emits
  once, at the end of `ngOnInit()`, immediately after `engine.build()`
  returns — i.e. after the full initial observer pass has already run
  synchronously inside `build()`. A parent therefore always receives a
  fully-resolved instance, and can safely call `instance.form.reset()`,
  `instance.submit()`, `instance.formState()`, etc. right away.
- Neither addition changes any existing behavior when unused: `onChange`
  only subscribes when set, and `instanceChange` is a new emitter with no
  effect unless a parent listens to it.
