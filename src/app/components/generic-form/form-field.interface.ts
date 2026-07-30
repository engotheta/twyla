import { FieldType } from './field-type.interface';
import { ObjectField, StepField } from './fields/container.fields';
import {
  AttachmentField,
  BooleanField,
  ColorField,
  DateField,
  InputField,
  SelectField,
  TextareaField,
} from './fields/control.fields';
import { ButtonField, ContentField, LabelField } from './fields/static.fields';

// ─────────────────────────────────────────────
// The union + runtime guards for the renderer
// ─────────────────────────────────────────────

export type FormField =
  | ObjectField
  | StepField
  | AttachmentField
  | InputField
  | BooleanField
  | SelectField
  | TextareaField
  | DateField
  | ColorField
  | ButtonField
  | ContentField
  | LabelField;

/** value-carrying controls (everything that maps to a FormControl/FormGroup) */
export type ValueFormField =
  | ObjectField
  | AttachmentField
  | InputField
  | BooleanField
  | SelectField
  | TextareaField
  | DateField
  | ColorField;

export type ContainerField = ObjectField | StepField;
export type StaticField = ButtonField | ContentField | LabelField;

const STATIC_TYPES: FieldType[] = [
  FieldType.submit,
  FieldType.button,
  FieldType.content,
  FieldType.label,
];

export const isStepField = (f: FormField): f is StepField => f.type === FieldType.step;

export const isObjectField = (f: FormField): f is ObjectField => f.type === FieldType.object;

export const isContainerField = (f: FormField): f is ContainerField =>
  isObjectField(f) || isStepField(f);

export const isButtonField = (f: FormField): f is ButtonField =>
  f.type === FieldType.submit || f.type === FieldType.button;

export const isStaticField = (f: FormField): f is StaticField => STATIC_TYPES.includes(f.type);

export const isValueField = (f: FormField): f is ValueFormField =>
  !isStaticField(f) && !isStepField(f);

export const isSelectField = (f: FormField): f is SelectField => f.type === FieldType.select;

export const isInputField = (f: FormField): f is InputField => f.type === FieldType.input;

export const isBooleanField = (f: FormField): f is BooleanField =>
  f.type === FieldType.checkbox || f.type === FieldType.toggle || f.type === FieldType.radio;

export const isTextareaField = (f: FormField): f is TextareaField =>
  f.type === FieldType.textarea || f.type === FieldType.richText;

export const isDateField = (f: FormField): f is DateField => f.type === FieldType.date;

export const isColorField = (f: FormField): f is ColorField => f.type === FieldType.color;

export const isAttachmentField = (f: FormField): f is AttachmentField =>
  f.type === FieldType.attachment;

export const isContentField = (f: FormField): f is ContentField => f.type === FieldType.content;

export const isLabelField = (f: FormField): f is LabelField => f.type === FieldType.label;
