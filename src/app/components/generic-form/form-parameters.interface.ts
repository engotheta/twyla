import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { FormField } from './form-field.interface';
import { FormState } from './form-state.interface';

// ─────────────────────────────────────────────
// Form-level configuration
// ─────────────────────────────────────────────

export type StepperLabelPosition = 'bottom' | 'end';
export type StepperAppearance = 'default' | 'fill' | 'outline';

/**
 * Cross-field validation rules. Each rule targets the top-most form and can
 * reference any field by path.
 */
interface CrossValidatorBase {
  /** field path to ALSO surface the error under (inline); default: form-level banner. SPEC §9 */
  showOn?: string;
}

export type CrossValidator =
  | (CrossValidatorBase & {
      /** all listed fields must hold equal values (e.g. password/confirm) */
      type: 'match';
      fields: string[];
      message?: string;
    })
  | (CrossValidatorBase & {
      /** `field` becomes required when `when` equals `equals` (or is truthy if omitted) */
      type: 'requiredIf';
      field: string;
      when: string;
      equals?: unknown;
      message?: string;
    })
  | (CrossValidatorBase & {
      /** escape hatch: arbitrary rule over the listed fields' values */
      type: 'custom';
      fields: string[];
      validate: (
        values: Record<string, unknown>,
        formState: FormState,
      ) => boolean | Promise<boolean>;
      message: string;
    });

export interface FormParameters<T = Record<string, unknown>> {
  /** if launched from a modal: title of the modal dialog */
  title?: string;
  icon?: string;

  model?: T;
  fields?: FormField[];

  /** default true; if false, disabled fields are excluded from the form value */
  includeDisabled?: boolean;

  /** applied to EACH top-level field's own wrapper (a descendant class, not the wrapper) */
  fieldsClass?: string;
  /** applied once to the element that wraps the whole top-level `fields` list */
  fieldsContainerClass?: string;
  outerClass?: string;

  /** controls field renderings */
  appearance?: 'fill' | 'outline';

  // ── footer ──
  footerClass?: string;
  /** default true; where the submit/cancel buttons render.
   *  NOTE: automatically hidden when step fields are present — stepper
   *  buttons replace the footer buttons. */
  showFooter?: boolean;

  /** default true; if false, no submit button is auto-rendered in the footer */
  addSubmitButton?: boolean;
  submitButtonLabel?: string; // default 'Submit'
  submitButtonIcon?: string;

  /** cancel button auto-renders only when the form is in a modal; closes it */
  cancelButtonLabel?: string; // default 'Cancel'
  cancelButtonIcon?: string;

  // ── stepper (applies when fields include step fields) ──
  /** default false; if true, cannot advance until the current step is valid */
  linearSteppers?: boolean;
  stepperOrientation?: 'horizontal' | 'vertical'; // default 'horizontal'
  stepperLabelPosition?: StepperLabelPosition;
  stepperAppearance?: StepperAppearance;
  /** label of the auto-generated step that collects non-step outer fields;
   *  default 'More Info' */
  mixedStepLabel?: string;
  /** where the auto-generated mixed step is placed; default 'last' */
  mixedStepPosition?: 'first' | 'last';

  // ── validation ──
  crossValidators?: CrossValidator[];

  /** default true; if false, labels are not auto-generated from keys */
  autoLabels?: boolean;

  // ── callbacks ──
  onSubmit?: (formValue: T, formState?: FormState<T>) => unknown;
  /** fires on every user-driven form value change (SPEC §15) — NOT on init, unlike per-field Dynamic observers (§1) */
  onChange?: (formValue: T, formState: FormState<T>) => unknown;
  /** debounce (ms) applied to `onChange` emissions off `form.valueChanges`; undefined = no debounce */
  changeDebounce?: number;

  // ── modal integration ──
  /** emissions close the dialog when the form is rendered in a modal */
  closeAction$?: Observable<unknown> | Subject<unknown> | BehaviorSubject<unknown>;
  /** called after the modal closes (user cancel, closeAction$, or submit) */
  onClose?: (data?: unknown) => unknown;
  /** default false; close the modal automatically after a successful submit */
  closeOnSubmit?: boolean;

  /** @deprecated use onClose */
  onModalClose?: (data?: unknown) => unknown;
  /** @deprecated use onClose */
  onCloseAction?: (data?: unknown) => unknown;
}
