import { Observable } from 'rxjs';
import { CoreField, ValueField } from './base-field.interface';
import { Dynamic } from './dynamic.interface';
import { FieldType } from './field-type.interface';
import { FormState, StepState } from './form-state.interface';
import type { FormField } from './form-field.interface';

// ─────────────────────────────────────────────
// Containers: object (nested form) & step (wizard step)
// ─────────────────────────────────────────────

export interface ObjectField extends ValueField<Record<string, unknown>> {
  type: FieldType.object;
  fields: FormField[];
  /** applied to EACH direct child field's own wrapper (a descendant class, not the wrapper) */
  fieldsClass?: string;
  /** applied once to the element that wraps the whole `fields` list */
  fieldsContainerClass?: string;
  labelsClass?: string;
  showFormLabel?: boolean; // default true
  collapsible?: boolean; // default false
  collapsed?: Dynamic<boolean>; // initial/driven collapse state

  // list-of-objects rendering (isList = true)
  itemLabelKey?: string; // default 'label' + (n+1)
  showIndex?: boolean; // default true
  itemClass?: string; // class wrapper for each item
  /** Stable per-item identity for reconciling this list's items across a params() emission whose
   *  `value` array differs (add/remove/reorder rows while preserving each surviving row's live
   *  control state). Default when omitted: positional identity — tail-append/tail-trim only, no
   *  reordering, a safe no-op for any existing isList usage that doesn't opt in. */
  itemKey?: (item: unknown, index: number) => string | number;
}

/**
 * A wizard step. Steps are presentational chrome, not data (SPEC §5): child
 * fields register their controls on the TOP-LEVEL form, so the submit payload
 * has no step wrapper keys — hence StepField extends CoreField and needs no key.
 *
 * Footer behavior: when steps are present the form footer is not shown;
 * stepper buttons replace the footer buttons. First step has no previous
 * button (cancel instead, when in a modal); last step carries the submit
 * button. A single step hides both nav buttons.
 */
export interface StepField extends CoreField {
  type: FieldType.step;

  fields: FormField[];
  /** applied to EACH direct child field's own wrapper (a descendant class, not the wrapper) */
  fieldsClass?: string;
  /** applied once to the element that wraps the whole `fields` list */
  fieldsContainerClass?: string;
  labelsClass?: string;

  /** default false; if true, step can be skipped even with linear steppers */
  optional?: boolean;

  nextLabel?: string; // default 'Next'
  nextIcon?: string;
  previousLabel?: string; // default 'Previous'
  previousIcon?: string;

  /**
   * Gate for advancing. Return/resolve false to stay on the current step.
   * value = the current step's form value; stepState = step-scoped state;
   * formState = the top-most FormState. Can be async.
   */
  onProceed?: (
    value: Record<string, unknown>,
    stepState?: StepState,
    formState?: FormState,
  ) => boolean | Promise<boolean> | Observable<boolean>;

  /** called when navigating back from this step */
  onBack?: (stepState?: StepState, formState?: FormState) => void;
}
