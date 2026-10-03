import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  OnInit,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormInstance } from '../../form-engine.service';
import { FormField } from '../../interfaces/form-field.interface';
import { ObjectField } from '../../interfaces/container-fields.interface';
import { joinClasses } from '../../helpers/class.helpers';
import { controlStatus } from '../../helpers/control-status.helpers';
// type-only: keeps this file's compiled JS from importing field.component.ts, which imports
// ObjectFieldComponent — see the circular-import note in field.component.ts.
import type { FieldChildContext } from '../form-field.component';

interface ListItemView {
  index: number;
  fields: FormField[];
  label: string;
}

@Component({
  selector: 'object-field',
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './object-field.component.html',
})
export class ObjectFieldComponent implements OnInit {
  readonly field = input.required<ObjectField>();
  readonly instance = input.required<FormInstance>();
  /** supplied by `form-field` so children can recurse without a circular component import */
  readonly fieldTemplate = input.required<TemplateRef<FieldChildContext>>();

  protected readonly bodyId = `object-field-body-${Math.random().toString(36).slice(2)}`;

  protected readonly state = computed(() => this.instance().fieldState(this.field())());

  protected readonly showHeader = computed(
    () => this.state().showFormLabel !== false && !!(this.state().label || this.state().icon),
  );

  // only the *initial* collapse state comes from config — once toggled, a manual click
  // shouldn't get clobbered by a re-render with the same input (mirrors field-group.component).
  // Seeded in ngOnInit, not here — required inputs aren't readable yet during construction.
  protected readonly isOpen = signal(true);

  ngOnInit(): void {
    this.isOpen.set(this.field().collapsed !== true);
  }

  protected readonly wrapperClass = computed(() => joinClasses('relative', this.state().class));
  protected readonly arrayControl = computed(() => this.instance().control(this.field()));
  protected readonly arrayStatus = controlStatus(this.arrayControl);

  protected readonly items = computed<ListItemView[]>(() => {
    const f = this.field();
    if (!f.isList) return [];

    const rawValues = (this.arrayStatus().value as Record<string, unknown>[] | null) ?? [];

    return rawValues.map((rowValue, index) => ({
      index,
      fields: this.instance().listItemFields(f, index),
      label: this.itemLabel(f, rowValue, index),
    }));
  });

  protected readonly canAdd = computed(() => {
    const f = this.field();
    if (this.state().canAddItem === false) return false;
    return f.maxItems === undefined || this.items().length < f.maxItems;
  });

  protected readonly canRemove = computed(() => {
    const f = this.field();
    if (this.state().canAddItem === false) return false;
    return this.items().length > (f.minItems ?? 0);
  });

  protected toggle(): void {
    if (this.field().collapsible) this.isOpen.update((open) => !open);
  }

  protected addItem(): void {
    this.instance().addListItem(this.field().path!);
  }

  protected removeItem(index: number): void {
    this.instance().removeListItem(this.field().path!, index);
  }

  private itemLabel(f: ObjectField, rowValue: Record<string, unknown>, index: number): string {
    const value = rowValue?.[f.itemLabelKey ?? 'label'];
    return value ? String(value) : `Item ${index + 1}`;
  }
}
