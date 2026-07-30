import { FormGroup, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { Observable } from 'rxjs';
import type { FormField } from './form-field.interface';

// ─────────────────────────────────────────────
// Core shared shapes: state, changes, validation, options
// ─────────────────────────────────────────────

export interface Validator {
  name: string;
  validator: ValidatorFn | AsyncValidatorFn;
  message: string;
  /** REQUIRED for AsyncValidatorFn — sync/async can't be told apart at runtime. SPEC §12 */
  async?: boolean;
}

export interface Option<V = unknown> {
  value: V;
  label: string;
  disabled?: boolean;
  icon?: string;
  hint?: string;
}

/** Snapshot passed to dynamic callbacks and change handlers. */
export interface FormState<T = Record<string, unknown>> {
  /** top-most form value (never the nested form's value) */
  value: T;
  /** top-most form */
  form: FormGroup;
  /** top-most fields, flattened */
  fields: FormField[];
  /** form containing the field (differs from `form` when nested) */
  localForm: FormGroup;
  localFields: FormField[];
}

/** Same shape as FormState, scoped to a single step. */
export interface StepState<T = Record<string, unknown>> extends FormState<T> {
  /** the step's own FormGroup */
  form: FormGroup;
  /** the step's form value */
  value: T;
  /** the step's fields, flattened */
  fields: FormField[];
}

export interface FieldChange<V = unknown> extends Omit<FormState, 'value'> {
  value: V;
  previousValue?: V;
  field: FormField;
}

export interface OptionsParameter<T = any, V = unknown> {
  labelKey?: string;
  valueKey?: string;
  mapper?: { label: string; value: string } | ((option: T) => Option<V>);
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
  optionsFunction?: (data?: unknown) => T[] | Promise<T[]> | Observable<T[]>;
}
