import { FormGroup, ValidatorFn, AsyncValidatorFn } from '@angular/forms';
import { Observable } from 'rxjs';
import type { FormMessages } from '../form.messages';
import type { FormField } from './form-field.interface';

// ─────────────────────────────────────────────
// Core shared shapes: state, changes, validation, options
// ─────────────────────────────────────────────

/**
 * What a field shows when its validator fails: the text itself, or — so it follows the user's
 * language — a pick from the form's own text (`FORM_MESSAGES`), given the error the validator
 * reported. The ready-made `validators` use the second form unless handed a message.
 */
export type ValidatorMessage = string | ((text: FormMessages, error: unknown) => string);

export interface Validator {
  name: string;
  validator: ValidatorFn | AsyncValidatorFn;
  message: ValidatorMessage;
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
