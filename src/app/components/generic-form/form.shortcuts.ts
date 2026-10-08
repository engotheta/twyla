import { Signal } from '@angular/core';
import { actionShortcut, toggleShortcut } from '@services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from '@services/shortcuts/shortcuts.interface';
import { FormMessages } from './form.messages';
import { FormParameter } from './interfaces/form-parameter.interface';

/** The generic form's keyboard shortcuts (SPEC §18). */
export const FORM_SCOPE: ShortcutScope = { id: 'generic-form', key: 'f' };

/** what the shortcuts act on — `GenericFormComponent` hands it over */
export interface FormShortcutTarget {
  /** the params in force: as given, with the overrides laid over */
  params: () => FormParameter<any>;
  overrides: () => Partial<FormParameter<any>>;
  /** lays a patch over the params for as long as the form is on screen */
  override: (patch: Partial<FormParameter<any>>) => void;
  reset: () => void;
  stepCount: () => number;
  stepIndex: () => number;
  nextStep: () => void;
  previousStep: () => void;
  focusFirstInvalid: () => void;
}

/**
 * How the form is drawn and, where it has steps, how they are laid out and walked. Nothing here
 * submits the form or empties it: a key pressed in passing must not do either.
 */
export function formShortcuts(form: FormShortcutTarget, t: Signal<FormMessages>): Shortcut[] {
  const text = () => t().shortcuts;
  const params = form.params;
  const stepped = { available: () => form.stepCount() > 0 };

  return [
    toggleShortcut(
      'filled',
      'a',
      () => text().filled,
      () => params().appearance === 'fill',
      (on) => form.override({ appearance: on ? 'fill' : 'outline' }),
    ),
    toggleShortcut(
      'hints',
      'h',
      () => text().hints,
      () => params().showSubscript !== false,
      (showSubscript) => form.override({ showSubscript }),
    ),
    toggleShortcut(
      'vertical',
      'o',
      () => text().vertical,
      () => params().stepperOrientation === 'vertical',
      (on) => form.override({ stepperOrientation: on ? 'vertical' : 'horizontal' }),
      stepped,
    ),
    toggleShortcut(
      'linear',
      'l',
      () => text().linear,
      () => params().linearSteppers === true,
      (linearSteppers) => form.override({ linearSteppers }),
      stepped,
    ),
    actionShortcut('nextStep', 'n', () => text().nextStep, form.nextStep, {
      available: () => form.stepIndex() < form.stepCount() - 1,
    }),
    actionShortcut('previousStep', 'p', () => text().previousStep, form.previousStep, {
      available: () => form.stepIndex() > 0,
    }),
    actionShortcut('firstInvalid', 'i', () => text().firstInvalid, form.focusFirstInvalid, {
      dismiss: true,
    }),
    actionShortcut('reset', '0', () => text().reset, form.reset, {
      available: () => Object.keys(form.overrides()).length > 0,
    }),
  ];
}
