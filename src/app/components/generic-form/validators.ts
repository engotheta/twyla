import { ValidatorFn, Validators } from '@angular/forms';
import { Validator } from './interfaces/form-state.interface';

// ─────────────────────────────────────────────
// Ready-made `Validator`s (name + validator + message) for `validations: [...]`. The `name` must
// equal the error key the validator sets — that's how `firstErrorMessage` finds the message — so
// e.g. Angular's minLength is named 'minlength'.
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

/** Each password rule with whether `value` meets it — what a live checklist renders. */
export function passwordChecks(
  value: unknown,
  rules: Partial<PasswordRules> = {},
): PasswordCheck[] {
  const r = { ...DEFAULT_PASSWORD_RULES, ...rules };
  const text = typeof value === 'string' ? value : '';
  const checks: PasswordCheck[] = [
    {
      key: 'minLength',
      label: `At least ${r.minLength} characters`,
      met: text.length >= r.minLength,
    },
  ];
  if (r.lowercase)
    checks.push({ key: 'lowercase', label: 'A lowercase letter', met: /\p{Ll}/u.test(text) });
  if (r.uppercase)
    checks.push({ key: 'uppercase', label: 'An uppercase letter', met: /\p{Lu}/u.test(text) });
  if (r.digit) checks.push({ key: 'digit', label: 'A number', met: /\p{Nd}/u.test(text) });
  if (r.symbol) {
    checks.push({
      key: 'symbol',
      label: 'A symbol, such as ! or #',
      met: /[^\p{L}\p{N}\s]/u.test(text),
    });
  }
  return checks;
}

/** The rules as one sentence: "Use at least 8 characters, with upper and lower case letters, a
 *  number and a symbol." */
export function describePasswordRules(rules: Partial<PasswordRules> = {}): string {
  const r = { ...DEFAULT_PASSWORD_RULES, ...rules };
  const cases =
    r.lowercase && r.uppercase
      ? 'upper and lower case letters'
      : r.uppercase
        ? 'an uppercase letter'
        : r.lowercase
          ? 'a lowercase letter'
          : '';
  const parts = [cases, r.digit ? 'a number' : '', r.symbol ? 'a symbol' : ''].filter(Boolean);
  const list =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return `Use at least ${r.minLength} characters${list ? `, with ${list}` : ''}.`;
}

function required(message = 'This field is required'): Validator {
  return { name: 'required', validator: Validators.required, message };
}

/** for a checkbox that must be ticked (terms, consent) — Angular reports it as `required` */
function requiredTrue(message = 'Tick this box to continue'): Validator {
  return { name: 'required', validator: Validators.requiredTrue, message };
}

function email(message = 'Enter a valid email address'): Validator {
  return { name: 'email', validator: Validators.email, message };
}

function minLength(length: number, message = `Use at least ${length} characters`): Validator {
  return { name: 'minlength', validator: Validators.minLength(length), message };
}

function maxLength(length: number, message = `Use at most ${length} characters`): Validator {
  return { name: 'maxlength', validator: Validators.maxLength(length), message };
}

/** `name` lets two patterns on one field carry their own messages */
function pattern(
  regex: RegExp | string,
  message = 'Enter a valid value',
  name = 'pattern',
): Validator {
  const check = Validators.pattern(regex);
  const validator: ValidatorFn = (control) => (check(control) ? { [name]: true } : null);
  return { name, validator, message };
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
  return { name: 'strongPassword', validator, message: message ?? describePasswordRules(rules) };
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
