import { Signal, TemplateRef } from '@angular/core';
import { CrossValidator, FieldType, FormParameter, validators } from '@components/generic-form';
import { AuthMessages } from './auth.messages';

// ─────────────────────────────────────────────
// The session pages' forms, as generic-form configs (like EWURA's register.form.ts). All are
// `nativeForm`: Enter submits, and browsers / password managers recognise them.
//
// Each takes the pages' text (`injectMessages(AUTH_MESSAGES)`) and is built in the language of
// the moment. A page builds its form again when the language changes; generic-form then applies
// the new labels and messages to the live form, which keeps what was typed.
// ─────────────────────────────────────────────

/** full-width submit button, as on most sign-in screens */
const FOOTER = 'mt-2 [&_button]:w-full';

export interface LoginValue {
  username: string;
  password: string;
  remember: boolean;
}

/** `afterPassword`: rendered right under the password field (the "Forgot password?" link) */
export function loginForm(
  t: Signal<AuthMessages>,
  onSubmit: (value: LoginValue) => Promise<void>,
  afterPassword: TemplateRef<unknown>,
): FormParameter {
  const { fields, errors, login } = t();
  return {
    nativeForm: true,
    submitButtonLabel: login.submit,
    footerClass: FOOTER,
    fields: [
      {
        type: FieldType.input,
        key: 'username',
        label: fields.username,
        autocomplete: 'username',
        validations: [validators.required(errors.username)],
      },
      {
        type: FieldType.input,
        key: 'password',
        label: fields.password,
        inputType: 'password',
        autocomplete: 'current-password',
        validations: [validators.required(errors.password)],
      },
      // a content field's class lands on its wrapper and its own box — spacing lives in the template
      { type: FieldType.content, value: afterPassword },
      { type: FieldType.checkbox, key: 'remember', label: fields.remember, value: false },
    ],
    onSubmit: (value) => onSubmit(value as never),
  };
}

export interface RegisterValue {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

/** `checklist`: the password rules, under the password field; `onPassword` feeds it */
export function registerForm(
  t: Signal<AuthMessages>,
  onSubmit: (value: RegisterValue) => Promise<void>,
  checklist: TemplateRef<unknown>,
  onPassword: (password: string) => void,
): FormParameter {
  const { fields, errors, register } = t();
  return {
    nativeForm: true,
    submitButtonLabel: register.submit,
    footerClass: FOOTER,
    fieldsContainerClass: 'grid gap-x-3 sm:grid-cols-2',
    fields: [
      {
        type: FieldType.input,
        key: 'firstName',
        label: fields.firstName,
        autocomplete: 'given-name',
        validations: [validators.required(errors.firstName)],
      },
      {
        type: FieldType.input,
        key: 'lastName',
        label: fields.lastName,
        autocomplete: 'family-name',
        validations: [validators.required(errors.lastName)],
      },
      {
        type: FieldType.input,
        key: 'email',
        label: fields.email,
        inputType: 'email',
        autocomplete: 'email',
        class: 'sm:col-span-2',
        validations: [validators.required(errors.email), validators.email()],
      },
      ...newPasswordFields(t(), checklist, onPassword, 'sm:col-span-2'),
      {
        type: FieldType.checkbox,
        key: 'acceptTerms',
        label: fields.acceptTerms,
        value: false,
        class: 'sm:col-span-2',
        validations: [validators.requiredTrue(errors.acceptTerms)],
      },
    ],
    crossValidators: [passwordsMatch(t)],
    onSubmit: (value) => onSubmit(value as never),
  };
}

export interface ForgotPasswordValue {
  email: string;
}

export function forgotPasswordForm(
  t: Signal<AuthMessages>,
  onSubmit: (value: ForgotPasswordValue) => Promise<void>,
): FormParameter {
  const { fields, errors, forgot } = t();
  return {
    nativeForm: true,
    submitButtonLabel: forgot.submit,
    footerClass: FOOTER,
    fields: [
      {
        type: FieldType.input,
        key: 'email',
        label: fields.email,
        inputType: 'email',
        autocomplete: 'email',
        validations: [validators.required(errors.email), validators.email()],
      },
    ],
    onSubmit: (value) => onSubmit(value as never),
  };
}

export interface ResetPasswordValue {
  password: string;
}

export function resetPasswordForm(
  t: Signal<AuthMessages>,
  onSubmit: (value: ResetPasswordValue) => Promise<void>,
  checklist: TemplateRef<unknown>,
  onPassword: (password: string) => void,
): FormParameter {
  return {
    nativeForm: true,
    submitButtonLabel: t().reset.submit,
    footerClass: FOOTER,
    fields: newPasswordFields(t(), checklist, onPassword),
    crossValidators: [passwordsMatch(t)],
    onSubmit: (value) => onSubmit(value as never),
  };
}

/**
 * Shown on the confirm field. A form's cross rules are attached once, when it is built, so the
 * message is read from `t` each time the rule runs — not fixed in the language of that moment.
 */
function passwordsMatch(t: Signal<AuthMessages>): CrossValidator {
  return {
    type: 'match',
    fields: ['password', 'confirmPassword'],
    message: () => t().errors.mismatch,
    showOn: 'confirmPassword',
  };
}

/** a new password (with its checklist) and its confirmation — the latter isn't submitted */
function newPasswordFields(
  { fields, errors }: AuthMessages,
  checklist: TemplateRef<unknown>,
  onPassword: (password: string) => void,
  fieldClass = '',
): NonNullable<FormParameter['fields']> {
  return [
    {
      type: FieldType.input,
      key: 'password',
      label: fields.newPassword,
      inputType: 'password',
      autocomplete: 'new-password',
      class: fieldClass,
      validations: [
        validators.required(errors.newPassword),
        // the checklist under the field spells the rules out
        validators.strongPassword({}, errors.weakPassword),
      ],
      onChange: (value) => onPassword(String(value ?? '')),
    },
    { type: FieldType.content, value: checklist, class: fieldClass },
    {
      type: FieldType.input,
      key: 'confirmPassword',
      label: fields.confirmPassword,
      inputType: 'password',
      autocomplete: 'new-password',
      class: fieldClass,
      ignoreOnSubmit: true,
      validations: [validators.required(errors.confirmPassword)],
    },
  ];
}
