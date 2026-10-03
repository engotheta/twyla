import { effect, Injectable, Injector, Signal, signal, WritableSignal } from '@angular/core';
import {
  AbstractControl,
  AsyncValidatorFn,
  FormArray,
  FormControl,
  FormGroup,
  ValidatorFn,
  ValidationErrors,
} from '@angular/forms';
import { Subscription, from, isObservable, lastValueFrom, Observable } from 'rxjs';
import { debounceTime, startWith, switchMap } from 'rxjs/operators';
import { Dynamic, ObserverParameter, Resolved, isObserver } from './interfaces/dynamic.interface';
import { FieldType } from './interfaces/field-type.interface';
import { FieldChange, FormState, Validator } from './interfaces/form-state.interface';
import {
  FormField,
  ValueFormField,
  isObjectField,
  isStaticField,
  isStepField,
  isValueField,
} from './interfaces/form-field.interface';
import { AttachmentField, AttachmentMeta } from './interfaces/control-fields.interface';
import { ObjectField } from './interfaces/container-fields.interface';
import { CrossValidator, FormParameter } from './interfaces/form-parameter.interface';

/** internal alias: engine internals don't care about the payload generic */
type AnyParams = FormParameter<any>;

// ─────────────────────────────────────────────
// FormEngine — the single place that owns runtime semantics (see SPEC.md).
// Components render; the engine builds, wires, validates, assembles.
// ─────────────────────────────────────────────

/** per-field runtime bookkeeping (SPEC §10) */
interface FieldRuntime {
  field: FormField;
  control?: AbstractControl;
  localForm: FormGroup;
  localFields: FormField[];
  /** SPEC §16: shallow clone of `field` AS DECLARED, captured before any `applyProp` mutation —
   *  what a later `rewireField()` diffs a fresh emission's field against, to tell "genuinely
   *  changed" props from ones that only look different because they were already resolved. */
  declaredConfig: FormField;
  /** category 1: per-prop `observe()` watchers, keyed by prop — lets a rewire tear down and
   *  re-subscribe only the specific props whose Dynamic definition actually changed. */
  propSubs: Map<string, Subscription>;
  /** category 2: a select field's `options` passed as a bare Observable (not observe()-wrapped) */
  optionsSub?: Subscription;
  /** category 3: the batched `field` patch observer */
  fieldPatchSub?: Subscription;
  /** category 4: control.valueChanges → valueFn/onChange pipeline */
  changeSub?: Subscription;
  /** SPEC §16 tier 3: the isList field's OWN `value` array reference last seen/applied — gates
   *  `reconcileListItems` so an imperative `addListItem`/`removeListItem` (which never touches
   *  `field.value`) is never mistaken for a fresh, externally-supplied array to diff against. */
  lastListValue?: unknown[];
  /** SPEC §16 tier 3 "3b": the isList field's OWN `.fields` (item template) reference last
   *  resynced against — gates the per-item template resync separately from `lastListValue`, so a
   *  template-only change (no add/remove/reorder) still resyncs, and a value-only change doesn't
   *  redundantly re-walk every item's template when it hasn't actually changed. */
  lastItemTemplate?: FormField[];
  /**
   * Live-resolved snapshot of `field`, re-emitted (as a fresh shallow clone, so signal
   * consumers see a reference change) every time the engine writes a resolved Dynamic
   * prop or attachment metadata onto it. Components are OnPush, so reading `field.visible`
   * etc. directly off the mutated config object would never trigger a re-render — this is
   * the reactive surface they should read from instead. See `FormInstance.fieldState`.
   */
  state: WritableSignal<FormField>;
}

/** one isList item's fields: `top` mirrors the template's shape (for tree rendering), `flat`
 *  is every field in the item's subtree (for wiring/teardown/reindexing, SPEC §4 §10) */
interface ListItemFields {
  top: FormField[];
  flat: FormField[];
}

export interface FormInstance<T = Record<string, unknown>> {
  form: FormGroup;
  /** all fields flattened (steps/objects walked), with `path` assigned */
  fields: FormField[];
  /** live config — reacts to a new `params()` input. Cosmetic/config props read through this
   *  stay live; the `form`/its controls/the field list are seeded once at `build()` time and
   *  never rebuilt from a later emission (would destroy in-progress user input) — see
   *  `FormEngineService.build`'s `initialParams` doc. */
  params: Signal<FormParameter<T>>;
  formState(): FormState<T>;
  /** live-resolved Dynamic props for this exact field instance, as a Signal. Render
   *  components must read label/hint/visible/disabled/etc. through this, never off the
   *  field object directly (the object is mutated in place; only the signal notifies). */
  fieldState<F extends FormField = FormField>(field: F): Signal<Resolved<F>>;
  /** the AbstractControl backing a value field (undefined for static/step fields) */
  control(field: FormField): AbstractControl | undefined;
  /** the per-item field instances for an isList object field's item at `index` (SPEC §4) */
  listItemFields(field: FormField, index: number): FormField[];
  /** SPEC §7 submit assembly. Awaits any deferred (`uploadOn: 'submit'`) attachment uploads
   *  first (SPEC §11). Returns null when invalid (marks all touched). */
  submitValue(): Promise<T | null>;
  /** `submitValue()` + invoking `params.onSubmit` when it assembled successfully. This is what
   *  the footer's auto submit button and any inline `type: 'submit'` button field call. Awaits
   *  `onSubmit`'s Promise, or its Observable's last emission. Ignored (resolves `null`) while a
   *  previous call is still running. SPEC §7 */
  submit(): Promise<T | null>;
  /** true while `submit()` runs — the upload/assembly AND the awaited `onSubmit`. Submit buttons
   *  show it as their busy state. SPEC §7 */
  submitting: Signal<boolean>;
  /** how many `submit()` calls stopped at validation; `GenericFormComponent` moves focus to the
   *  first invalid control after each. SPEC §7 */
  invalidSubmits: Signal<number>;
  /** `params.nativeForm`, unless the form has steps (where it doesn't apply) — whether the form
   *  renders inside a real `<form>` whose submit buttons are `type="submit"`. SPEC §7 */
  nativeForm: boolean;
  /** SPEC §11: hand the engine a user-picked file for an attachment field (or list item at
   *  `index`). Uploads immediately unless the field's `uploadOn` is `'submit'`. */
  selectAttachment(field: FormField, file: File, index?: number): Promise<void>;
  /** clears a selected/uploaded attachment and resets its control value to null */
  clearAttachment(field: FormField, index?: number): void;
  addListItem(path: string): void;
  removeListItem(path: string, index: number): void;
  destroy(): void;
}

@Injectable({ providedIn: 'root' })
export class FormEngineService {
  // ── public API ────────────────────────────

  /**
   * `injector` MUST be the calling component's own `Injector` (`inject(Injector)` in a field
   * initializer), not this service's — the reconciliation effect below ties its cleanup to that
   * injector's `DestroyRef`. Mirrors `GridEngineService.build`'s identical contract.
   */
  build<T = Record<string, unknown>>(
    paramsSignal: Signal<FormParameter<T>>,
    injector: Injector,
  ): FormInstance<T> {
    const form = new FormGroup({});
    const flat: FormField[] = [];
    const runtimes = new Map<FormField, FieldRuntime>();
    /** cycle guard: paths written during the current synchronous cascade (SPEC §1) */
    const cascade = new Set<string>();
    /** isList ObjectField ⇒ item FormGroup ⇒ that item's own cloned FormField instances */
    const itemFieldsByGroup = new WeakMap<AbstractControl, ListItemFields>();
    /** form-level subscriptions (currently just `params.onChange`, SPEC §15), torn down in `destroy()` */
    const formSubs: Subscription[] = [];

    // one-time snapshot — the synchronous imperative walk below must never re-run from a later
    // paramsSignal() emission (would destroy/re-seed live user input); see FormInstance.params doc.
    const initialParams = paramsSignal();
    const fields = initialParams.fields ?? [];
    if (initialParams.model) this.seedModel(fields, initialParams.model as Record<string, unknown>);
    this.walk(fields, '', form, form, fields, flat, runtimes, initialParams, itemFieldsByGroup);

    const submitting = signal(false);
    const invalidSubmits = signal(0);

    const instance: FormInstance<T> = {
      form,
      fields: flat,
      params: paramsSignal,
      formState: () => this.makeFormState<T>(form, flat),
      fieldState: <F extends FormField>(field: F) =>
        (runtimes.get(field)?.state ?? signal(field)) as Signal<Resolved<F>>,
      control: (field) => runtimes.get(field)?.control,
      listItemFields: (field, index) => {
        const arr = runtimes.get(field)?.control;
        const item = arr instanceof FormArray ? arr.at(index) : undefined;
        return (item && itemFieldsByGroup.get(item)?.top) ?? [];
      },
      // bucket (b): read paramsSignal() fresh here, not `initialParams` above — these three
      // spots (plus autoLabels inside addListItem, below) are the only ones allowed to.
      submitValue: () => this.assembleSubmitValue<T>(form, flat, runtimes, paramsSignal()),
      submit: async () => {
        if (submitting()) return null;
        submitting.set(true);
        try {
          const value = await this.assembleSubmitValue<T>(form, flat, runtimes, paramsSignal());
          if (value === null) {
            invalidSubmits.update((count) => count + 1);
            return null;
          }
          const result = paramsSignal().onSubmit?.(value, this.makeFormState<T>(form, flat));
          if (isObservable(result)) await lastValueFrom(result, { defaultValue: undefined });
          else await result;
          return value;
        } finally {
          submitting.set(false);
        }
      },
      submitting: submitting.asReadonly(),
      invalidSubmits: invalidSubmits.asReadonly(),
      nativeForm: initialParams.nativeForm === true && !fields.some(isStepField),
      selectAttachment: (field, file, index) =>
        this.selectAttachment(field, file, form, flat, runtimes, index),
      clearAttachment: (field, index) => this.clearAttachment(field, runtimes, index),
      addListItem: (path) =>
        this.addListItem(path, form, flat, runtimes, paramsSignal(), cascade, itemFieldsByGroup),
      removeListItem: (path, index) =>
        this.removeListItem(path, index, form, flat, runtimes, itemFieldsByGroup),
      destroy: () => {
        runtimes.forEach((rt) => this.teardownFieldRuntime(rt));
        formSubs.forEach((s) => s.unsubscribe());
        reconcileEffect.destroy();
      },
    };

    if (initialParams.crossValidators?.length) {
      this.attachCrossValidators(form, flat, initialParams.crossValidators);
    }

    // SPEC §1: initial observer pass, declaration order (walk order == declaration order)
    for (const f of flat) this.wireField(f, form, flat, runtimes, cascade);

    // SPEC §15: onChange fires on user-driven changes only — wired after the initial observer
    // pass above so synchronous value writes during resolution don't count as a "change".
    // One-time: changeDebounce is baked into the pipe here and never re-read (accepted gap).
    if (initialParams.onChange) {
      let changes: Observable<T> = form.valueChanges as Observable<T>;
      if (initialParams.changeDebounce)
        changes = changes.pipe(debounceTime(initialParams.changeDebounce));
      formSubs.push(
        changes.subscribe((value) =>
          initialParams.onChange!(value, this.makeFormState<T>(form, flat)),
        ),
      );
    }

    // SPEC §16: reconciles `form`/`flat`/`runtimes` against every LATER `paramsSignal()`
    // emission's field list — skips its own first (build-time) run, same "fire on change only"
    // idiom as the sibling grid engine's `onChangeOnly`. `manualCleanup: true` because
    // `instance.destroy()` must tear this down too (SPEC §10 promises `destroy()` stops
    // everything) — an injector-only cleanup would leave it running (wiring up new subscriptions
    // nothing will ever unsubscribe) if a caller destroys the instance before the component dies.
    let firstReconcile = true;
    let lastFieldsRef: FormField[] | undefined;
    const reconcileEffect = effect(
      () => {
        const p = paramsSignal();
        if (firstReconcile) {
          firstReconcile = false;
          lastFieldsRef = p.fields;
          return;
        }
        const newFields = p.fields ?? [];
        if (newFields === lastFieldsRef) return; // same array reference — nothing to do
        lastFieldsRef = newFields;
        this.reconcile(newFields, form, flat, runtimes, p, cascade, itemFieldsByGroup);
      },
      { injector, manualCleanup: true },
    );

    return instance;
  }

  // ── build: walk configs into controls ─────

  /** seeds `field.value` from `params.model` wherever the field doesn't already define one */
  private seedModel(fields: FormField[], model: Record<string, unknown>): void {
    for (const field of fields) {
      if (isStepField(field)) {
        this.seedModel(field.fields, model);
        continue;
      }
      if (isStaticField(field)) continue;

      const vf = field as ValueFormField;
      const raw = model[vf.key];
      if (raw === undefined || vf.value !== undefined) continue; // explicit field.value wins

      vf.value = raw as never;
      if (isObjectField(vf) && !vf.isList && raw && typeof raw === 'object') {
        this.seedModel(vf.fields, raw as Record<string, unknown>);
      }
    }
  }

  private walk(
    fields: FormField[],
    parentPath: string,
    topForm: FormGroup,
    localForm: FormGroup,
    localFields: FormField[],
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): void {
    for (const field of fields) {
      // SPEC §5: steps flatten — children register on the SAME group
      if (isStepField(field)) {
        flat.push(field);
        runtimes.set(field, this.newRuntime(field, localForm, localFields));
        this.walk(
          field.fields,
          parentPath,
          topForm,
          localForm,
          field.fields,
          flat,
          runtimes,
          params,
          itemFieldsByGroup,
        );
        continue;
      }

      if (isStaticField(field)) {
        flat.push(field);
        runtimes.set(field, this.newRuntime(field, localForm, localFields));
        continue;
      }

      // value-carrying field
      const vf = field as ValueFormField;
      const path = computeValuePath(parentPath, vf.key);
      vf.path = path;
      if (params.autoLabels !== false && vf.label === undefined) {
        vf.label = this.labelFromKey(vf.key);
      }

      const control = this.createControl(
        vf,
        path,
        topForm,
        flat,
        runtimes,
        params,
        itemFieldsByGroup,
      );
      localForm.addControl(vf.key, control);

      flat.push(vf);
      const rt = this.newRuntime(vf, localForm, localFields);
      rt.control = control;
      runtimes.set(vf, rt);
    }
  }

  private createControl(
    field: ValueFormField,
    path: string,
    topForm: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): AbstractControl {
    if (!field.isList) {
      if (isObjectField(field)) {
        const group = new FormGroup({});
        this.walk(
          field.fields,
          path,
          topForm,
          group,
          field.fields,
          flat,
          runtimes,
          params,
          itemFieldsByGroup,
        );
        return group;
      }
      const initial = isObserver(field.value) ? null : (field.value ?? field.defaultValue ?? null);
      return new FormControl(
        { value: initial, disabled: field.disabled === true },
        {
          validators: this.syncValidators(field.validations),
          asyncValidators: this.asyncValidators(field.validations),
          updateOn: field.updateOn ?? 'change',
        },
      );
    }

    // SPEC §4: list ⇒ FormArray; per-item `validations`, array-level `listValidations`
    const arr = new FormArray<AbstractControl>([], {
      validators: [
        ...this.syncValidators(field.listValidations),
        ...this.minMaxItemsValidators(field),
      ],
      asyncValidators: this.asyncValidators(field.listValidations),
    });

    const initialValues = Array.isArray(field.value) ? field.value : undefined;
    const initialCount = initialValues?.length ?? field.minItems ?? 0;
    for (let i = 0; i < initialCount; i++) {
      arr.push(
        this.createListItem(
          field,
          path,
          i,
          initialValues?.[i],
          topForm,
          flat,
          runtimes,
          params,
          itemFieldsByGroup,
        ),
      );
    }
    return arr;
  }

  /**
   * Builds one item control of an isList field at `index`, seeding it from `rowValue`
   * (a slice of `field.value`/`params.model`) when present. For object items this clones
   * the template `field.fields` (so per-item runtime state is isolated, SPEC §4) and records
   * the clones in `itemFieldsByGroup` so the renderer and `FormInstance.listItemFields` can
   * find them later — including after `addListItem`, which reuses this same builder.
   */
  private createListItem(
    field: ValueFormField,
    path: string,
    index: number,
    rowValue: unknown,
    topForm: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): AbstractControl {
    if (isObjectField(field)) {
      const group = new FormGroup({});
      const itemPath = `${path}.${index}`;
      const itemFields: FormField[] = [];
      const cloned = field.fields.map((f) => ({ ...f }) as FormField);
      this.walk(
        cloned,
        itemPath,
        topForm,
        group,
        cloned,
        itemFields,
        runtimes,
        params,
        itemFieldsByGroup,
      );
      itemFieldsByGroup.set(group, { top: cloned, flat: itemFields });
      flat.push(...itemFields);
      if (rowValue && typeof rowValue === 'object') {
        group.patchValue(rowValue as Record<string, unknown>, { emitEvent: false });
      }
      return group;
    }

    return new FormControl(rowValue ?? field.defaultValue ?? null, {
      validators: this.syncValidators(field.validations),
      asyncValidators: this.asyncValidators(field.validations),
      updateOn: field.updateOn ?? 'change',
    });
  }

  // ── wiring: Dynamic props, valueFn, onChange ──

  private wireField(
    field: FormField,
    topForm: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    cascade: Set<string>,
  ): void {
    const rt = runtimes.get(field);
    if (!rt) return;

    // 1) per-prop observers (any prop declared as ObserverParameter)
    for (const [prop, raw] of Object.entries(field)) {
      if (prop === 'field' || !isObserver(raw as Dynamic<unknown>)) continue;
      const def = raw as ObserverParameter<unknown>;
      rt.propSubs.set(
        prop,
        this.observePaths(def, topForm, flat, runtimes, field.path).subscribe((resolved) =>
          this.applyProp(field, prop, resolved, rt, cascade),
        ),
      );
    }

    // 2) select `options` passed as a bare Observable (not wrapped in `observe()` — the README's
    //    own usage example does this: `options: countries$`). Resolve it the same way Dynamic
    //    props resolve; `isObserver` above only catches ObserverParameter, not raw Observables.
    if (field.type === FieldType.select && isObservable(field.options)) {
      rt.optionsSub = field.options.subscribe((options) =>
        this.applyProp(field, 'options', options, rt, cascade),
      );
    }

    // 3) batched patch (SPEC §3): shallow merge, last write wins
    if (field.field) {
      const def = field.field;
      rt.fieldPatchSub = this.observePaths(def, topForm, flat, runtimes, field.path).subscribe(
        (patch) => {
          for (const [prop, value] of Object.entries(patch ?? {})) {
            this.applyProp(field, prop, value, rt, cascade);
          }
        },
      );
    }

    // 4) valueFn + onChange on user-driven changes (SPEC §8)
    if (isValueField(field) && rt.control) {
      const control = rt.control;
      let changes = control.valueChanges as Observable<unknown>;
      if (field.debounce) changes = changes.pipe(debounceTime(field.debounce));
      let previous: unknown = control.value;
      let applyingValueFn = false;

      rt.changeSub = changes.subscribe(async (value) => {
        if (applyingValueFn) return;
        let next = value;
        if (field.valueFn) {
          next = await field.valueFn(value as never, this.makeFormState(topForm, flat));
          if (next !== value) {
            applyingValueFn = true;
            control.setValue(next); // emits; no markAsDirty (SPEC §1)
            applyingValueFn = false;
          }
        }
        field.onChange?.(
          next as never,
          this.makeFieldChange(next, previous, field, topForm, flat, rt) as never,
        );
        previous = next;
      });
    }
  }

  /**
   * combineLatest over the observed paths → switchMap(callback) (SPEC §2 latest-wins).
   * `ownPath` is the OBSERVING field's own `.path` — needed to resolve a `'./sibling'` path
   * (see dynamic.interface.ts) against that field's own isList item group, when present.
   */
  private observePaths(
    def: ObserverParameter<unknown>,
    topForm: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    ownPath?: string,
  ): Observable<unknown> {
    const paths = Array.isArray(def.paths) ? def.paths : [def.paths];
    const sources = paths.map((raw) => {
      const p = this.resolveObservedPath(raw, ownPath);
      const control = topForm.get(p);
      if (!control) {
        console.warn(`[FormEngine] observe: no control at path '${p}'`);
        return from([undefined]);
      }
      let src = control.valueChanges.pipe(startWith(control.value));
      const sourceField = flat.find((f) => f.path === p);
      if (sourceField && isValueField(sourceField) && sourceField.debounce) {
        src = src.pipe(debounceTime(sourceField.debounce));
      }
      return src;
    });
    return combineLatestValues(sources).pipe(
      switchMap((values) => from(Promise.resolve(def.callback(...values)))),
    );
  }

  /** `'./sibling'` ⇒ resolved against `ownPath`'s OWN isList item group (its path minus its own
   *  last segment); any other path is already absolute (top-form scope) and passes through as-is. */
  private resolveObservedPath(path: string, ownPath?: string): string {
    if (!path.startsWith('./')) return path;
    const itemGroupPath = ownPath?.split('.').slice(0, -1).join('.');
    if (!itemGroupPath) {
      console.warn(`[FormEngine] observe: relative path '${path}' used outside an isList item`);
      return path.slice(2);
    }
    return `${itemGroupPath}.${path.slice(2)}`;
  }

  /** route a resolved prop value to config / control (SPEC §1 cycle guard on value writes) */
  private applyProp(
    field: FormField,
    prop: string,
    value: unknown,
    rt: FieldRuntime,
    cascade: Set<string>,
  ): void {
    if (prop === 'value' && rt.control) {
      const path = field.path ?? (field.key || '');
      if (cascade.has(path)) {
        console.warn(`[FormEngine] cycle: skipped repeated write to '${path}' in one cascade`);
        return;
      }
      cascade.add(path);
      queueMicrotask(() => cascade.delete(path));
      rt.control.setValue(value); // emits; cascades allowed (SPEC §1)
      return; // control value is read reactively off the control itself, not `state`
    }
    if (prop === 'disabled' && rt.control) {
      value ? rt.control.disable() : rt.control.enable();
      (field as { disabled?: unknown }).disabled = value;
      this.pushState(rt, field);
      return;
    }
    if (prop === 'visible') {
      (field as { visible?: unknown }).visible = value;
      // SPEC §6: suspend validators while hidden; optionally clear
      if (rt.control && isValueField(field)) {
        if (value === false) {
          rt.control.clearValidators();
          if (field.clearOnHide) rt.control.setValue(field.defaultValue ?? null);
        } else {
          rt.control.setValidators(this.syncValidators(field.validations));
        }
        rt.control.updateValueAndValidity({ emitEvent: false });
      }
      this.pushState(rt, field);
      return;
    }
    (field as unknown as Record<string, unknown>)[prop] = value;
    this.pushState(rt, field);
  }

  /** re-emits `field` as a fresh clone on its runtime's signal (see FieldRuntime.state) */
  private pushState(rt: FieldRuntime, field: FormField): void {
    rt.state.set({ ...field } as FormField);
  }

  // ── attachments (SPEC §11) ─────────────────

  private async selectAttachment(
    field: FormField,
    file: File,
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    index?: number,
  ): Promise<void> {
    if (field.type !== FieldType.attachment) return;
    const rt = runtimes.get(field);
    if (!rt) return;
    const control =
      index !== undefined
        ? rt.control instanceof FormArray
          ? rt.control.at(index)
          : undefined
        : rt.control;
    if (!control) return;

    const meta: AttachmentMeta = {
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      status: 'pending',
    };
    this.writeAttachmentMeta(field, meta, index, rt);

    // 'submit' timing: stays 'pending' until FormInstance.submitValue() uploads it (SPEC §11)
    if ((field.uploadOn ?? 'select') === 'submit') return;

    await this.runAttachmentUpload(field, control, meta, this.makeFormState(form, flat), rt, index);
  }

  private clearAttachment(
    field: FormField,
    runtimes: Map<FormField, FieldRuntime>,
    index?: number,
  ): void {
    if (field.type !== FieldType.attachment) return;
    const rt = runtimes.get(field);
    if (!rt) return;
    const control =
      index !== undefined
        ? rt.control instanceof FormArray
          ? rt.control.at(index)
          : undefined
        : rt.control;
    if (!control) return;

    control.setValue(null);
    this.clearControlError(control, 'uploading');
    this.clearControlError(control, 'upload');

    if (index === undefined) {
      field.attachment = undefined;
    } else if (Array.isArray(field.attachment)) {
      const list = [...field.attachment];
      delete list[index]; // sparse hole; the FormArray slot itself is left for removeListItem
      field.attachment = list;
    }
    this.pushState(rt, field);
  }

  private writeAttachmentMeta(
    field: AttachmentField,
    meta: AttachmentMeta,
    index: number | undefined,
    rt: FieldRuntime,
  ): void {
    if (index === undefined) {
      field.attachment = meta;
    } else {
      const list = Array.isArray(field.attachment) ? [...field.attachment] : [];
      list[index] = meta;
      field.attachment = list;
    }
    this.pushState(rt, field);
  }

  /** uploads (or base64-reads) one file and reflects status/errors per SPEC §11 */
  private async runAttachmentUpload(
    field: AttachmentField,
    control: AbstractControl,
    meta: AttachmentMeta,
    formState: FormState,
    rt: FieldRuntime,
    index?: number,
  ): Promise<void> {
    meta.status = 'uploading';
    this.writeAttachmentMeta(field, meta, index, rt);
    this.setControlError(control, 'uploading', true);

    try {
      const file = meta.file as File;
      const value = field.uploadFn
        ? await this.resolveUpload(field.uploadFn(file, formState))
        : await readFileAsBase64(file);
      meta.status = 'done';
      meta.error = undefined;
      this.writeAttachmentMeta(field, meta, index, rt);
      this.clearControlError(control, 'uploading');
      control.setValue(value);
    } catch (err) {
      meta.status = 'error';
      meta.error = err instanceof Error ? err.message : String(err);
      this.writeAttachmentMeta(field, meta, index, rt);
      this.clearControlError(control, 'uploading');
      this.setControlError(control, 'upload', meta.error);
    }
  }

  private resolveUpload(result: Promise<string> | Observable<string>): Promise<string> {
    return isObservable(result) ? lastValueFrom(result) : result;
  }

  private setControlError(control: AbstractControl, key: string, value: unknown): void {
    control.setErrors({ ...(control.errors ?? {}), [key]: value });
  }

  private clearControlError(control: AbstractControl, key: string): void {
    if (!control.errors || !(key in control.errors)) return;
    const errors = { ...control.errors };
    delete errors[key];
    control.setErrors(Object.keys(errors).length ? errors : null);
  }

  // ── submit (SPEC §7) ──────────────────────

  private async assembleSubmitValue<T>(
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: FormParameter<T>,
  ): Promise<T | null> {
    const uploads = await this.runDeferredUploads(flat, runtimes, form);
    if (!uploads.ok || form.invalid) {
      form.markAllAsTouched();
      return null;
    }

    const raw = form.getRawValue() as Record<string, unknown>;
    const state = this.makeFormState<T>(form, flat);

    for (const field of flat) {
      if (isStaticField(field) || isStepField(field)) continue;
      const path = field.path ?? field.key;
      if (!path) continue;

      const ignore = field.ignoreOnSubmit === true;
      // hidden fields are included by default — unlike disabled fields, which are also
      // included by default via `params.includeDisabled` (see base-field.interface.ts)
      const hidden = field.visible === false && field.excludeHiddenOnSubmit === true;
      const dropDisabled =
        params.includeDisabled === false && runtimes.get(field)?.control?.disabled === true;

      if (ignore || hidden || dropDisabled) {
        deleteAtPath(raw, path);
        continue;
      }
      if (field.toSubmit) {
        setAtPath(raw, path, field.toSubmit(getAtPath(raw, path) as never, state as FormState));
      }
    }
    return raw as T;
  }

  /** SPEC §11: `uploadOn: 'submit'` attachments upload here, awaited before the payload is built */
  private async runDeferredUploads(
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    form: FormGroup,
  ): Promise<{ ok: boolean }> {
    const formState = this.makeFormState<Record<string, unknown>>(form, flat);
    const tasks: Promise<void>[] = [];

    for (const field of flat) {
      if (field.type !== FieldType.attachment || (field.uploadOn ?? 'select') !== 'submit')
        continue;
      const rt = runtimes.get(field);
      if (!rt?.control) continue;
      const control = rt.control;

      if (Array.isArray(field.attachment) && control instanceof FormArray) {
        field.attachment.forEach((meta, i) => {
          if (meta?.file && meta.status !== 'done') {
            const item = control.at(i);
            if (item) tasks.push(this.runAttachmentUpload(field, item, meta, formState, rt, i));
          }
        });
      } else if (
        field.attachment &&
        !Array.isArray(field.attachment) &&
        field.attachment.file &&
        field.attachment.status !== 'done'
      ) {
        tasks.push(this.runAttachmentUpload(field, control, field.attachment, formState, rt));
      }
    }

    if (!tasks.length) return { ok: true };
    await Promise.all(tasks);

    const failed = flat.some((field) => {
      if (field.type !== FieldType.attachment) return false;
      return Array.isArray(field.attachment)
        ? field.attachment.some((m) => m?.status === 'error')
        : field.attachment?.status === 'error';
    });
    return { ok: !failed };
  }

  // ── lists (SPEC §4, §10) ──────────────────

  private addListItem(
    path: string,
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    cascade: Set<string>,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): void {
    const field = flat.find((f) => f.path === path);
    const arr = form.get(path);
    if (!field || !isValueField(field) || !(arr instanceof FormArray)) return;
    if (field.maxItems !== undefined && arr.length >= field.maxItems) return;

    const control = this.createListItem(
      field,
      path,
      arr.length,
      undefined,
      form,
      flat,
      runtimes,
      params,
      itemFieldsByGroup,
    );
    arr.push(control);

    if (isObjectField(field)) {
      for (const f of itemFieldsByGroup.get(control)?.flat ?? [])
        this.wireField(f, form, flat, runtimes, cascade);
    }
  }

  /** Tears down + removes every field whose `.path` is `prefix` itself or starts with `${prefix}.`
   *  from BOTH `runtimes` (unsubscribing first) and `flat` (spliced, not just Map-deleted — a
   *  Map-only delete leaves the removed field's (now-stale-pathed) object sitting in `flat`
   *  forever, which can collide with a later field/item that computes the same path). */
  private pruneFieldsUnderPath(
    prefix: string,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
  ): void {
    for (let i = flat.length - 1; i >= 0; i--) {
      const f = flat[i];
      if (f.path === prefix || f.path?.startsWith(`${prefix}.`)) {
        const rt = runtimes.get(f);
        if (rt) {
          this.teardownFieldRuntime(rt);
          runtimes.delete(f);
        }
        flat.splice(i, 1);
      }
    }
  }

  private removeListItem(
    path: string,
    index: number,
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): void {
    const arr = form.get(path);
    if (!(arr instanceof FormArray)) return;

    // SPEC §10: tear down subscriptions of the removed item's fields
    const removed = arr.at(index);
    if (removed) itemFieldsByGroup.delete(removed);
    this.pruneFieldsUnderPath(`${path}.${index}`, flat, runtimes);
    arr.removeAt(index);

    // isList attachment fields keep per-index metadata (SPEC §11) in parallel with the
    // FormArray — splice it too, or it drifts out of alignment with the shifted indices
    const field = flat.find((f) => f.path === path);
    if (field?.type === FieldType.attachment && Array.isArray(field.attachment)) {
      field.attachment = field.attachment.filter((_, i) => i !== index);
      const rt = runtimes.get(field);
      if (rt) this.pushState(rt, field);
    }

    // items after `index` shifted down one slot — their cached `.path` strings (used for
    // submit assembly and observer paths) must follow, or they'll point at stale/missing data
    this.reindexListItems(path, arr, itemFieldsByGroup);
  }

  /** realigns `.path` on every remaining item's field tree with its current FormArray index */
  private reindexListItems(
    arrayPath: string,
    arr: FormArray,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): void {
    for (let i = 0; i < arr.length; i++) {
      const itemFields = itemFieldsByGroup.get(arr.at(i))?.flat;
      const first = itemFields?.[0];
      if (!itemFields?.length || !first?.path) continue;

      const rest = first.path.slice(arrayPath.length + 1);
      const oldIndexSegment = rest.slice(
        0,
        rest.indexOf('.') === -1 ? undefined : rest.indexOf('.'),
      );
      const oldItemPath = `${arrayPath}.${oldIndexSegment}`;
      const newItemPath = `${arrayPath}.${i}`;
      if (oldItemPath === newItemPath) continue;

      for (const f of itemFields) {
        if (f.path?.startsWith(oldItemPath))
          f.path = newItemPath + f.path.slice(oldItemPath.length);
      }
    }
  }

  // ── reconciliation (SPEC §16): keeps `form`/`flat`/`runtimes` in sync with a LATER
  // `paramsSignal()` emission's field list, without ever rebuilding the FormGroup/its controls
  // from scratch — see the field-list-reconciliation plan doc for the full design. ──

  /** builds a brand-new field's control and splices it into the live tree at `path`, reusing
   *  `walk()`/`createControl()` exactly as the initial build does — nothing isList-specific
   *  blocks reuse here, `walk()` just needs the same (parentPath, parentGroup, siblings) triple
   *  a normal build would have passed it. */
  private addFieldAt(
    path: string,
    field: ValueFormField,
    siblings: FormField[],
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
    cascade: Set<string>,
  ): void {
    const dot = path.lastIndexOf('.');
    const parentPath = dot === -1 ? '' : path.slice(0, dot);
    const parentGroup = parentPath ? (form.get(parentPath) as FormGroup | null) : form;
    if (!parentGroup) {
      console.warn(
        `[FormEngine] reconcile: no parent group at '${parentPath}' for new field '${path}'`,
      );
      return;
    }
    const before = flat.length;
    this.walk(
      [field],
      parentPath,
      form,
      parentGroup,
      siblings,
      flat,
      runtimes,
      params,
      itemFieldsByGroup,
    );
    for (const f of flat.slice(before)) this.wireField(f, form, flat, runtimes, cascade);
  }

  /** detaches a field's control from the live tree at `path` and tears down everything under it
   *  — a no-op if it's already gone (safe to call on a path whose ancestor was just removed). */
  private removeFieldAt(
    path: string,
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
  ): void {
    const dot = path.lastIndexOf('.');
    const parentGroup = dot === -1 ? form : (form.get(path.slice(0, dot)) as FormGroup | null);
    parentGroup?.removeControl(path.slice(dot + 1));
    this.pruneFieldsUnderPath(path, flat, runtimes);
  }

  /** moves a KEPT field's runtime bookkeeping from its old (now-orphaned) object reference to
   *  the new one the caller's `params()` emission just supplied — the actual crash fix: existing
   *  subscriptions safely stay closed over the old object (every render read flows through the
   *  stable `rt.state` signal, never raw field identity), this just makes `control()`/
   *  `fieldState()` resolvable against the reference the render layer now holds. Also (tier 2)
   *  pushes a coherent merged state snapshot and, if the field's DECLARED config genuinely
   *  changed (not just re-resolved), hands off to `rewireField` to surgically re-wire it. */
  private reKeyField(
    oldField: ValueFormField,
    newField: ValueFormField,
    rt: FieldRuntime,
    newSiblings: FormField[],
    topForm: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    cascade: Set<string>,
  ): void {
    runtimes.delete(oldField);
    runtimes.set(newField, rt);
    const i = flat.indexOf(oldField);
    if (i !== -1) flat[i] = newField;
    rt.localFields = newSiblings;

    const changed = diffDeclaredConfig(rt.declaredConfig, newField);

    // coherent merged snapshot: fresh static shape from `newField`, but for props that are
    // STILL Dynamic and UNCHANGED, keep the currently-RESOLVED value (rt.field) — newField's own
    // raw value there is still an unresolved ObserverParameter; pushing it as-is would regress
    // `state()`/rendering back to a raw, never-applied Dynamic definition.
    const merged: Record<string, unknown> = { ...newField };
    const declaredRec = rt.declaredConfig as unknown as Record<string, unknown>;
    for (const key of Object.keys(declaredRec)) {
      if (!changed.has(key) && isObserver(declaredRec[key] as Dynamic<unknown>)) {
        merged[key] = (rt.field as unknown as Record<string, unknown>)[key];
      }
    }
    rt.state.set(merged as unknown as FormField);

    if (changed.size > 0) {
      this.rewireField(newField, rt, topForm, flat, runtimes, cascade);
    } else {
      rt.field = newField;
      rt.declaredConfig = { ...newField };
    }
  }

  /** SPEC §16 (tier 2): a KEPT field whose declared config genuinely changed — tears down and
   *  re-establishes only the wiring categories whose inputs actually differ (per `diffDeclaredConfig`),
   *  leaving everything else (including the live control's value/dirty/touched state) untouched.
   *  In particular, category 4 (valueFn/onChange) is only rewired when `valueFn`/`onChange`/
   *  `debounce` themselves changed — an unrelated prop change (e.g. just `label`) never resets
   *  its `previous`-value closure. */
  private rewireField(
    newField: ValueFormField,
    rt: FieldRuntime,
    topForm: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    cascade: Set<string>,
  ): void {
    const changed = diffDeclaredConfig(rt.declaredConfig, newField);
    if (changed.size === 0) {
      rt.field = newField;
      rt.declaredConfig = { ...newField };
      return;
    }

    // 1. control-level validators — mutate the CONTROL, not just the config object.
    //    `updateOn` has no post-construction Angular API — a changed `updateOn` on a kept field
    //    is a documented no-op.
    if (rt.control && changed.has('validations')) {
      rt.control.setValidators(this.syncValidators(newField.validations));
      rt.control.setAsyncValidators(this.asyncValidators(newField.validations));
      rt.control.updateValueAndValidity({ emitEvent: false });
    }

    // 2. per-prop observers (category 1) — only the props that actually changed
    for (const prop of changed) {
      if (['field', 'valueFn', 'onChange', 'debounce', 'options', 'validations'].includes(prop)) {
        continue;
      }
      rt.propSubs.get(prop)?.unsubscribe();
      rt.propSubs.delete(prop);
      const raw = (newField as unknown as Record<string, unknown>)[prop];
      if (isObserver(raw as Dynamic<unknown>)) {
        rt.propSubs.set(
          prop,
          this.observePaths(
            raw as ObserverParameter<unknown>,
            topForm,
            flat,
            runtimes,
            newField.path,
          ).subscribe((resolved) => this.applyProp(newField, prop, resolved, rt, cascade)),
        );
      }
    }

    // 3. category 2 (select bare-Observable options)
    if (changed.has('options') && newField.type === FieldType.select) {
      rt.optionsSub?.unsubscribe();
      rt.optionsSub = isObservable(newField.options)
        ? newField.options.subscribe((o) => this.applyProp(newField, 'options', o, rt, cascade))
        : undefined;
    }

    // 4. category 3 (batched `field` patch)
    if (changed.has('field')) {
      rt.fieldPatchSub?.unsubscribe();
      rt.fieldPatchSub = newField.field
        ? this.observePaths(newField.field, topForm, flat, runtimes, newField.path).subscribe(
            (patch) => {
              for (const [p, v] of Object.entries(patch ?? {})) {
                this.applyProp(newField, p, v, rt, cascade);
              }
            },
          )
        : undefined;
    }

    // 5. category 4 — ONLY if valueFn/onChange/debounce actually differ; `previous` resets here
    //    (unavoidable — a fresh closure needs a fresh baseline), but this is now the exception,
    //    not the rule, since an unrelated prop change never reaches this branch.
    if (
      (changed.has('valueFn') || changed.has('onChange') || changed.has('debounce')) &&
      rt.control
    ) {
      rt.changeSub?.unsubscribe();
      const control = rt.control;
      let changes = control.valueChanges as Observable<unknown>;
      if (newField.debounce) changes = changes.pipe(debounceTime(newField.debounce));
      let previous: unknown = control.value;
      let applyingValueFn = false;
      rt.changeSub = changes.subscribe(async (value) => {
        if (applyingValueFn) return;
        let next = value;
        if (newField.valueFn) {
          next = await newField.valueFn(value as never, this.makeFormState(topForm, flat));
          if (next !== value) {
            applyingValueFn = true;
            control.setValue(next);
            applyingValueFn = false;
          }
        }
        newField.onChange?.(
          next as never,
          this.makeFieldChange(next, previous, newField, topForm, flat, rt) as never,
        );
        previous = next;
      });
    }

    rt.field = newField;
    rt.declaredConfig = { ...newField };
  }

  /** the shared add/remove/re-key applier — diffs `newFields` (scoped under `parentPath`, against
   *  `oldEligible`) and applies the minimal set of operations to match, never touching a control
   *  whose field was kept. Removals apply before additions; both are reduced to subtree roots
   *  first so a nested field isn't independently touched once for itself and again as part of its
   *  own (already-handled) ancestor. Used both for the TOP-level reconcile pass (`parentPath: ''`)
   *  and, per item, for tier 3's "3b" per-item template resync (`parentPath: '<listPath>.<index>'`). */
  private reconcileSubtree(
    newFields: FormField[],
    parentPath: string,
    oldEligible: Map<string, ValueFormField>,
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    cascade: Set<string>,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): void {
    const entries = diffFieldTree(oldEligible, newFields, parentPath);

    const added = entries.filter((e) => e.kind === 'added');
    const removed = entries.filter((e) => e.kind === 'removed');
    const keptSame = entries.filter((e) => e.kind === 'kept-same');

    // a kept-but-type-changed field is a targeted remove+add for that one field only —
    // documented value-loss tradeoff, every other field is untouched
    for (const e of entries) {
      if (e.kind !== 'kept-type-changed' || !e.oldField || !e.newField) continue;
      removed.push({ path: e.path, kind: 'removed', oldField: e.oldField });
      added.push({ path: e.path, kind: 'added', newField: e.newField, newSiblings: e.newSiblings });
    }

    const removedRoots = removed.filter(
      (e) => !removed.some((o) => o !== e && e.path.startsWith(`${o.path}.`)),
    );
    for (const e of removedRoots) this.removeFieldAt(e.path, form, flat, runtimes);

    const addedRoots = added
      .filter((e) => !added.some((o) => o !== e && e.path.startsWith(`${o.path}.`)))
      .sort((a, b) => a.path.split('.').length - b.path.split('.').length); // parents before children
    for (const e of addedRoots) {
      if (!e.newField) continue;
      this.addFieldAt(
        e.path,
        e.newField,
        e.newSiblings ?? [],
        form,
        flat,
        runtimes,
        params,
        itemFieldsByGroup,
        cascade,
      );
    }

    for (const e of keptSame) {
      if (!e.oldField || !e.newField) continue;
      const rt = runtimes.get(e.oldField);
      if (!rt) continue;
      this.reKeyField(
        e.oldField,
        e.newField,
        rt,
        e.newSiblings ?? [],
        form,
        flat,
        runtimes,
        cascade,
      );
    }
  }

  /** the reconciliation pass itself — top-level fields (tiers 1+2), plus, for every kept isList
   *  field (tier 3), re-keys/rewires the list field itself and reconciles its items. */
  private reconcile(
    newFields: FormField[],
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    cascade: Set<string>,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
  ): void {
    const oldEligible = collectOldEligible(runtimes);
    const entries = diffFieldTree(oldEligible, newFields);
    this.reconcileSubtree(
      newFields,
      '',
      oldEligible,
      form,
      flat,
      runtimes,
      params,
      cascade,
      itemFieldsByGroup,
    );

    for (const e of entries) {
      if (e.kind !== 'kept-list' || !e.oldField || !e.newField || !isObjectField(e.newField))
        continue;
      const rt = runtimes.get(e.oldField);
      if (!rt || !(rt.control instanceof FormArray)) continue;
      this.reKeyField(
        e.oldField,
        e.newField,
        rt,
        e.newSiblings ?? [],
        form,
        flat,
        runtimes,
        cascade,
      );

      const arr = rt.control;
      const path = e.newField.path ?? e.path;
      const newValues = Array.isArray(e.newField.value)
        ? (e.newField.value as unknown[])
        : undefined;
      const templateChanged = e.newField.fields !== rt.lastItemTemplate;

      if (newValues && newValues !== rt.lastListValue) {
        // structural add/remove/reorder — 3b (item-template resync) runs as its final step,
        // using whatever `e.newField.fields` currently is, so a value AND template change in the
        // same emission is handled correctly in one pass.
        rt.lastListValue = newValues;
        this.reconcileListItems(
          e.newField,
          arr,
          path,
          newValues,
          form,
          flat,
          runtimes,
          params,
          itemFieldsByGroup,
          cascade,
        );
      } else if (templateChanged) {
        // no structural change, but the item TEMPLATE itself changed — 3b alone, no add/remove/
        // reorder needed (nothing in `field.value` moved)
        this.reconcileListItemTemplate(
          e.newField,
          arr,
          path,
          form,
          flat,
          runtimes,
          params,
          itemFieldsByGroup,
          cascade,
        );
      }
      rt.lastItemTemplate = e.newField.fields;
    }
  }

  /** tier 3: reconciles an isList field's items against a freshly-supplied `newValues` array,
   *  by identity (`field.itemKey`, defaulting to positional index — i.e. tail-append/tail-trim
   *  only, no reordering, a safe no-op for existing non-opted-in usage). Moves survivors' SAME
   *  control instances (confirmed state-preserving, SPEC §16) rather than rebuilding them, so a
   *  reorder never disturbs a surviving item's live value/dirty/touched state. */
  private reconcileListItems(
    field: ValueFormField,
    arr: FormArray,
    path: string,
    newValues: unknown[],
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
    cascade: Set<string>,
  ): void {
    const keyFn = (isObjectField(field) && field.itemKey) || ((_: unknown, i: number) => i);
    const oldKeys = arr.controls.map((c, i) => keyFn(c.getRawValue(), i));
    const newKeys = newValues.map((v, i) => keyFn(v, i));
    const oldIndexByKey = new Map(oldKeys.map((k, i) => [k, i]));
    const newIndexByKey = new Map(newKeys.map((k, i) => [k, i]));

    // 1. removals, descending index order (keeps not-yet-processed indices stable)
    for (let i = oldKeys.length - 1; i >= 0; i--) {
      if (newIndexByKey.has(oldKeys[i])) continue;
      itemFieldsByGroup.delete(arr.at(i));
      this.pruneFieldsUnderPath(`${path}.${i}`, flat, runtimes);
      arr.removeAt(i, { emitEvent: false });
    }

    // 2. reorder survivors in place — moves the SAME control instances, nothing rebuilt
    const survivors = newKeys.filter((k) => oldIndexByKey.has(k));
    for (let target = 0; target < survivors.length; target++) {
      const current = arr.controls.findIndex(
        (c, i) => keyFn(c.getRawValue(), i) === survivors[target],
      );
      if (current !== target) arr.controls.splice(target, 0, arr.controls.splice(current, 1)[0]);
    }
    arr.updateValueAndValidity({ emitEvent: false });

    // 3. insertions — built exactly like addListItem does, spliced at their target index
    newKeys.forEach((key, targetIndex) => {
      if (oldIndexByKey.has(key)) return;
      const control = this.createListItem(
        field,
        path,
        targetIndex,
        newValues[targetIndex],
        form,
        flat,
        runtimes,
        params,
        itemFieldsByGroup,
      );
      arr.insert(targetIndex, control, { emitEvent: false });
      if (isObjectField(field)) {
        for (const f of itemFieldsByGroup.get(control)?.flat ?? []) {
          this.wireField(f, form, flat, runtimes, cascade);
        }
      }
    });

    // 4. realign every item's cached .path with its FINAL index (reused verbatim, unmodified)
    this.reindexListItems(path, arr, itemFieldsByGroup);

    // 3b: now that paths are final, resync each item's OWN sub-field template (object items
    // only — a plain-control item has no per-item field tree to reconcile)
    if (isObjectField(field)) {
      this.reconcileListItemTemplate(
        field,
        arr,
        path,
        form,
        flat,
        runtimes,
        params,
        itemFieldsByGroup,
        cascade,
      );
    }

    arr.updateValueAndValidity({ emitEvent: true }); // one emission for the whole batch
  }

  /** tier 3 "3b": resyncs each item's own field tree against the (possibly changed) item
   *  template `field.fields` — reuses `reconcileSubtree` (the same machinery `reconcile()` uses
   *  at the top level), scoped to one item's absolute path prefix so a kept sub-field re-keys
   *  in place instead of being torn down, exactly like a top-level field would. */
  private reconcileListItemTemplate(
    field: ObjectField,
    arr: FormArray,
    path: string,
    form: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
    params: AnyParams,
    itemFieldsByGroup: WeakMap<AbstractControl, ListItemFields>,
    cascade: Set<string>,
  ): void {
    for (let i = 0; i < arr.length; i++) {
      const itemGroup = arr.at(i);
      const existing = itemFieldsByGroup.get(itemGroup);
      if (!existing) continue; // shouldn't happen for an object item, but nothing to resync if so

      const itemPath = `${path}.${i}`;
      const oldEligible = new Map<string, ValueFormField>();
      for (const f of existing.flat) {
        if (isValueField(f) && f.path) oldEligible.set(f.path, f as ValueFormField);
      }

      const clonedTemplate = field.fields.map((f) => ({ ...f }) as FormField);
      this.reconcileSubtree(
        clonedTemplate,
        itemPath,
        oldEligible,
        form,
        flat,
        runtimes,
        params,
        cascade,
        itemFieldsByGroup,
      );

      const newFlatForItem = flat.filter((f) => f.path?.startsWith(`${itemPath}.`));
      itemFieldsByGroup.set(itemGroup, { top: clonedTemplate, flat: newFlatForItem });
    }
  }

  // ── cross validators (SPEC §9) ────────────

  private attachCrossValidators(form: FormGroup, flat: FormField[], rules: CrossValidator[]): void {
    const sync: ValidatorFn[] = [];
    for (const rule of rules) {
      if (rule.type === 'match') {
        sync.push((c) => {
          const values = rule.fields.map((p) => c.get(p)?.value);
          const ok = values.every((v) => v === values[0]);
          return this.place(form, rule, ok, rule.message ?? 'Fields must match');
        });
      } else if (rule.type === 'requiredIf') {
        sync.push((c) => {
          const trigger = c.get(rule.when)?.value;
          const active = rule.equals !== undefined ? trigger === rule.equals : !!trigger;
          const value = c.get(rule.field)?.value;
          const ok = !active || (value !== null && value !== undefined && value !== '');
          return this.place(form, rule, ok, rule.message ?? `${rule.field} is required`);
        });
      } else {
        const asyncFn: AsyncValidatorFn = async (c) => {
          const values = Object.fromEntries(rule.fields.map((p) => [p, c.get(p)?.value]));
          const ok = await rule.validate(values, this.makeFormState(form, flat));
          return this.place(form, rule, ok, rule.message);
        };
        form.addAsyncValidators(asyncFn);
      }
    }
    if (sync.length) form.addValidators(sync);
    form.updateValueAndValidity({ emitEvent: false });
  }

  private place(
    form: FormGroup,
    rule: CrossValidator,
    ok: boolean,
    message: string,
  ): ValidationErrors | null {
    const target = rule.showOn ? form.get(rule.showOn) : null;
    if (target) {
      const errors = { ...(target.errors ?? {}) };
      if (ok) delete errors[rule.type];
      else errors[rule.type] = message;
      target.setErrors(Object.keys(errors).length ? errors : null);
    }
    return ok ? null : { [rule.type]: message };
  }

  // ── helpers ───────────────────────────────

  private newRuntime(
    field: FormField,
    localForm: FormGroup,
    localFields: FormField[],
  ): FieldRuntime {
    return {
      field,
      localForm,
      localFields,
      declaredConfig: { ...field },
      propSubs: new Map(),
      lastListValue: Array.isArray((field as ValueFormField).value)
        ? ((field as ValueFormField).value as unknown[])
        : undefined,
      lastItemTemplate: isObjectField(field) && field.isList ? field.fields : undefined,
      state: signal(field),
    };
  }

  /** unsubscribes every one of a field's wiring subscriptions, across all 4 categories —
   *  replaces the old single-bag `rt.subs.forEach(unsubscribe)` now that they're split. */
  private teardownFieldRuntime(rt: FieldRuntime): void {
    rt.propSubs.forEach((s) => s.unsubscribe());
    rt.propSubs.clear();
    rt.optionsSub?.unsubscribe();
    rt.fieldPatchSub?.unsubscribe();
    rt.changeSub?.unsubscribe();
  }

  private makeFormState<T = Record<string, unknown>>(
    form: FormGroup,
    fields: FormField[],
  ): FormState<T> {
    return {
      value: form.getRawValue() as T,
      form,
      fields,
      localForm: form,
      localFields: fields,
    };
  }

  private makeFieldChange(
    value: unknown,
    previousValue: unknown,
    field: FormField,
    topForm: FormGroup,
    flat: FormField[],
    rt: FieldRuntime,
  ): FieldChange {
    return {
      value,
      previousValue,
      field,
      form: topForm,
      fields: flat,
      localForm: rt.localForm,
      localFields: rt.localFields,
    };
  }

  private syncValidators(validations?: Validator[]): ValidatorFn[] {
    return (validations ?? []).filter((v) => !v.async).map((v) => v.validator as ValidatorFn);
  }

  private asyncValidators(validations?: Validator[]): AsyncValidatorFn[] {
    return (validations ?? []).filter((v) => v.async).map((v) => v.validator as AsyncValidatorFn);
  }

  private minMaxItemsValidators(field: ValueFormField): ValidatorFn[] {
    const fns: ValidatorFn[] = [];
    if (field.minItems !== undefined) {
      fns.push((c) =>
        (c as FormArray).length >= (field.minItems as number)
          ? null
          : { minItems: { required: field.minItems, actual: (c as FormArray).length } },
      );
    }
    if (field.maxItems !== undefined) {
      fns.push((c) =>
        (c as FormArray).length <= (field.maxItems as number)
          ? null
          : { maxItems: { allowed: field.maxItems, actual: (c as FormArray).length } },
      );
    }
    return fns;
  }

  /** SPEC §12: firstName → 'First Name', user_name → 'User Name' */
  private labelFromKey(key: string): string {
    return key
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
}

// ── tiny utils (no lodash dependency) ────────

/** SPEC §16: the exact path-assignment rule `walk()` uses (single source of truth — `walk()`
 *  itself calls this, and `predictPaths()` below mirrors it without creating any controls). */
function computeValuePath(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

/** SPEC §16: side-effect-free mirror of walk()'s path assignment — computes what path every
 *  value field in `fields` WOULD get if walked, without creating a control. Steps: transparent,
 *  `parentPath` passed through unchanged (mirrors §5 — steps contribute no path segment).
 *  isList object fields: own path IS recorded (still an addressable field, reconcilable as a
 *  whole via 'kept-list'/'added'/'removed'), but `.fields` (the per-item template) is NOT
 *  walked — item paths are position-dependent, handled separately (tier 3). Non-list object
 *  fields: walked recursively, same as `walk()`. Static fields: no path, skipped. */
function predictPaths(
  fields: FormField[],
  parentPath: string,
  siblings: FormField[],
  out: Map<string, { field: ValueFormField; siblings: FormField[] }>,
): void {
  for (const field of fields) {
    if (isStepField(field)) {
      predictPaths(field.fields, parentPath, field.fields, out);
      continue;
    }
    if (isStaticField(field)) continue;

    const vf = field as ValueFormField;
    const path = computeValuePath(parentPath, vf.key);
    out.set(path, { field: vf, siblings });

    if (isObjectField(vf) && !vf.isList) predictPaths(vf.fields, path, vf.fields, out);
  }
}

/** the "old" side of a reconciliation diff, built from `runtimes` (never from `flat` — a
 *  Map-only-deleted field could still linger there pre-Phase-0-fix-adjacent bugs elsewhere;
 *  `runtimes` is the one source of truth for "is this field actually still live"). An isList
 *  field's OWN path is kept (so it can be matched as 'kept-list'/'removed'), but everything
 *  UNDER it (its per-item fields) is dropped — those are reconciled separately, item-by-item,
 *  by tier 3's `reconcileListItems`, not by this top-level diff. */
function collectOldEligible(runtimes: Map<FormField, FieldRuntime>): Map<string, ValueFormField> {
  const listRoots = [...runtimes.keys()]
    .filter((f): f is ValueFormField => isObjectField(f) && !!f.isList && !!f.path)
    .map((f) => f.path!);
  const isUnderList = (p: string) => listRoots.some((r) => p.startsWith(`${r}.`));

  const out = new Map<string, ValueFormField>();
  for (const f of runtimes.keys()) {
    if (!isValueField(f) || !f.path || isUnderList(f.path)) continue;
    out.set(f.path, f as ValueFormField);
  }
  return out;
}

interface FieldDiffEntry {
  path: string;
  kind: 'added' | 'removed' | 'kept-same' | 'kept-type-changed' | 'kept-list';
  oldField?: ValueFormField;
  newField?: ValueFormField;
  newSiblings?: FormField[];
}

/** Diffs the engine's current live field set (`oldEligible`, keyed by computed path) against a
 *  fresh `newFields` tree (also reduced to computed paths, via `predictPaths`). isList fields are
 *  islands: kept on both sides ⇒ 'kept-list' (tier 3 reconciles item-level, this function doesn't
 *  descend into `.fields`); appearing/disappearing ⇒ ordinary 'added'/'removed', same as any
 *  other field (createControl/pruneFieldsUnderPath already handle a whole isList subtree). */
function diffFieldTree(
  oldEligible: Map<string, ValueFormField>,
  newFields: FormField[],
  parentPath = '',
): FieldDiffEntry[] {
  const newEligible = new Map<string, { field: ValueFormField; siblings: FormField[] }>();
  predictPaths(newFields, parentPath, newFields, newEligible);
  const isListHere = (f?: FormField): boolean => !!f && isObjectField(f) && !!f.isList;

  const entries: FieldDiffEntry[] = [];
  const seen = new Set<string>();

  for (const [path, oldField] of oldEligible) {
    seen.add(path);
    const next = newEligible.get(path);
    if (isListHere(oldField) && isListHere(next?.field)) {
      entries.push({
        path,
        kind: 'kept-list',
        oldField,
        newField: next!.field,
        newSiblings: next!.siblings,
      });
      continue;
    }
    if (isListHere(oldField)) continue; // island, no match on the new side — leave alone (rare: a
    // list field surviving under the same path but somehow not re-detected as isList shouldn't
    // happen in practice; conservatively no-op rather than guess)
    if (!next) {
      entries.push({ path, kind: 'removed', oldField });
      continue;
    }
    if (isListHere(next.field)) continue; // new side claims this path via an island — leave alone
    entries.push({
      path,
      oldField,
      newField: next.field,
      newSiblings: next.siblings,
      kind: oldField.type === next.field.type ? 'kept-same' : 'kept-type-changed',
    });
  }

  for (const [path, next] of newEligible) {
    if (seen.has(path) || isListHere(next.field)) continue;
    entries.push({ path, kind: 'added', newField: next.field, newSiblings: next.siblings });
  }
  return entries;
}

/**
 * SPEC §16 (tier 2): which of `next`'s props genuinely differ from `old` — `old` MUST be a
 * field's `FieldRuntime.declaredConfig` (the pre-resolution baseline), never its live `field`
 * (which `applyProp` mutates in place — comparing against that would see every already-resolved
 * Dynamic prop as "changed" on every single pass, since `next` is always freshly unresolved).
 * `observe()` defs compare by their `paths` (value) and `callback` (reference — functions have
 * no stable identity across a `computed()` rebuild, so a fresh callback reference always counts
 * as changed; conservative by design, an unnecessary resubscribe beats silently keeping stale
 * logic). Plain values compare via `Object.is`. `path`/`attachment` are engine-managed, never
 * "declared" — always skipped.
 */
function diffDeclaredConfig(old: FormField, next: FormField): Set<string> {
  const changed = new Set<string>();
  const oldRec = old as unknown as Record<string, unknown>;
  const nextRec = next as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(oldRec), ...Object.keys(nextRec)])) {
    if (key === 'path' || key === 'attachment') continue;
    const a = oldRec[key];
    const b = nextRec[key];
    if (isObserver(a as Dynamic<unknown>) && isObserver(b as Dynamic<unknown>)) {
      const ao = a as ObserverParameter<unknown>;
      const bo = b as ObserverParameter<unknown>;
      const samePaths = JSON.stringify(ao.paths) === JSON.stringify(bo.paths);
      if (!samePaths || ao.callback !== bo.callback) changed.add(key);
    } else if (isObservable(a) || isObservable(b)) {
      if (a !== b) changed.add(key);
    } else if (!Object.is(a, b)) {
      changed.add(key);
    }
  }
  return changed;
}

/** minimal combineLatest that emits arrays of latest values */
function combineLatestValues(sources: Observable<unknown>[]): Observable<unknown[]> {
  return new Observable<unknown[]>((subscriber) => {
    const latest: unknown[] = new Array(sources.length);
    const has: boolean[] = new Array(sources.length).fill(false);
    const subs = sources.map((src, i) =>
      src.subscribe((v) => {
        latest[i] = v;
        has[i] = true;
        if (has.every(Boolean)) subscriber.next([...latest]);
      }),
    );
    return () => subs.forEach((s) => s.unsubscribe());
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function segments(path: string): string[] {
  return path.split('.');
}

export function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  return segments(path).reduce<unknown>(
    (acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]),
    obj,
  );
}

export function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = segments(path);
  let cursor: Record<string, unknown> = obj;
  for (const k of keys.slice(0, -1)) {
    if (cursor[k] == null || typeof cursor[k] !== 'object') cursor[k] = {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

export function deleteAtPath(obj: Record<string, unknown>, path: string): void {
  const keys = segments(path);
  let cursor: unknown = obj;
  for (const k of keys.slice(0, -1)) {
    if (cursor == null || typeof cursor !== 'object') return;
    cursor = (cursor as Record<string, unknown>)[k];
  }
  if (cursor != null && typeof cursor === 'object') {
    delete (cursor as Record<string, unknown>)[keys[keys.length - 1]];
  }
}
