// ─────────────────────────────────────────────
// Field types & variant literal unions
// ─────────────────────────────────────────────

// All types have a list version, isList = true | false, used to render multiple
// values in the form and add/remove values dynamically.
// isList = true  -> field value is an array of the single-value type
// isList = false -> field value is the single-value type
export enum FieldType {
  // ── structural / containers ──
  // nested form; value is the object of the nested form.
  // collapse behavior via `collapsible?: boolean` / `collapsed?: Dynamic<boolean>`
  object = 'object',

  // multi-step forms. Steps are presentational chrome, NOT data: children
  // register their controls on the top-level form; the submit payload has no
  // step wrapper keys (SPEC §5). If any outer field is a step, all non-step
  // outer fields are grouped into one auto step (FormParameter.mixedStep*)
  step = 'step',

  // ── value controls ──
  // value: string (URL if `uploadFn` provided, else base64).
  // always paired with an `attachment` metadata object: { name, size, type, file }
  attachment = 'attachment',

  // free text/number entry
  // config: inputType: 'text' | 'integer' | 'decimal' | 'email' | 'password' | 'url' | 'search'
  input = 'input',

  // single boolean controls
  checkbox = 'checkbox', // standard checkbox
  toggle = 'toggle', // slide toggle
  radio = 'radio', // single radio button, standalone (not a select)

  // choice from a list of options
  // config: variant: 'dropdown' | 'toggle' | 'checkbox' | 'button' | 'radio'
  //         multiple?: boolean (default false; not valid when variant = 'radio')
  //         searchable?: boolean (default true when option count is large)
  select = 'select',

  // longer text
  textarea = 'textarea',
  richText = 'richText',

  // date/time entry
  // config: dateType: 'date' | 'dateTime' | 'time' | 'monthYear' | 'year'
  date = 'date',

  color = 'color',

  // ── action controls (never part of form value) ──
  submit = 'submit',
  button = 'button',

  // ── static / display (ignored on submit by default) ──
  // renders arbitrary content (html / Angular template) inside the form.
  // other fields may read its value; value = the template/content structure
  content = 'content',

  // renders a label/text string, same submit/read behavior as `content`,
  // but value is specifically the displayed label text
  label = 'label',
}

export type SelectType = 'dropdown' | 'toggle' | 'checkbox' | 'button' | 'radio';
export type InputType = 'text' | 'integer' | 'decimal' | 'email' | 'password' | 'url' | 'search';
export type DateType = 'date' | 'dateTime' | 'time' | 'monthYear' | 'year';
export type AttachmentType = 'path' | 'base64' | 'object' | 'file';
