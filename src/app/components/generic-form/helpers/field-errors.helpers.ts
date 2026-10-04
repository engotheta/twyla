import { ValidationErrors } from '@angular/forms';
import { FORM_EN, FormMessages } from '../form.messages';
import { Validator } from '../interfaces/form-state.interface';

/**
 * Resolves the first active control error into a display message. Field-level validators
 * carry their message on the `Validator` config (looked up by error key === validator name);
 * cross-validator inline errors (SPEC §9 `showOn`) store the message directly as the error
 * value, so a string error value is used as-is when no matching validator name is found.
 *
 * `text` is the form's own text in the user's language (`injectMessages(FORM_MESSAGES)()`), which
 * a validator without a message of its own picks from; left out, that text is English.
 */
export function firstErrorMessage(
  errors: ValidationErrors | null,
  validations?: Validator[],
  text: FormMessages = FORM_EN,
): string | null {
  if (!errors) return null;
  const key = Object.keys(errors)[0];
  if (key === undefined) return null;

  const named = validations?.find((v) => v.name === key)?.message;
  if (typeof named === 'function') return named(text, errors[key]);
  if (named) return named;

  const value = errors[key];
  return typeof value === 'string' ? value : key;
}
