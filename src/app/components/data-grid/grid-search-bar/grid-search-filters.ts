import { computed, effect, Injector, Signal, signal, untracked } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import {
  FieldType,
  firstErrorMessage,
  FormEngineService,
  FormField,
  FormInstance,
  FormParameter,
  mapRawOptions,
  resolveOptionsSource,
} from '@components/generic-form';
import { map, Subscription } from 'rxjs';
import { GridInstance } from '../grid-engine.service';
import {
  cloneFormFields,
  filterTokenFromField,
  sameFilterValue,
} from '../helpers/grid-search-bar.helpers';
import { GridSearchOption, GridSearchToken } from '../interfaces/grid-search-bar.interface';

/** the headless form, and the (copied) fields it was built from */
interface BuiltForm {
  instance: FormInstance;
  fields: FormField[];
}

/** a filter field the bar can offer, with its control */
interface FilterEntry {
  field: FormField;
  token: GridSearchToken;
  control: AbstractControl;
}

/**
 * The filter half of the unified search bar: a headless generic-form built from `gridFilters` —
 * the same engine the classic filter panel renders — so a filter's label, `visible`, `disabled`,
 * dependent options, `valueFn`, `toSubmit` and validators behave here as they do there
 * (SPEC.md §12). The bar reads what the form offers (`tokens`) and holds (`value`), writes its
 * tokens' values into the controls (`write`), and applies with the panel's own Apply (`submit`).
 *
 * One per bar, created in the bar's injection context (it runs effects) and gone with it — the
 * same shape as file-viewer's `viewer-controller.ts`.
 */
export class GridSearchFilters<RowType = any> {
  private readonly built = signal<BuiltForm | undefined>(undefined);
  private readonly held = signal<Record<string, unknown>>({});
  /** options an `optionsParameter` fetched, by filter key */
  private readonly loaded = signal<Record<string, GridSearchOption[]>>({});
  private readonly loading = signal<ReadonlySet<string>>(new Set());
  private readonly builds = signal(0);
  /** the form was built with its own initial values, which nothing has applied to the grid yet */
  private unapplied = false;

  /** the grid has filters: there is a form */
  readonly present = computed(() => !!this.built());
  /** what the form's controls hold, by filter key */
  readonly value = this.held.asReadonly();
  /** goes up each time the form is (re)built — once per `gridFilters` array */
  readonly version = this.builds.asReadonly();
  /** what the form offers, as it currently resolves each field */
  readonly tokens = computed(() => this.entries(this.loaded()).map((entry) => entry.token));

  /** why each invalid filter would be refused, by token id */
  readonly errors = computed(() => {
    this.held(); // a control's validity follows its value
    const built = this.built();
    const errors: Record<string, string> = {};
    if (!built) return errors;
    for (const field of built.fields) {
      const control = built.instance.control(field);
      if (!field.key || !control?.invalid) continue;
      const validations = 'validations' in field ? field.validations : undefined;
      errors[`filter:${field.key}`] = firstErrorMessage(control.errors, validations) ?? 'Invalid';
    }
    return errors;
  });

  constructor(
    private readonly grid: Signal<GridInstance<RowType>>,
    private readonly injector: Injector,
  ) {
    const formEngine = injector.get(FormEngineService);
    const declared = computed(() => this.grid().params().gridFilters);

    // rebuilt whenever `gridFilters` itself is a new array, from COPIES of the declared fields:
    // the engine resolves observed props onto the objects it's given (see `cloneFormFields`)
    effect(
      (onCleanup) => {
        const fields = declared();
        if (!fields?.length) {
          untracked(() => this.built.set(undefined));
          return;
        }
        onCleanup(untracked(() => this.build(formEngine, cloneFormFields(fields))));
      },
      { injector },
    );

    // options a select filter loads through `optionsParameter` — once per form, like the panel
    effect(
      (onCleanup) => {
        const built = this.built();
        if (!built) return;
        const subs = untracked(() => this.loadOptions(built));
        onCleanup(() => subs.forEach((sub) => sub.unsubscribe()));
      },
      { injector },
    );
  }

  /** the options of this filter are still on their way */
  isLoading(key: string): boolean {
    return this.loading().has(key);
  }

  /** true once per build that kept the form's own initial values: they are the bar's first
   *  tokens, and still have to reach the grid */
  takeUnapplied(): boolean {
    const unapplied = this.unapplied;
    this.unapplied = false;
    return unapplied;
  }

  /** each offered filter's control takes the value `valueOf` gives its token — or, for
   *  `undefined`, goes back to empty (the field's `defaultValue`, else null) */
  write(valueOf: (token: GridSearchToken) => unknown): void {
    for (const { field, token, control } of this.entries()) {
      const empty = ('defaultValue' in field ? field.defaultValue : undefined) ?? null;
      const value = valueOf(token) ?? empty;
      if (sameFilterValue(control.value, value)) continue;
      control.setValue(value);
      control.markAsDirty();
    }
  }

  /** the panel's Apply: everything the form holds, through `toSubmit`; null when a validator
   *  refuses it, or the grid has no filters */
  submit(): Promise<Record<string, unknown> | null> {
    return this.built()?.instance.submitValue() ?? Promise.resolve(null);
  }

  private build(formEngine: FormEngineService, fields: FormField[]): () => void {
    const instance = formEngine.build(signal<FormParameter>({ fields }), this.injector);
    this.built.set({ instance, fields });

    // what the grid already filters by wins over the fields' own initial values; with nothing
    // applied yet, those initial values stand — and are still to be applied
    const filters = this.grid().filters();
    const filtering = Object.keys(filters).length > 0;
    if (filtering) this.write((token) => filters[token.key]);
    this.unapplied = !filtering;

    const changes = instance.form.valueChanges.subscribe(() =>
      this.held.set(instance.form.getRawValue()),
    );
    this.held.set(instance.form.getRawValue());
    this.builds.update((count) => count + 1);

    return () => {
      changes.unsubscribe();
      instance.destroy();
    };
  }

  private loadOptions(built: BuiltForm): Subscription[] {
    const subs: Subscription[] = [];
    for (const field of built.fields) {
      if (field.type !== FieldType.select || !field.key) continue;
      const params = field.optionsParameter;
      const load = params?.optionsFunction;
      if (!params || !load) continue;

      const key = field.key;
      const settle = (): void =>
        this.loading.update((keys) => {
          const next = new Set(keys);
          next.delete(key);
          return next;
        });
      this.loading.update((keys) => new Set(keys).add(key));
      subs.push(
        resolveOptionsSource(() => load(built.instance.formState().value))
          .pipe(map((raw) => mapRawOptions(raw, params)))
          .subscribe({
            next: (options) => {
              this.loaded.update((all) => ({ ...all, [key]: options }));
              settle();
            },
            error: settle,
          }),
      );
    }
    return subs;
  }

  /** the top-level `gridFilters` fields the bar can offer, as the form currently resolves them */
  private entries(loaded: Record<string, GridSearchOption[]> = {}): FilterEntry[] {
    const built = this.built();
    if (!built) return [];
    const operators = this.grid().params().filterConfig?.filterOperators;
    const entries: FilterEntry[] = [];
    for (const field of built.fields) {
      const control = built.instance.control(field);
      if (!field.key || !control) continue;
      const token = filterTokenFromField(
        built.instance.fieldState(field)() as FormField,
        operators?.[field.key] ?? 'equals',
        loaded[field.key],
      );
      if (token) entries.push({ field, token, control });
    }
    return entries;
  }
}
