import { TemplateRef } from '@angular/core';
import { FieldType, FormParameter, validators } from '../../components/generic-form';

// ─────────────────────────────────────────────
// The session pages' forms, as generic-form configs (like EWURA's register.form.ts). All are
// `nativeForm`: Enter submits, and browsers / password managers recognise them.
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
  onSubmit: (value: LoginValue) => Promise<void>,
  afterPassword: TemplateRef<unknown>,
): FormParameter {
  return {
    nativeForm: true,
    submitButtonLabel: 'Sign in',
    footerClass: FOOTER,
    fields: [
      {
        type: FieldType.input,
        key: 'username',
        label: 'Username or email',
        autocomplete: 'username',
        validations: [validators.required('Enter your username or email')],
      },
      {
        type: FieldType.input,
        key: 'password',
        label: 'Password',
        inputType: 'password',
        autocomplete: 'current-password',
        validations: [validators.required('Enter your password')],
      },
      // a content field's class lands on its wrapper and its own box — spacing lives in the template
      { type: FieldType.content, value: afterPassword },
      { type: FieldType.checkbox, key: 'remember', label: 'Keep me signed in', value: false },
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
  onSubmit: (value: RegisterValue) => Promise<void>,
  checklist: TemplateRef<unknown>,
  onPassword: (password: string) => void,
): FormParameter {
  return {
    nativeForm: true,
    submitButtonLabel: 'Create account',
    footerClass: FOOTER,
    fieldsContainerClass: 'grid gap-x-3 sm:grid-cols-2',
    fields: [
      {
        type: FieldType.input,
        key: 'firstName',
        label: 'First name',
        autocomplete: 'given-name',
        validations: [validators.required('Enter your first name')],
      },
      {
        type: FieldType.input,
        key: 'lastName',
        label: 'Last name',
        autocomplete: 'family-name',
        validations: [validators.required('Enter your last name')],
      },
      {
        type: FieldType.input,
        key: 'email',
        label: 'Email',
        inputType: 'email',
        autocomplete: 'email',
        class: 'sm:col-span-2',
        validations: [validators.required('Enter your email'), validators.email()],
      },
      ...newPasswordFields(checklist, onPassword, 'sm:col-span-2'),
      {
        type: FieldType.checkbox,
        key: 'acceptTerms',
        label: 'I agree to the terms of service and the privacy policy',
        value: false,
        class: 'sm:col-span-2',
        validations: [validators.requiredTrue('Accept the terms to create an account')],
      },
    ],
    crossValidators: [PASSWORDS_MATCH],
    onSubmit: (value) => onSubmit(value as never),
  };
}

export interface ForgotPasswordValue {
  email: string;
}

export function forgotPasswordForm(
  onSubmit: (value: ForgotPasswordValue) => Promise<void>,
): FormParameter {
  return {
    nativeForm: true,
    submitButtonLabel: 'Send reset link',
    footerClass: FOOTER,
    fields: [
      {
        type: FieldType.input,
        key: 'email',
        label: 'Email',
        inputType: 'email',
        autocomplete: 'email',
        validations: [validators.required('Enter your email'), validators.email()],
      },
    ],
    onSubmit: (value) => onSubmit(value as never),
  };
}

export interface ResetPasswordValue {
  password: string;
}

export function resetPasswordForm(
  onSubmit: (value: ResetPasswordValue) => Promise<void>,
  checklist: TemplateRef<unknown>,
  onPassword: (password: string) => void,
): FormParameter {
  return {
    nativeForm: true,
    submitButtonLabel: 'Reset password',
    footerClass: FOOTER,
    fields: newPasswordFields(checklist, onPassword),
    crossValidators: [PASSWORDS_MATCH],
    onSubmit: (value) => onSubmit(value as never),
  };
}

/** shown on the confirm field */
const PASSWORDS_MATCH = {
  type: 'match' as const,
  fields: ['password', 'confirmPassword'],
  message: "Passwords don't match",
  showOn: 'confirmPassword',
};

/** a new password (with its checklist) and its confirmation — the latter isn't submitted */
function newPasswordFields(
  checklist: TemplateRef<unknown>,
  onPassword: (password: string) => void,
  fieldClass = '',
): NonNullable<FormParameter['fields']> {
  return [
    {
      type: FieldType.input,
      key: 'password',
      label: 'New password',
      inputType: 'password',
      autocomplete: 'new-password',
      class: fieldClass,
      validations: [
        validators.required('Choose a password'),
        // the checklist under the field spells the rules out
        validators.strongPassword({}, "This password doesn't meet the rules yet"),
      ],
      onChange: (value) => onPassword(String(value ?? '')),
    },
    { type: FieldType.content, value: checklist, class: fieldClass },
    {
      type: FieldType.input,
      key: 'confirmPassword',
      label: 'Confirm password',
      inputType: 'password',
      autocomplete: 'new-password',
      class: fieldClass,
      ignoreOnSubmit: true,
      validations: [validators.required('Enter the password again')],
    },
  ];
}
