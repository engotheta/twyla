import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Injector,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  runInInjectionContext,
  Signal,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { Observable, Subscription, firstValueFrom, isObservable } from 'rxjs';
import { controlStatus } from './fields/components/control-status.util';
import { FieldComponent } from './fields/components/field/field.component';
import { StepField } from './fields/container.fields';
import { FormEngineService, FormInstance } from './form-engine.service';
import { FormField, isStepField, isValueField } from './form-field.interface';
import { FormParameters } from './form-parameters.interface';
import { StepState } from './form-state.interface';

/** one rendered step: either a real StepField, or the synthetic step collecting non-step outer
 *  fields when the form mixes steps and plain fields (SPEC §5) */
interface DisplayStep {
  step?: StepField;
  label: Signal<string>;
  optional: boolean;
  fields: FormField[];
  /** whether every value field in this step currently passes its own validators (SPEC-driven
   *  gate for linearSteppers + header-jump prevention). A real Signal, not a plain getter —
   *  bridged via `controlStatus` because GenericFormComponent's own template does not reliably
   *  get re-checked purely from a change-detection event that originated several components
   *  deep (e.g. a checkbox toggle inside `app-boolean-field`); only a signal read in the
   *  template is guaranteed to. */
  valid: Signal<boolean>;
}

// ─────────────────────────────────────────────
// Rendering shell. Owns NO field-level semantics — the engine does (SPEC.md). This component
// only assembles the page around fields: stepper vs. flat layout, footer/modal chrome, and
// cross-validator banner placement. Per-field rendering is entirely `app-field`'s job.
// ─────────────────────────────────────────────

@Component({
  selector: 'app-generic-form',
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatDialogModule, MatStepperModule, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './generic-form.component.html',
})
export class GenericFormComponent implements OnInit, OnDestroy {
  readonly params = input.required<FormParameters>();
  /** emits the built FormInstance once, at the end of ngOnInit (SPEC §15) — lets a parent
   *  embedding <app-generic-form> call instance.form.reset()/.submit()/.formState() directly */
  readonly instanceChange = output<FormInstance>();

  private readonly engine = inject(FormEngineService);
  // picks up the ref of whichever ancestor was opened via MatDialog.open() — works whether the
  // form itself was passed to .open() or is just embedded inside a dialog-hosted component
  protected readonly dialogRef = inject(MatDialogRef, { optional: true });
  // ngOnInit is NOT a valid injection context (only the constructor/field initializers are) —
  // `controlStatus()` needs one (it calls `toObservable()`), so `buildSteps()`/`makeBannerSignal()`
  // run through `runInInjectionContext` using this, captured here where DI is actually available.
  private readonly injector = inject(Injector);

  protected instance!: FormInstance;
  protected steps: DisplayStep[] = [];
  protected hasSteps = false;
  protected readonly currentIndex = signal(0);
  protected banner!: Signal<string | null>;

  private readonly subs = new Subscription();

  ngOnInit(): void {
    this.instance = this.engine.build(this.params());
    this.instanceChange.emit(this.instance);
    runInInjectionContext(this.injector, () => {
      this.buildSteps();
      this.banner = this.makeBannerSignal();
    });

    const closeAction$ = this.params().closeAction$;
    if (closeAction$) this.subs.add(closeAction$.subscribe((data) => this.closeModal(data)));
  }

  ngOnDestroy(): void {
    this.instance?.destroy(); // SPEC §10
    this.subs.unsubscribe();
  }

  protected topFields(): FormField[] {
    return (this.params().fields ?? []).filter((f) => !isStepField(f));
  }

  protected async next(entry: DisplayStep): Promise<void> {
    if ((this.params().linearSteppers ?? false) && !entry.valid()) {
      this.markStepTouched(entry);
      return;
    }
    if (entry.step?.onProceed) {
      const stepState = this.makeStepState(entry);
      const ok = await this.resolveProceed(
        entry.step.onProceed(stepState.value, stepState, this.instance.formState()),
      );
      if (!ok) return;
    }
    this.currentIndex.update((i) => i + 1);
  }

  protected back(entry: DisplayStep): void {
    entry.step?.onBack?.(this.makeStepState(entry), this.instance.formState());
    this.currentIndex.update((i) => Math.max(0, i - 1));
  }

  protected async submitForm(): Promise<void> {
    const value = await this.instance.submit();
    if (value !== null && this.params().closeOnSubmit) this.closeModal(value);
  }

  protected cancel(): void {
    this.closeModal();
  }

  /** SPEC §9: cross-validator errors without `showOn` render here instead of inline */
  private makeBannerSignal(): Signal<string | null> {
    const formStatus = controlStatus(computed(() => this.instance.form));
    const bannerTypes = new Set<string>(
      (this.params().crossValidators ?? []).filter((rule) => !rule.showOn).map((rule) => rule.type),
    );
    return computed(() => {
      const status = formStatus();
      if (!status.errors || (!status.touched && !status.dirty)) return null;
      const key = Object.keys(status.errors).find((k) => bannerTypes.has(k));
      return key ? String(status.errors[key]) : null;
    });
  }

  private markStepTouched(entry: DisplayStep): void {
    for (const f of entry.fields) {
      if (isValueField(f)) this.instance.control(f)?.markAsTouched();
    }
  }

  private buildSteps(): void {
    const fields = this.params().fields ?? [];
    const stepFields = fields.filter(isStepField);
    this.hasSteps = stepFields.length > 0;
    if (!this.hasSteps) return;

    const nonStepFields = fields.filter((f) => !isStepField(f));
    const displaySteps: DisplayStep[] = stepFields.map((step) => ({
      step,
      label: computed(() => (this.instance.fieldState(step)().label as string | undefined) ?? ''),
      optional: step.optional === true,
      fields: step.fields,
      valid: this.makeStepValiditySignal(step.fields),
    }));

    if (nonStepFields.length) {
      const mixedLabel = this.params().mixedStepLabel ?? 'More Info';
      const mixed: DisplayStep = {
        label: computed(() => mixedLabel),
        optional: false,
        fields: nonStepFields,
        valid: this.makeStepValiditySignal(nonStepFields),
      };
      if ((this.params().mixedStepPosition ?? 'last') === 'first') displaySteps.unshift(mixed);
      else displaySteps.push(mixed);
    }

    this.steps = displaySteps;
  }

  private makeStepValiditySignal(fields: FormField[]): Signal<boolean> {
    // Angular's AbstractControl.valid is false for a DISABLED control (its status is 'DISABLED',
    // neither VALID nor INVALID) — a disabled field must not block advancing regardless.
    const statuses = fields
      .filter(isValueField)
      .map((f) => controlStatus(computed(() => this.instance.control(f))));
    return computed(() => statuses.every((s) => s().disabled || s().valid !== false));
  }

  private makeStepState(entry: DisplayStep): StepState {
    const raw = this.instance.form.getRawValue() as Record<string, unknown>;
    const value: Record<string, unknown> = {};
    for (const f of entry.fields) {
      if (isValueField(f) && f.key) value[f.key] = raw[f.key];
    }
    // Angular controls can only have one parent, and steps flatten onto the TOP form (SPEC §5)
    // — there's no real per-step FormGroup to hand back without corrupting the real one, so this
    // intentionally reuses the top form (read-only use, e.g. `stepState.form.get(...)`, is fine)
    return {
      value,
      form: this.instance.form,
      fields: entry.fields,
      localForm: this.instance.form,
      localFields: entry.fields,
    };
  }

  private resolveProceed(result: boolean | Promise<boolean> | Observable<boolean>): Promise<boolean> {
    return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
  }

  private closeModal(data?: unknown): void {
    this.dialogRef?.close(data);
    const params = this.params();
    (params.onClose ?? params.onModalClose ?? params.onCloseAction)?.(data);
  }
}
