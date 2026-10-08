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

/** What `optionsFunction` is asked for. SPEC §17 */
export interface OptionsRequest<T = Record<string, unknown>> {
  /** the search box's text, where the search is the server's (`searchMode: 'server'`); else '' */
  search: string;
  /** 1-based; always 1 unless the source is `paginated` */
  page: number;
  /** how many to answer with: `pageSize` */
  size: number;
  /** `OptionsParameter.filters`, as declared: the fixed criteria of every request */
  filters: Record<string, unknown>;
  /** the form as the request is made; `formState.value` is the top-most form's value */
  formState: FormState<T>;
}

/** One page of raw options: the grid's `GridData` shape, so one `resFn` serves both. */
export interface OptionsPage<T = unknown> {
  content: T[];
  /** how many there are in all: the select stops asking once it holds them */
  totalLength?: number;
  /** or, plainly, whether another page follows; it wins over `totalLength` */
  hasMore?: boolean;
}

/** what `optionsFunction` answers with: the raw options, or a page of them */
export type OptionsResult<T = unknown> = T[] | OptionsPage<T>;

export interface OptionsParameter<T = any, V = unknown> {
  labelKey?: string;
  valueKey?: string;
  mapper?: { label: string; value: string } | ((option: T) => Option<V>);
  /** sorts what was loaded; left to the server where the source is `paginated` */
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
  /**
   * The options' source: an API call, usually. Answers with the raw options (mapped by
   * `labelKey` / `valueKey` / `mapper`), or with a page of them. Asked again whenever this
   * parameter is a new object, the search changes (`searchMode: 'server'`) or the next page is
   * due (`paginated`). An Observable may answer more than once, each answer replacing the last;
   * a `paginated` source is heard once per page. SPEC §17
   */
  optionsFunction?: (
    request: OptionsRequest,
  ) => OptionsResult<T> | Promise<OptionsResult<T>> | Observable<OptionsResult<T>>;
  /** criteria every request carries, whatever is typed: handed back as `request.filters` */
  filters?: Record<string, unknown>;
  /**
   * Who narrows the options as the user types. `'local'` (default): the select, among what it
   * has loaded. `'server'`: the source, asked again with `request.search`; the select then shows
   * its search box whatever `searchable` says.
   */
  searchMode?: 'local' | 'server';
  /** `searchMode: 'server'`: ms of quiet before a typed search is sent. Default 300 */
  searchDebounce?: number;
  /** `searchMode: 'server'`: nothing is asked for until this much is typed. Default 0 */
  minSearchLength?: number;
  /** the source answers page by page: scrolling to the end of the list asks for the next */
  paginated?: boolean;
  /** `request.size`. Default 25 */
  pageSize?: number;
  /**
   * The raw options of values the control holds but no loaded page has (a value set from far
   * down the list), so they show their label. Without it such a value shows as it is.
   * (Written as a method so that a field typed for its own values — `(ids: number[]) => …` —
   * still fits `FormField`, whose values are `unknown`.)
   */
  selectedFunction?(values: V[]): T[] | Promise<T[]> | Observable<T[]>;
}
