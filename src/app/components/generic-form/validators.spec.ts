import { FormControl } from '@angular/forms';
import {
  describePasswordRules,
  passwordChecks,
  VALIDATOR_EMAIL,
  VALIDATOR_REQUIRED,
  VALIDATOR_STRONG_PASSWORD,
  validators,
} from './validators';
import { firstErrorMessage } from './fields/components/field-errors.util';
import { Validator } from './interfaces/form-state.interface';

/** the message a field shows for `value` — the same lookup the inputs use */
function messageFor(value: unknown, ...rules: Validator[]): string | null {
  const control = new FormControl(value, rules.map((rule) => rule.validator as never));
  return firstErrorMessage(control.errors, rules);
}

describe('validators', () => {
  it('each validator is named after the error key it sets, so its message is found', () => {
    expect(messageFor('', validators.required('Enter a name'))).toBe('Enter a name');
    expect(messageFor(false, validators.requiredTrue('Accept the terms'))).toBe('Accept the terms');
    expect(messageFor('nope', validators.email())).toBe('Enter a valid email address');
    expect(messageFor('ab', validators.minLength(3))).toBe('Use at least 3 characters');
    expect(messageFor('abcd', validators.maxLength(3))).toBe('Use at most 3 characters');
    expect(messageFor('x1', validators.pattern(/^[a-z]+$/, 'Letters only', 'letters'))).toBe(
      'Letters only',
    );
    expect(messageFor('fine', validators.required(), validators.email())).toBe(
      'Enter a valid email address',
    );
  });

  it('strongPassword leaves empty values to required and lists the unmet rules', () => {
    const { validator } = validators.strongPassword();
    expect(new FormControl('', validator as never).errors).toBeNull();
    expect(new FormControl('abcdefgh', validator as never).errors).toEqual({
      strongPassword: { missing: ['uppercase', 'digit', 'symbol'] },
    });
    expect(new FormControl('Abcdefg1!', validator as never).errors).toBeNull();
    // relaxed rules
    const { validator: relaxed } = validators.strongPassword({ minLength: 4, symbol: false });
    expect(new FormControl('Ab1c', relaxed as never).errors).toBeNull();
  });

  it('passwordChecks ticks off each rule; describePasswordRules sums them up', () => {
    const checks = passwordChecks('Abc1');
    expect(checks.map((check) => [check.key, check.met])).toEqual([
      ['minLength', false],
      ['lowercase', true],
      ['uppercase', true],
      ['digit', true],
      ['symbol', false],
    ]);
    expect(describePasswordRules()).toBe(
      'Use at least 8 characters, with upper and lower case letters, a number and a symbol.',
    );
    expect(describePasswordRules({ minLength: 12, symbol: false, digit: false })).toBe(
      'Use at least 12 characters, with upper and lower case letters.',
    );
  });

  it('keeps the apps’ VALIDATOR_* names', () => {
    expect(VALIDATOR_REQUIRED.name).toBe('required');
    expect(VALIDATOR_EMAIL.name).toBe('email');
    expect(VALIDATOR_STRONG_PASSWORD.name).toBe('strongPassword');
  });
});
