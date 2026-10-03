/**
 * Plain concatenation, not a Tailwind-conflict-resolving merge — generic-form is a standalone,
 * portable module (see README) and doesn't reach into other feature folders' utilities for a
 * one-line join. The two inputs this combines (a parent's `fieldsClass`, a field's own `class`)
 * are meant to add together, not override each other, so nothing fancier is needed.
 */
export function joinClasses(...classes: Array<string | undefined | null | false>): string {
  return classes.filter((c): c is string => !!c).join(' ');
}
