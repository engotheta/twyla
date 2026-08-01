import { BehaviorSubject } from 'rxjs';
import { CoreField } from '../interfaces/base-field.interface';
import { Dynamic } from '../interfaces/dynamic.interface';
import { FieldType } from '../interfaces/field-type.interface';
import { FormState } from '../interfaces/form-state.interface';

// ─────────────────────────────────────────────
// Action controls & display-only fields
// (never / by-default-not part of the submitted value)
// ─────────────────────────────────────────────

export interface ButtonField extends CoreField {
  type: FieldType.submit | FieldType.button;
  click?: (formValue?: Record<string, unknown>, formState?: FormState) => void | Promise<void>;
  /** while true: button disabled + loading spinner (submit buttons) */
  isSaving$?: BehaviorSubject<boolean>;
}

export interface ContentField extends CoreField {
  type: FieldType.content;
  /**
   * the template/content structure to render; ignored on submit by default,
   * but other fields may observe/read it
   */
  value?: Dynamic<unknown>;
  /** passed to the content template; default = form value */
  contentParameter?: unknown;
  /** default true */
  ignoreOnSubmit?: boolean;
}

export interface LabelField extends CoreField {
  type: FieldType.label;
  /** the displayed label text; ignored on submit by default */
  value?: Dynamic<string>;
  /** default true */
  ignoreOnSubmit?: boolean;
}
