import { DateFilterFn } from '@angular/material/datepicker';
import { Observable } from 'rxjs';
import { ValueField } from '../interfaces/base-field.interface';
import { Dynamic } from '../interfaces/dynamic.interface';
import {
  AttachmentType,
  DateType,
  FieldType,
  InputType,
  SelectType,
} from '../interfaces/field-type.interface';
import { FormState, Option, OptionsParameter } from '../interfaces/form-state.interface';

// ─────────────────────────────────────────────
// Value controls: input, boolean, select, text, date, color, attachment
// ─────────────────────────────────────────────

export interface InputField extends ValueField<string | number> {
  type: FieldType.input;
  inputType?: InputType; // default 'text'
  min?: number; // integer/decimal
  max?: number;
  step?: number;
  maxLength?: number;
  autocomplete?: string;
}

export interface BooleanField extends ValueField<boolean> {
  type: FieldType.checkbox | FieldType.toggle | FieldType.radio;
}

export interface SelectField<V = unknown> extends ValueField<V | V[]> {
  type: FieldType.select;
  variant?: SelectType; // default 'dropdown'
  multiple?: boolean; // default false; invalid with variant 'radio'
  searchable?: boolean; // default true when options are long
  options?: Dynamic<Option<V>[]> | Observable<Option<V>[]> | Option<V>[];
  optionsParameter?: OptionsParameter<any, V>;
  hasNoneOption?: boolean; // prepends { label: 'None', value: null }
  /** object-valued options: equality fn for preselection */
  compareWith?: (a: V, b: V) => boolean;
  virtualScroll?: boolean; // for very long option lists
}

export interface TextareaField extends ValueField<string> {
  type: FieldType.textarea | FieldType.richText;
  rows?: number; // default 3
  maxLength?: number;
}

export interface DateField extends ValueField<Date | string> {
  type: FieldType.date;
  dateType?: DateType; // default 'date'
  minDate?: Dynamic<Date>;
  maxDate?: Dynamic<Date>;
  dateFormat?: string; // default 'yyyy-MM-dd'
  /** function returning boolean to filter selectable dates */
  dateFilter?: DateFilterFn<Date | null>;
}

export interface ColorField extends ValueField<string> {
  type: FieldType.color;
  colorFormat?: 'rgb' | 'hex' | 'hsv' | 'hsl'; // default 'hex'
}

export interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
  file?: File;
  /** engine-managed. SPEC §11 */
  status?: 'pending' | 'uploading' | 'done' | 'error';
  /** upload failure message; engine-managed */
  error?: string;
  /** 0–100 when uploadFn reports progress */
  progress?: number;
}

export interface AttachmentField extends ValueField<string> {
  type: FieldType.attachment;
  attachmentType?: AttachmentType; // default 'base64'; 'path' when uploadFn set
  /** when the upload runs; default 'select'. 'submit' defers it (submit awaits). SPEC §11 */
  uploadOn?: 'select' | 'submit';
  /** uploads the file and resolves to its URL */
  uploadFn?: (file: File, formState?: FormState) => Promise<string> | Observable<string>;
  accept?: string[]; // e.g. ['.pdf', 'image/*']
  maxSizeMb?: number;
  /** populated by the control */
  attachment?: AttachmentMeta | AttachmentMeta[];
}
