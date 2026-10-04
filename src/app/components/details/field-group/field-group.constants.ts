import { FieldLayout } from '../interfaces/field.interface';
import { ArrayConfig, FieldConfig } from '../interfaces/details.interface';
import { mergeClasses } from '@utils/class-name.helpers';

// Failsafe against unbounded scrolling: array fields paginate once they exceed this many items,
// unless a field sets its own `pageSize`.
export const DEFAULT_PAGE_SIZE = 50;

export interface LayoutPreset {
  fieldConfig: FieldConfig;
  arrayConfig: ArrayConfig;
}

// A label is its field's own colour, faded — but only to 80%: below that, a label on a tinted
// card or in a coloured field drops under 4.5:1. The colour is what fades, not the label's
// `opacity`: the buttons that sit beside an array's label ("Add") would fade with it, and theirs
// is a colour that has nothing to spare.
const FADED = '[color:color-mix(in_oklab,currentColor_80%,transparent)]';

// Each layout is self-contained: its own default FieldConfig + ArrayConfig, expressed in the
// same shape a caller would pass in. A caller's own fieldConfig/arrayConfig is merged on top
// (class-like props combine via mergeClasses, everything else is a plain override) rather than
// replacing the preset outright — see `mergeFieldConfig`/`mergeArrayConfig`.
export const LAYOUT_PRESETS: Record<FieldLayout, LayoutPreset> = {
  list: {
    fieldConfig: {
      containerClass: 'grid grid-cols-1 lg:grid-cols-2 gap-4',
      class: 'flex flex-col gap-0.5 py-1.5',
      labelsClass: `text-xs uppercase tracking-wide ${FADED}`,
      valuesClass: 'text-sm',
      showUnderlines: true,
    },
    arrayConfig: {
      class: 'col-span-full',
      fieldsContainerClass: 'p-2',
    },
  },

  table: {
    fieldConfig: {
      class: 'grid grid-cols-12 gap-x-3 items-baseline border-b border-black/10 py-1.5',
      labelsClass: `col-span-5 sm:col-span-4 font-medium text-sm ${FADED}`,
      valuesClass: 'col-span-7 sm:col-span-8 text-sm',
    },
    arrayConfig: {
      class: 'col-span-full',
    },
  },

  palletes: {
    fieldConfig: {
      class: 'grid grid-cols-12 gap-x-3 items-baseline rounded-md odd:bg-black/[0.03] py-1.5 px-2',
      labelsClass: `col-span-5 sm:col-span-4 text-sm ${FADED}`,
      valuesClass: 'col-span-7 sm:col-span-8 text-sm',
    },
    arrayConfig: {
      class: 'col-span-full',
    },
  },

  'inline-list': {
    fieldConfig: {
      class: 'flex items-baseline flex-wrap gap-x-1.5 py-1',
      labelsClass: 'inline-block px-2 py-0.5 rounded-full bg-black/5 text-xs font-medium',
      valuesClass: 'text-sm',
      showColon: true,
    },
    arrayConfig: {
      class: 'w-full',
    },
  },
};

const FIELD_CONFIG_CLASS_KEYS: (keyof FieldConfig)[] = [
  'class',
  'innerClass',
  'iconsClass',
  'labelsClass',
  'valuesClass',
  'dividerClass',
  'containerClass',
];

const ARRAY_CONFIG_CLASS_KEYS: (keyof ArrayConfig)[] = [
  'class',
  'groupClass',
  'fieldsContainerClass',
  'indexClass',
];

function mergeConfig<T extends object>(
  base: T,
  override: T | undefined,
  classKeys: (keyof T)[],
): T {
  const b: any = base;
  const o: any = override ?? {};
  const merged: any = { ...b, ...o };

  for (const key of classKeys) {
    const a = b[key as string] as string | undefined;
    const c = o[key as string] as string | undefined;
    if (a || c) merged[key as string] = mergeClasses(a ?? '', c ?? '');
  }

  return merged as T;
}

export function mergeFieldConfig(base: FieldConfig, override?: FieldConfig): FieldConfig {
  return mergeConfig(base, override, FIELD_CONFIG_CLASS_KEYS);
}

export function mergeArrayConfig(base: ArrayConfig, override?: ArrayConfig): ArrayConfig {
  return mergeConfig(base, override, ARRAY_CONFIG_CLASS_KEYS);
}
