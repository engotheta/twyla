import { Dynamic, ObserverParameter } from './dynamic.interface';
import { FieldChange, FormState, Validator } from './form-state.interface';
import type { FormField } from './form-field.interface';

// ─────────────────────────────────────────────
// Base hierarchy
//
// CoreField  — rendering/identity props every field has (incl. buttons,
//              steps, content). No value semantics.
// ValueField — everything a value-carrying control needs: value, validation,
//              list mode, submit behavior. `key` is REQUIRED here.
//
// Containers (object) are ValueFields (their value is the nested object).
// Steps, buttons, content/label are CoreFields — they don't own a control
// value in the usual sense, so they never see placeholder/validations/etc.
// ─────────────────────────────────────────────

export interface CoreField {
  /** optional on non-value fields (buttons, steps, content) */
  key?: string;
  /** set automatically at init when nested; path in the top-most form */
  path?: string;

  label?: Dynamic<string>;
  hint?: Dynamic<string>;
  tooltip?: Dynamic<string>;

  disabled?: Dynamic<boolean>;
  visible?: Dynamic<boolean>;

  // presentation
  showLabel?: boolean;
  class?: Dynamic<string>;
  labelClass?: Dynamic<string>;
  opacity?: Dynamic<number>;
  color?: 'primary' | 'accent' | 'warn';
  icon?: Dynamic<string>;
  iconClass?: string;

  /**
   * Batched dynamic override: one observer returning a Partial patch of this
   * field's config. Use when a single control change updates many props —
   * one subscription + one CD cycle instead of N observers.
   */
  field?: ObserverParameter<Partial<FormField>>;
}

export interface ValueField<V = unknown> extends CoreField {
  /** required: this is the form-control name */
  key: string;

  placeholder?: Dynamic<string>;

  /**
   * Known type gap: when `isList: true` this is `V[]` at RUNTIME (one entry per item, seeding
   * each item's initial value) even though the static type says `V` — `isList` is an orthogonal
   * flag, not folded into the generic, so TS can't express "V normally, V[] when isList" here.
   * Cast at the call site for isList fields (`value: rows as unknown as V`) until this is split.
   */
  value?: Dynamic<V>;
  /** applied on reset / clear instead of null */
  defaultValue?: V;
  /** transforms the value before it is set on the control; can be async.
   *  Runs on user-driven valueChanges (honors updateOn/debounce). SPEC §8 */
  valueFn?: (value: V, formState?: FormState) => V | Promise<V>;
  /** transforms the value ONLY at submit; never touches the control. SPEC §8 */
  toSubmit?: (value: V, formState?: FormState) => unknown;

  /** visible but not editable; unlike disabled, still included in form value */
  readonly?: Dynamic<boolean>;
  /** reset value to defaultValue/null when hidden; default false (value survives hide) */
  clearOnHide?: boolean;
  /**
   * Hidden fields are included in the submit payload by default (same as disabled fields,
   * see `FormParameter.includeDisabled`) — set true to drop this field while hidden instead.
   * default false. SPEC §6
   */
  excludeHiddenOnSubmit?: boolean;

  // list mode
  isList?: boolean;
  /** implies can remove. `false` disables both; a `Dynamic<boolean>` observer can react to the
   *  list's own current value — e.g. only allow adding once the last item has a value (paths
   *  resolve against the top form same as any other Dynamic prop; a `'./sibling'` path resolves
   *  against the CURRENT item's own group instead, for per-item fields — see dynamic.interface.ts) */
  canAddItem?: Dynamic<boolean>;
  minItems?: number;
  maxItems?: number;
  /** validators applied to the FormArray itself (per-item ones go in `validations`). SPEC §4 */
  listValidations?: Validator[];

  // validation & submit
  validations?: Validator[];
  showRequiredMarker?: boolean; // default true
  ignoreOnSubmit?: boolean;
  updateOn?: 'change' | 'blur' | 'submit'; // Angular AbstractControl updateOn
  /** debounce ms applied to onChange + dynamic observers fed by this field */
  debounce?: number;

  onChange?: (value: V, change?: FieldChange<V>) => void | Promise<void>;

  // presentation (control-level)
  inputClass?: Dynamic<string>;
  appearance?: 'outline' | 'fill';
  suffixIcon?: Dynamic<string>;
  /** appends a clear suffix button when the field has a value; default false */
  showClear?: boolean;
  /** per-field override of `FormParameter.showSubscript` (default true, i.e. follow the
   *  form-level setting) — hides this field's reserved hint/error strip regardless of what
   *  the rest of the form does, or shows it even when the form otherwise hides them. */
  showSubscript?: boolean;
}
