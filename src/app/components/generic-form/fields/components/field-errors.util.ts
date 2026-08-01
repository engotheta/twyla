import { ValidationErrors } from '@angular/forms';
import { Validator } from '../../interfaces/form-state.interface';

/**
 * Resolves the first active control error into a display message. Field-level validators
 * carry their message on the `Validator` config (looked up by error key === validator name);
 * cross-validator inline errors (SPEC §9 `showOn`) store the message directly as the error
 * value, so a string error value is used as-is when no matching validator name is found.
 */
export function firstErrorMessage(
  errors: ValidationErrors | null,
  validations?: Validator[],
): string | null {
  if (!errors) return null;
  const key = Object.keys(errors)[0];
  if (key === undefined) return null;

  const named = validations?.find((v) => v.name === key)?.message;
  if (named) return named;

  const value = errors[key];
  return typeof value === 'string' ? value : key;
}
