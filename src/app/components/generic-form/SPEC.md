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

- Callbacks may return `T | Promise<T> | Observable<T>`. Resolution is
  **latest-wins** (`switchMap` semantics): if the observed controls change
  again before the previous promise resolves, the stale result is discarded.
- An Observable is subscribed to, and **each emission is applied** — so a
  callback can hand back `FetchService.fetch$(…)` as it is, and a
  `cache-and-network` call shows the cached value, then the fresh one. It is
  unsubscribed when the observed controls change again, or the field goes.
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

**Running a submit** (`submit()` only — `submitValue()` has none of this):

- `FormInstance.submitting` is true from the start of assembly (including
  deferred uploads) until `onSubmit` settles: its Promise resolves/rejects, or
  its Observable completes/errors (the engine awaits the **last** emission).
  It resets in a `finally`, so a throwing `onSubmit` doesn't leave the form
  stuck.
- A `submit()` call while one is running resolves `null` immediately and does
  nothing else — double clicks and Enter mashing never submit twice.
- Submit buttons (the footer's, the stepper's last, and `type: 'submit'`
  fields) render `submitting` as their busy state: disabled with a spinner,
  but still focusable (`disabledInteractive`), so focus isn't dropped.
- When assembly stops at validation, `FormInstance.invalidSubmits` increments
  and `GenericFormComponent` moves focus to the first invalid, visible control
  once the errors have rendered.

**`FormParameter.nativeForm`** (default false; `FormInstance.nativeForm`):

- The flat layout renders inside `<form novalidate [formGroup] (ngSubmit)>`,
  so Enter in a field submits and browsers / password managers recognise it.
- The footer submit button and `type: 'submit'` fields without their own
  `click` become `type="submit"`; their click does nothing itself — the form's
  submit event runs `submit()` once.
- Ignored (false) when the form has step fields: Enter must not submit a
  stepper from its first step.

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
- `message` is text or a function. A function is called each time the rule
  runs, so `message: () => t().errors.mismatch` follows the user's language;
  the rules themselves are attached once, at build (§16 leaves them as they
  are).

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
  resolve, before sorting. A server search (§17) leaves it out while there is
  text in the search box.
- Deprecated `onModalClose` / `onCloseAction` both forward to `onClose`.
- `inputType: 'password'` fields get a "Show password" suffix toggle
  (`aria-pressed`, switches the input to `type="text"`); `revealable: false`
  removes it.
- `validators.ts` holds ready-made `Validator`s (`validators.required()`,
  `.email()`, `.minLength(n)`, `.strongPassword(rules)`, …) whose `name`
  equals the error key their validator sets, plus the apps' `VALIDATOR_*`
  aliases. `passwordChecks(value, rules)` lists each password rule with
  whether it's met, for a live checklist next to the field.

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
  DOM event (e.g. a checkbox toggle inside `boolean-field`) automatically
  propagates a re-check up through `form-field` → `object-field` →
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

## 16. A later `params()`: reconciliation

A form is built once. When `params()` later emits a config whose `fields` array is a different
reference, the engine brings the live form in line with it instead of building again. This is
what lets `params` be a `computed` — over a grid's columns, or over a page's text in the user's
language.

- **Fields are matched by path** (the key under its parent; steps add no segment, §5).
  - _Added_: a path only the new config has gets a control. _Removed_: a path it no longer has
    loses its control. A path kept with another `type` is removed and added: its value is lost.
  - _Kept_ (same path, same type): the field is **re-keyed** to the new config object. Its
    control stays, with its value and its dirty and touched state; so do its subscriptions.
    `control(field)` and `fieldState(field)` answer for the new object from then on.
  - What genuinely changed in a kept field's declared config is applied: `validations` are set
    on the control, an observer is resubscribed only for a prop whose definition changed, and
    `valueFn` / `onChange` are rewired only when they or `debounce` changed. `updateOn` cannot
    change on a live control.
- **What the engine wrote on the old object goes to the new one**: `path`, an attachment's
  state (the picked file, its upload status), and a label derived from the key (`autoLabels`).
  Without this the next reconciliation would find no field with a path, take every field for
  new, and build its control again.
- **A list** (`isList`) is re-keyed like any field. Its items follow a changed `value` array by
  `itemKey` (default: position), and each item's fields follow a changed item template.
- **Not reconciled.** Static fields (label, content, button, submit) have no path and are not
  matched: a fresh object for one is shown as it is declared, a `Dynamic` prop on it
  unresolved — pass the same object again to keep it live. `crossValidators`, the form's
  `onChange` and `changeDebounce` are attached once, at build (§9, §15), and `model` seeds
  values only then. The rest of `params` is read live: `submitButtonLabel`, `showSubscript`,
  the stepper options.
- **Rendering.** The templates track their fields by `fieldIdentity(field)` — the object a
  field was first declared with — so a kept field keeps its component, and with it the focus,
  the caret and whatever it has open.
- The same array reference twice is nothing to do. The first emission is the build itself.

## 17. Select option sources

A select's options come from one of two places.

- **`options`**: the list itself — an array, a bare Observable of one, or an `observe()` whose
  callback returns one (§1, §2). Nothing more is asked of it.
- **`optionsParameter`**: a _source_ — `optionsFunction`, with how to map, search and page what it
  answers with. `optionsParameter.optionsFunction` set, `options` is not read.

**The request.** `optionsFunction(request)` is handed one `OptionsRequest`: `search` (the search
box's text under `searchMode: 'server'`, else `''`), `page` (1-based; 1 unless `paginated`), `size`
(`pageSize`, default 25), `filters` (`optionsParameter.filters`, as declared) and `formState`. It
answers with the raw options or with a page of them (`{ content, totalLength?, hasMore? }`, the
grid's `GridData` shape) — as a value, a Promise or an Observable. Raw options become `Option`s
through `mapper`, else `labelKey` / `valueKey`.

**When it is asked.**

- Once, as the select is created — eagerly, so a held value has its label.
- Again whenever `optionsParameter` is a **new object**: the list starts over, empty, and loads
  from the first page. This is how options follow another field: declare the parameter as
  `observe('country', (country) => ({ filters: { country }, optionsFunction }))` and the engine
  hands the select a new one each time `country` changes (§1). A function that should not fetch
  yet answers `[]`.
- `searchMode: 'server'`: again each time the search box's text changes, after `searchDebounce`
  ms of quiet (default 300), trimmed, and never twice running for the same text. The list on
  screen stays until the new one is in. Under `minSearchLength`, nothing is asked for and the
  list says how much to type. Closing the select clears the search, which asks for the whole
  list again.
- `paginated`: for the next page each time the end of the list scrolls into view, one page at a
  time, until `hasMore` is false, `totalLength` options are held, or — where the answer says
  neither — a page comes back short. A new search starts again from page 1.

**Latest wins.** A new parameter or a new search drops the request before it (`switchMap`): its
answer, if it still comes, is ignored. A non-paginated Observable may answer more than once, each
answer replacing the last; a paginated one is heard once per page.

**`filters`** are the request's fixed criteria: sent with every call, whatever is typed or paged.
They are the function's to put on the wire.

**Searching.** `searchMode: 'local'` (default) narrows what was loaded, by label, in the browser;
with `paginated` that is only the pages loaded so far, and the end of the list asks for nothing
while there is text in the box (a search that leaves little on screen would otherwise pull page
after page). `'server'` shows the search box whatever `searchable` says, and shows what the source
answered, unfiltered.

**The search box's keys.** The box sits inside the list, and the list (a popover) inside the
select, so a key left to bubble would be answered twice. The box stops every key; arrows, Enter
and Tab are handed to the select once, Esc closes it, and the rest is typing. Opening the list
moves focus to the box; closing it returns focus to the select.

**The search box and the listbox.** Material's panel is the `listbox` the select controls, and a
listbox may hold options only. So the options sit in an element of their own; where there is a
search box that element takes the listbox role over from the panel on every open — its id (what
the select's `aria-controls` names), its name, its multi-select flag — and the panel becomes a
plain container, with the box beside the list rather than inside it. The rows that say where the
list stands ("Loading options…", "No options found") are disabled options for the same reason.

**Order.** `sortBy` sorts what a non-paginated source answered. A paginated source's order is the
server's.

**What is selected stays.** `mat-select` reads its value, and the label it shows, from the options
it has. So the options of selected values that are not mounted — left out by a search, on a page
not loaded yet, or scrolled out of a `virtualScroll` window — stay mounted all the same: ahead of
the list while nothing is searched for, hidden during a search and in a virtual list. A multiple
select therefore keeps what it held when something else is searched for, scrolled to and picked,
and its value stays in the order of the list (`sortComparator`). This holds for a plain `options`
list too. For a value no loaded page has, `selectedFunction(values)` is asked once for its raw
option; without one the value is shown as it is.

**Failure.** A source that fails (or throws) shows "The options could not be loaded"; opening the
select asks again. A further page that fails leaves the pages before it, and is asked for again
the next time the end of the list is reached.

**Where it lives.** `fields/select-field/options-source.ts` holds the request lifecycle as
signals; the component subscribes to no control (README rule 1). `virtualScroll` is ignored for a
paginated source, which renders a page at a time instead. The radio, checkbox, toggle and button
variants show the first answer only: they have no search box and no end to scroll to. The grid's
filter bar (data-grid SPEC §12) loads the first page of a parameter declared as an object.

## 18. Keyboard shortcuts

The form is one of the app's shortcut scopes (`services/shortcuts/README.md`): its key, **F**,
pressed six times in a quick run arms it and lists what its keys do; one more key runs one.

| Key | What it does | Offered |
| --- | --- | --- |
| `A` | filled fields (`appearance`) | always |
| `H` | room for hints and errors (`showSubscript`) | always |
| `O` | steps down the side (`stepperOrientation`) | a form with steps |
| `L` | steps in order only (`linearSteppers`) | a form with steps |
| `N` | next step | while there is one |
| `P` | previous step | while there is one |
| `I` | go to the first field to fix | always; it closes the hint |
| `0` | back to how it was set up | once something has been switched |

- **An override, not a new config.** A key lays a patch over the form's params for as long as the
  form is on screen. `GenericFormComponent.params` is the params in force — the `[params]` it was
  given with that patch over them — and it is what the engine, the template and the fields read.
  `fields` is never overridden, so §16 has nothing to reconcile: the controls, what was typed and
  the focus stay as they are. Nothing is saved; `0` drops the patch.
- **`N` and `P` are the stepper's own buttons:** `N` is held back by `linearSteppers` and by a
  step's `onProceed`, exactly as the Next button is.
- **`I`** marks every control touched, so the errors show, then moves focus to the first invalid
  one — what a failed submit does (§7), without submitting.
- **Nothing here submits the form or empties it.** A key pressed in passing must not do either.
- **`FormParameter.shortcuts: false`** takes a form out: for one that is part of something else
  (the grid sets it on its filter panel and its cell editors), or that must stay as configured.
- The text is `FORM_MESSAGES.shortcuts`; the list is built in `form.shortcuts.ts`.
