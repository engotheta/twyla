import { ValidatorFn, Validators } from '@angular/forms';
import { FORM_EN, FormMessages } from './form.messages';
import { Validator } from './interfaces/form-state.interface';

// ─────────────────────────────────────────────
// Ready-made `Validator`s (name + validator + message) for `validations: [...]`. The `name` must
// equal the error key the validator sets — that's how `firstErrorMessage` finds the message — so
// e.g. Angular's minLength is named 'minlength'.
//
// A validator given no message takes the form's own, in the user's language (`FORM_MESSAGES`);
// a message passed in is shown as written.
// ─────────────────────────────────────────────

export interface PasswordRules {
  minLength: number;
  lowercase: boolean;
  uppercase: boolean;
  digit: boolean;
  symbol: boolean;
}

export const DEFAULT_PASSWORD_RULES: PasswordRules = {
  minLength: 8,
  lowercase: true,
  uppercase: true,
  digit: true,
  symbol: true,
};

export type PasswordRuleKey = keyof PasswordRules;

export interface PasswordCheck {
  key: PasswordRuleKey;
  label: string;
  met: boolean;
}

/**
 * Each password rule with whether `value` meets it — what a live checklist renders. `labels` is
 * the form's password text in the user's language (`FORM_MESSAGES`'s `password`); English when
 * left out.
 */
export function passwordChecks(
  value: unknown,
  rules: Partial<PasswordRules> = {},
  labels: FormMessages['password'] = FORM_EN.password,
): PasswordCheck[] {
  const r = { ...DEFAULT_PASSWORD_RULES, ...rules };
  const text = typeof value === 'string' ? value : '';
  const checks: PasswordCheck[] = [
    { key: 'minLength', label: labels.minLength(r.minLength), met: text.length >= r.minLength },
  ];
  if (r.lowercase)
    checks.push({ key: 'lowercase', label: labels.lowercase, met: /\p{Ll}/u.test(text) });
  if (r.uppercase)
    checks.push({ key: 'uppercase', label: labels.uppercase, met: /\p{Lu}/u.test(text) });
  if (r.digit) checks.push({ key: 'digit', label: labels.digit, met: /\p{Nd}/u.test(text) });
  if (r.symbol) {
    checks.push({ key: 'symbol', label: labels.symbol, met: /[^\p{L}\p{N}\s]/u.test(text) });
  }
  return checks;
}

/**
 * The rules as one sentence: "Use at least 8 characters, with upper and lower case letters, a
 * number and a symbol." `labels` as in `passwordChecks`.
 */
export function describePasswordRules(
  rules: Partial<PasswordRules> = {},
  labels: FormMessages['password'] = FORM_EN.password,
): string {
  return labels.rules({ ...DEFAULT_PASSWORD_RULES, ...rules });
}

function required(message?: string): Validator {
  return {
    name: 'required',
    validator: Validators.required,
    message: message ?? ((text) => text.errors.required),
  };
}

/** for a checkbox that must be ticked (terms, consent) — Angular reports it as `required` */
function requiredTrue(message?: string): Validator {
  return {
    name: 'required',
    validator: Validators.requiredTrue,
    message: message ?? ((text) => text.errors.requiredTrue),
  };
}

function email(message?: string): Validator {
  return {
    name: 'email',
    validator: Validators.email,
    message: message ?? ((text) => text.errors.email),
  };
}

function minLength(length: number, message?: string): Validator {
  return {
    name: 'minlength',
    validator: Validators.minLength(length),
    message: message ?? ((text) => text.errors.minLength(length)),
  };
}

function maxLength(length: number, message?: string): Validator {
  return {
    name: 'maxlength',
    validator: Validators.maxLength(length),
    message: message ?? ((text) => text.errors.maxLength(length)),
  };
}

/** `name` lets two patterns on one field carry their own messages */
function pattern(regex: RegExp | string, message?: string, name = 'pattern'): Validator {
  const check = Validators.pattern(regex);
  const validator: ValidatorFn = (control) => (check(control) ? { [name]: true } : null);
  return { name, validator, message: message ?? ((text) => text.errors.pattern) };
}

/** Empty values pass (pair it with `required`); otherwise every rule must be met. The error
 *  carries the unmet rules: `{ strongPassword: { missing: ['digit', …] } }`. */
function strongPassword(rules: Partial<PasswordRules> = {}, message?: string): Validator {
  const validator: ValidatorFn = (control) => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '') return null;
    const missing = passwordChecks(value, rules)
      .filter((check) => !check.met)
      .map((check) => check.key);
    return missing.length ? { strongPassword: { missing } } : null;
  };
  return {
    name: 'strongPassword',
    validator,
    message: message ?? ((text) => describePasswordRules(rules, text.password)),
  };
}

/** `validations: [validators.required(), validators.email('Use your work email')]` */
export const validators = {
  required,
  requiredTrue,
  email,
  minLength,
  maxLength,
  pattern,
  strongPassword,
} as const;

// the apps' `form-constants` names (GASCO / EWURA), so their field configs port unchanged
export const VALIDATOR_REQUIRED = required();
export const VALIDATOR_REQUIRED_TRUE = requiredTrue();
export const VALIDATOR_EMAIL = email();
export const VALIDATOR_STRONG_PASSWORD = strongPassword();
