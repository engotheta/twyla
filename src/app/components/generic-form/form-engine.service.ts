import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
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
import { Dynamic, ObserverParameter, Resolved, isObserver } from './dynamic.interface';
import { FieldType } from './field-type.interface';
import { FieldChange, FormState, Validator } from './form-state.interface';
import {
  FormField,
  ValueFormField,
  isObjectField,
  isStaticField,
  isStepField,
  isValueField,
} from './form-field.interface';
import { AttachmentField, AttachmentMeta } from './fields/control.fields';
import { CrossValidator, FormParameters } from './form-parameters.interface';

/** internal alias: engine internals don't care about the payload generic */
type AnyParams = FormParameters<any>;

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
  /** original Dynamic definitions, preserved so resolved values can overwrite props */
  observers: Array<{ prop: string; def: ObserverParameter<unknown> }>;
  subs: Subscription[];
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
  params: FormParameters<T>;
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
   *  the footer's auto submit button and any inline `type: 'submit'` button field call. */
  submit(): Promise<T | null>;
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

  build<T = Record<string, unknown>>(params: FormParameters<T>): FormInstance<T> {
    const form = new FormGroup({});
    const flat: FormField[] = [];
    const runtimes = new Map<FormField, FieldRuntime>();
    /** cycle guard: paths written during the current synchronous cascade (SPEC §1) */
    const cascade = new Set<string>();
    /** isList ObjectField ⇒ item FormGroup ⇒ that item's own cloned FormField instances */
    const itemFieldsByGroup = new WeakMap<AbstractControl, ListItemFields>();

    const fields = params.fields ?? [];
    if (params.model) this.seedModel(fields, params.model as Record<string, unknown>);
    this.walk(fields, '', form, form, fields, flat, runtimes, params, itemFieldsByGroup);

    const instance: FormInstance<T> = {
      form,
      fields: flat,
      params,
      formState: () => this.makeFormState<T>(form, flat),
      fieldState: <F extends FormField>(field: F) =>
        (runtimes.get(field)?.state ?? signal(field)) as Signal<Resolved<F>>,
      control: (field) => runtimes.get(field)?.control,
      listItemFields: (field, index) => {
        const arr = runtimes.get(field)?.control;
        const item = arr instanceof FormArray ? arr.at(index) : undefined;
        return (item && itemFieldsByGroup.get(item)?.top) ?? [];
      },
      submitValue: () => this.assembleSubmitValue<T>(form, flat, runtimes, params),
      submit: async () => {
        const value = await this.assembleSubmitValue<T>(form, flat, runtimes, params);
        if (value !== null) await params.onSubmit?.(value, this.makeFormState<T>(form, flat));
        return value;
      },
      selectAttachment: (field, file, index) =>
        this.selectAttachment(field, file, form, flat, runtimes, index),
      clearAttachment: (field, index) => this.clearAttachment(field, runtimes, index),
      addListItem: (path) =>
        this.addListItem(path, form, flat, runtimes, params, cascade, itemFieldsByGroup),
      removeListItem: (path, index) =>
        this.removeListItem(path, index, form, flat, runtimes, itemFieldsByGroup),
      destroy: () => runtimes.forEach((rt) => rt.subs.forEach((s) => s.unsubscribe())),
    };

    if (params.crossValidators?.length) {
      this.attachCrossValidators(form, flat, params.crossValidators);
    }

    // SPEC §1: initial observer pass, declaration order (walk order == declaration order)
    for (const f of flat) this.wireField(f, form, flat, runtimes, cascade);

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
      const path = parentPath ? `${parentPath}.${vf.key}` : vf.key;
      vf.path = path;
      if (params.autoLabels !== false && vf.label === undefined) {
        vf.label = this.labelFromKey(vf.key);
      }

      const control = this.createControl(vf, path, topForm, flat, runtimes, params, itemFieldsByGroup);
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
        this.walk(field.fields, path, topForm, group, field.fields, flat, runtimes, params, itemFieldsByGroup);
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
      this.walk(cloned, itemPath, topForm, group, cloned, itemFields, runtimes, params, itemFieldsByGroup);
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
      rt.observers.push({ prop, def });
      rt.subs.push(
        this.observePaths(def, topForm, flat, runtimes).subscribe((resolved) =>
          this.applyProp(field, prop, resolved, rt, cascade),
        ),
      );
    }

    // 2) select `options` passed as a bare Observable (not wrapped in `observe()` — the README's
    //    own usage example does this: `options: countries$`). Resolve it the same way Dynamic
    //    props resolve; `isObserver` above only catches ObserverParameter, not raw Observables.
    if (field.type === FieldType.select && isObservable(field.options)) {
      rt.subs.push(
        field.options.subscribe((options) => this.applyProp(field, 'options', options, rt, cascade)),
      );
    }

    // 3) batched patch (SPEC §3): shallow merge, last write wins
    if (field.field) {
      const def = field.field;
      rt.subs.push(
        this.observePaths(def, topForm, flat, runtimes).subscribe((patch) => {
          for (const [prop, value] of Object.entries(patch ?? {})) {
            this.applyProp(field, prop, value, rt, cascade);
          }
        }),
      );
    }

    // 4) valueFn + onChange on user-driven changes (SPEC §8)
    if (isValueField(field) && rt.control) {
      const control = rt.control;
      let changes = control.valueChanges as Observable<unknown>;
      if (field.debounce) changes = changes.pipe(debounceTime(field.debounce));
      let previous: unknown = control.value;
      let applyingValueFn = false;

      rt.subs.push(
        changes.subscribe(async (value) => {
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
          field.onChange?.(next as never, this.makeFieldChange(next, previous, field, topForm, flat, rt) as never);
          previous = next;
        }),
      );
    }
  }

  /** combineLatest over the observed paths → switchMap(callback) (SPEC §2 latest-wins) */
  private observePaths(
    def: ObserverParameter<unknown>,
    topForm: FormGroup,
    flat: FormField[],
    runtimes: Map<FormField, FieldRuntime>,
  ): Observable<unknown> {
    const paths = Array.isArray(def.paths) ? def.paths : [def.paths];
    const sources = paths.map((p) => {
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
    params: FormParameters<T>,
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
      if (field.type !== FieldType.attachment || (field.uploadOn ?? 'select') !== 'submit') continue;
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
      for (const f of itemFieldsByGroup.get(control)?.flat ?? []) this.wireField(f, form, flat, runtimes, cascade);
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
    const itemPrefix = `${path}.${index}`;
    for (const [f, rt] of runtimes) {
      if (f.path === itemPrefix || f.path?.startsWith(`${itemPrefix}.`)) {
        rt.subs.forEach((s) => s.unsubscribe());
        runtimes.delete(f);
      }
    }
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
      const oldIndexSegment = rest.slice(0, rest.indexOf('.') === -1 ? undefined : rest.indexOf('.'));
      const oldItemPath = `${arrayPath}.${oldIndexSegment}`;
      const newItemPath = `${arrayPath}.${i}`;
      if (oldItemPath === newItemPath) continue;

      for (const f of itemFields) {
        if (f.path?.startsWith(oldItemPath)) f.path = newItemPath + f.path.slice(oldItemPath.length);
      }
    }
  }

  // ── cross validators (SPEC §9) ────────────

  private attachCrossValidators(
    form: FormGroup,
    flat: FormField[],
    rules: CrossValidator[],
  ): void {
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

  private newRuntime(field: FormField, localForm: FormGroup, localFields: FormField[]): FieldRuntime {
    return { field, localForm, localFields, observers: [], subs: [], state: signal(field) };
  }

  private makeFormState<T = Record<string, unknown>>(form: FormGroup, fields: FormField[]): FormState<T> {
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
