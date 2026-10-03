import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FieldType,
  FormEngineService,
  FormField,
  FormParameter,
  isObserver,
  observe,
} from '@components/generic-form';
import { GridColumn_ } from '../interfaces/grid-column.interface';
import { GridSearchBarItem, GridSearchToken } from '../interfaces/grid-search-bar.interface';
import { GRID_SEARCH_TEXT_VALUE } from './grid-search-bar.constants';
import {
  cloneFormFields,
  fieldSuggestions,
  filterTokenFromField,
  inputText,
  isEmptyValue,
  isItemComplete,
  itemLabel,
  operatorSuggestions,
  parseValue,
  sameFilterValue,
  searchItemsFromFields,
  searchTokensFromColumns,
  suggestedValue,
  toSearchFields,
  valueLabel,
  valueSuggestions,
} from './grid-search-bar.helpers';

const columns: GridColumn_[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', searchable: true },
  { key: 'age', label: 'Age', type: 'number', searchable: true, searchType: 'equals' },
  { key: 'active', label: 'Active', type: 'boolean', searchable: true },
];

const byId = (tokens: GridSearchToken[]): Map<string, GridSearchToken> =>
  new Map(tokens.map((token) => [token.id, token]));

describe('searchTokensFromColumns', () => {
  it('offers one token per searchable column, with a fixed operator by default', () => {
    const tokens = searchTokensFromColumns(columns, undefined);

    expect(tokens.map((t) => t.id)).toEqual(['search:name', 'search:age', 'search:active']);
    expect(tokens.every((t) => t.source === 'search' && t.available)).toBe(true);
    // column's own searchType → config default → 'like'
    expect(tokens.map((t) => t.operators)).toEqual([['like'], ['equals'], ['like']]);
    expect(tokens.map((t) => t.title)).toEqual(['Name', 'Age', 'Active']);
  });

  it('takes the grid-wide default when a column sets no searchType of its own', () => {
    const tokens = searchTokensFromColumns(columns, { defaultSearchType: 'equals' });
    expect(tokens.map((t) => t.defaultOperator)).toEqual(['equals', 'equals', 'equals']);
  });

  it('makes the operator pickable when searchTypeChangeable is on', () => {
    const [name] = searchTokensFromColumns(columns, { searchTypeChangeable: true });
    expect(name.operators).toEqual([
      'equals',
      'notEquals',
      'like',
      'greaterThan',
      'greaterThanOrEqual',
      'lessThan',
      'lessThanOrEqual',
    ]);
    expect(name.defaultOperator).toBe('like');
  });

  it("keeps a column's default operator even when enabledSearchTypes leaves it out, and drops ones a text value can't express", () => {
    const [name] = searchTokensFromColumns(columns, {
      searchTypeChangeable: true,
      enabledSearchTypes: ['equals', 'in', 'between', 'isNull'],
    });
    expect(name.operators).toEqual(['like', 'equals']);
  });

  it('asks a boolean column for Yes / No and a numeric one for a number', () => {
    const [name, age, active] = searchTokensFromColumns(columns, undefined);
    expect(name.valueKind).toBe('text');
    expect(age.valueKind).toBe('number');
    expect(active.valueKind).toBe('options');
    expect(active.options).toEqual([
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ]);
  });
});

describe('filterTokenFromField', () => {
  it('turns a select into a list-valued token, leaving out a null "None" option', () => {
    const field: FormField = {
      type: FieldType.select,
      key: 'department',
      label: 'Department',
      options: [
        { label: 'None', value: null },
        { label: 'Sales', value: 'sales' },
        { label: 'Support', value: 'support', disabled: true },
      ],
    };
    const token = filterTokenFromField(field, 'equals')!;

    expect(token).toMatchObject({
      id: 'filter:department',
      source: 'filter',
      key: 'department',
      title: 'Department',
      operators: ['equals'],
      valueKind: 'options',
      multiple: false,
      available: true,
    });
    expect(token.options).toEqual([
      { value: 'sales', label: 'Sales', icon: undefined, disabled: undefined },
      { value: 'support', label: 'Support', icon: undefined, disabled: true },
    ]);
  });

  it('takes loaded options over the declared ones, and a multiple select holds several', () => {
    const field: FormField = { type: FieldType.select, key: 'tags', multiple: true, options: [] };
    const token = filterTokenFromField(field, 'in', [{ value: 1, label: 'One' }])!;
    expect(token.multiple).toBe(true);
    expect(token.options).toEqual([
      { value: 1, label: 'One', icon: undefined, disabled: undefined },
    ]);
  });

  it('treats options that are not resolved yet (still an observer) as none', () => {
    const field: FormField = {
      type: FieldType.select,
      key: 'city',
      options: observe('country', () => []),
    };
    expect(filterTokenFromField(field, 'equals')!.options).toEqual([]);
  });

  it('maps each field type to how its value is entered', () => {
    const kind = (field: FormField) => filterTokenFromField(field, 'equals')?.valueKind;

    expect(kind({ type: FieldType.toggle, key: 'a' })).toBe('flag');
    expect(kind({ type: FieldType.checkbox, key: 'a' })).toBe('flag');
    expect(kind({ type: FieldType.input, key: 'a' })).toBe('text');
    expect(kind({ type: FieldType.input, key: 'a', inputType: 'decimal' })).toBe('number');
    expect(kind({ type: FieldType.textarea, key: 'a' })).toBe('text');
    expect(kind({ type: FieldType.date, key: 'a' })).toBe('date');
    expect(kind({ type: FieldType.date, key: 'a', dateType: 'dateTime' })).toBe('datetime');
    expect(kind({ type: FieldType.date, key: 'a', dateType: 'monthYear' })).toBe('month');
    expect(kind({ type: FieldType.date, key: 'a', dateType: 'year' })).toBe('year');
  });

  it("doesn't offer what the bar can't express", () => {
    expect(
      filterTokenFromField({ type: FieldType.object, key: 'a', fields: [] }, 'equals'),
    ).toBeUndefined();
    expect(
      filterTokenFromField({ type: FieldType.attachment, key: 'a' }, 'equals'),
    ).toBeUndefined();
    expect(
      filterTokenFromField({ type: FieldType.input, key: 'a', isList: true }, 'equals'),
    ).toBeUndefined();
    expect(filterTokenFromField({ type: FieldType.input, key: 'a' }, 'between')).toBeUndefined();
    expect(filterTokenFromField({ type: FieldType.button, label: 'Go' }, 'equals')).toBeUndefined();
  });

  it('an operator that takes no value makes any field a flag', () => {
    const token = filterTokenFromField({ type: FieldType.input, key: 'region' }, 'isNull')!;
    expect(token.valueKind).toBe('flag');
    expect(valueLabel(token, true)).toBe('');
    expect(itemLabel({ id: 1, token: token.id, operator: 'isNull', value: true }, token)).toBe(
      'region is empty',
    );
  });

  it('a hidden or disabled field is not offered, but still describes its token', () => {
    const hidden = filterTokenFromField(
      { type: FieldType.toggle, key: 'a', visible: false },
      'equals',
    )!;
    const disabled = filterTokenFromField(
      { type: FieldType.toggle, key: 'a', disabled: true },
      'equals',
    )!;
    expect(hidden.available).toBe(false);
    expect(disabled.available).toBe(false);
  });

  it('falls back to the key when the engine has no label for the field', () => {
    expect(filterTokenFromField({ type: FieldType.input, key: 'region' }, 'equals')!.title).toBe(
      'region',
    );
  });
});

describe('cloneFormFields', () => {
  it('copies fields and their nested fields, leaving the declared objects untouched', () => {
    const child: FormField = { type: FieldType.input, key: 'city' };
    const parent: FormField = { type: FieldType.object, key: 'address', fields: [child] };
    const [copy] = cloneFormFields([parent]);

    expect(copy).not.toBe(parent);
    expect(copy).toEqual(parent);
    expect((copy as typeof parent & { fields: FormField[] }).fields[0]).not.toBe(child);

    (copy as { label?: string }).label = 'changed';
    expect(parent.label).toBeUndefined();
  });
});

describe('cloneFormFields — why a form is built from copies', () => {
  let engine: FormEngineService;
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(FormEngineService);
    injector = TestBed.inject(Injector);
  });

  /** a filter that only shows once another has a value — the demo grid's own shape */
  const declared = (): FormField[] => [
    { type: FieldType.select, key: 'department', options: [] },
    { type: FieldType.toggle, key: 'active', visible: observe('department', (d) => !!d) },
  ];
  const build = (fields: FormField[]) => engine.build(signal<FormParameter>({ fields }), injector);
  // observer resolution is wrapped in a microtask (generic-form SPEC §1)
  const settle = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it('the engine writes a resolved value over the observed prop of the object it is given, so a second form built from it has nothing to observe', async () => {
    const fields = declared();
    const first = build(fields);
    await settle();
    first.destroy();

    expect(isObserver(fields[1].visible)).toBe(false);

    const second = build(fields);
    await settle();
    second.control(fields[0])!.setValue('Sales');
    await settle();
    expect(second.fieldState(fields[1])().visible).toBe(false); // stuck at the first form's answer
    second.destroy();
  });

  it('built from copies, each form observes afresh and the declared config stays intact', async () => {
    const fields = declared();

    for (let round = 0; round < 2; round++) {
      const copies = cloneFormFields(fields);
      const form = build(copies);
      await settle();
      expect(form.fieldState(copies[1])().visible).toBe(false);

      form.control(copies[0])!.setValue('Sales');
      await settle();
      expect(form.fieldState(copies[1])().visible).toBe(true);
      form.destroy();
    }

    expect(isObserver(fields[1].visible)).toBe(true);
  });
});

describe('values', () => {
  const select = filterTokenFromField(
    {
      type: FieldType.select,
      key: 'department',
      label: 'Department',
      options: [
        { label: 'Sales', value: 's' },
        { label: 'Support', value: 'u' },
      ],
    },
    'equals',
  )!;
  const toggle = filterTokenFromField(
    { type: FieldType.toggle, key: 'active', label: 'Active' },
    'equals',
  )!;
  const [name] = searchTokensFromColumns(columns, undefined);

  it('isEmptyValue matches what local filtering ignores, plus an empty list', () => {
    for (const empty of [undefined, null, '', false, []]) expect(isEmptyValue(empty)).toBe(true);
    for (const set of [0, 'a', true, ['a'], new Date()]) expect(isEmptyValue(set)).toBe(false);
  });

  it('sameFilterValue: every form of "no value" is the same, dates by time, lists by element', () => {
    expect(sameFilterValue(null, false)).toBe(true);
    expect(sameFilterValue('', [])).toBe(true);
    expect(sameFilterValue(undefined, null)).toBe(true);
    expect(sameFilterValue(0, null)).toBe(false);
    expect(sameFilterValue('a', 'a')).toBe(true);
    expect(sameFilterValue(new Date(2024, 0, 5), new Date(2024, 0, 5))).toBe(true);
    expect(sameFilterValue(new Date(2024, 0, 5), new Date(2024, 0, 6))).toBe(false);
    expect(sameFilterValue(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameFilterValue(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameFilterValue({ id: 1 }, { id: 1 })).toBe(false); // objects by identity
  });

  it('a token is complete once it has a value; a flag once picked; text once not blank', () => {
    expect(isItemComplete({ id: 1, token: select.id, value: null }, select)).toBe(false);
    expect(isItemComplete({ id: 1, token: select.id, value: 's' }, select)).toBe(true);
    expect(isItemComplete({ id: 1, token: toggle.id, value: true }, toggle)).toBe(true);
    expect(isItemComplete({ id: 1, value: '  ' }, undefined)).toBe(false);
    expect(isItemComplete({ id: 1, value: 'ada' }, undefined)).toBe(true);
  });

  it('labels a value by its option, joins several, and reads a flag as Yes', () => {
    expect(valueLabel(select, 's')).toBe('Sales');
    expect(valueLabel({ ...select, multiple: true }, ['s', 'u'])).toBe('Sales, Support');
    expect(valueLabel(select, 'gone')).toBe('gone');
    expect(valueLabel(toggle, true)).toBe('Yes');
    expect(valueLabel(undefined, 'free text')).toBe('free text');
  });

  it("compares option values with the select's own compareWith", () => {
    const token: GridSearchToken = {
      ...select,
      options: [{ value: { id: 1 }, label: 'One' }],
      compare: (a, b) => (a as { id: number })?.id === (b as { id: number })?.id,
    };
    expect(valueLabel(token, { id: 1 })).toBe('One');
  });

  it('names a token in full', () => {
    expect(itemLabel({ id: 1, token: select.id, operator: 'equals', value: 's' }, select)).toBe(
      'Department is Sales',
    );
    expect(itemLabel({ id: 2, token: name.id, operator: 'like', value: 'ada' }, name)).toBe(
      'Name contains ada',
    );
    expect(itemLabel({ id: 3, token: toggle.id, operator: 'equals', value: true }, toggle)).toBe(
      'Active is Yes',
    );
    expect(itemLabel({ id: 4, value: 'emp' }, undefined)).toBe('Text: emp');
  });

  it('keeps typed text for a column token and types it for a filter token', () => {
    const numeric = filterTokenFromField(
      { type: FieldType.input, key: 'n', inputType: 'integer' },
      'equals',
    )!;
    const day = filterTokenFromField({ type: FieldType.date, key: 'd' }, 'equals')!;
    const month = filterTokenFromField(
      { type: FieldType.date, key: 'm', dateType: 'monthYear' },
      'equals',
    )!;
    const year = filterTokenFromField(
      { type: FieldType.date, key: 'y', dateType: 'year' },
      'equals',
    )!;

    expect(parseValue(name, '42')).toBe('42');
    expect(parseValue(undefined, ' some text ')).toBe(' some text ');
    expect(parseValue(numeric, '42')).toBe(42);
    expect(parseValue(numeric, 'abc')).toBeNull();
    expect(parseValue(numeric, '  ')).toBeNull();

    const parsed = parseValue(day, '2024-03-05') as Date;
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours()]).toEqual([
      2024, 2, 5, 0,
    ]);
    expect(parseValue(day, '2024-03')).toBeNull();
    expect((parseValue(month, '2024-03') as Date).getMonth()).toBe(2);
    expect((parseValue(year, '2024') as Date).getFullYear()).toBe(2024);

    // and back, for editing
    expect(inputText(day, parsed)).toBe('2024-03-05');
    expect(inputText(month, new Date(2024, 2, 1))).toBe('2024-03');
    expect(inputText(year, new Date(2024, 0, 1))).toBe('2024');
    expect(inputText(numeric, 42)).toBe('42');
    expect(inputText(select, 's')).toBe('Sales');
    expect(inputText(name, null)).toBe('');
  });
});

describe('the list', () => {
  const search = searchTokensFromColumns(columns, undefined);
  const filters = [
    filterTokenFromField(
      { type: FieldType.select, key: 'department', label: 'Department' },
      'equals',
    )!,
    filterTokenFromField(
      { type: FieldType.toggle, key: 'remote', label: 'Remote', visible: false },
      'equals',
    )!,
  ];
  const all = [...search, ...filters];

  it('lists every offered field under Columns / Filters when the grid has both', () => {
    const rows = fieldSuggestions(all, new Set(), '', true);
    expect(rows.map((r) => [r.group, r.label])).toEqual([
      ['Columns', 'Name'],
      ['Columns', 'Age'],
      ['Columns', 'Active'],
      ['Filters', 'Department'], // Remote is hidden, so not offered
    ]);
  });

  it('uses no headings when the grid has one kind only', () => {
    expect(fieldSuggestions(search, new Set(), '', true).every((r) => r.group === undefined)).toBe(
      true,
    );
  });

  it('narrows by what is typed, drops used fields, and ends with the free-text row', () => {
    const rows = fieldSuggestions(all, new Set(['search:name']), 'a', true);
    expect(rows.map((r) => r.label)).toEqual([
      'Age',
      'Active',
      'Department',
      'Search for this text',
    ]);
    expect(rows.at(-1)!.value).toBe(GRID_SEARCH_TEXT_VALUE);
  });

  it('has no free-text row when free text is off, or nothing is typed', () => {
    expect(
      fieldSuggestions(all, new Set(), 'a', false).some((r) => r.value === GRID_SEARCH_TEXT_VALUE),
    ).toBe(false);
    expect(
      fieldSuggestions(all, new Set(), '  ', true).some((r) => r.value === GRID_SEARCH_TEXT_VALUE),
    ).toBe(false);
  });

  it('shows an operator as its symbol with what it means, or as plain words', () => {
    const [name] = searchTokensFromColumns(columns, { searchTypeChangeable: true });
    const rows = operatorSuggestions(name);
    expect(rows.find((r) => r.value === 'equals')).toEqual({
      value: 'equals',
      label: '=',
      description: 'is',
    });
    expect(rows.find((r) => r.value === 'like')).toEqual({
      value: 'like',
      label: 'contains',
      description: undefined,
    });
  });

  it("narrows a token's options only once the user has typed", () => {
    const token = filterTokenFromField(
      {
        type: FieldType.select,
        key: 'department',
        options: [
          { label: 'Sales', value: 's' },
          { label: 'Support', value: 'u' },
        ],
      },
      'equals',
    )!;
    expect(valueSuggestions(token, 'Sales', false).map((r) => r.label)).toEqual([
      'Sales',
      'Support',
    ]);
    expect(valueSuggestions(token, 'sup', true).map((r) => r.label)).toEqual(['Support']);
  });

  describe("suggestedValue — GitLab's highlight rule", () => {
    const rows = fieldSuggestions(all, new Set(), 'a', true);

    it('with nothing typed, highlights the fallback', () => {
      expect(suggestedValue(rows, '', undefined)).toBeUndefined();
      expect(suggestedValue(rows, ' ', 'search:age')).toBe('search:age');
    });

    it('highlights the field named exactly what is typed, before one that only contains it', () => {
      expect(suggestedValue(fieldSuggestions(all, new Set(), 'age', true), 'age')).toBe(
        'search:age',
      );
      expect(suggestedValue(fieldSuggestions(all, new Set(), 'ACT', true), 'ACT')).toBe(
        'search:active',
      );
    });

    it('highlights the first field containing the text', () => {
      expect(suggestedValue(rows, 'a')).toBe('search:name');
    });

    it('falls to the free-text row when no field matches, and to nothing without that row', () => {
      expect(suggestedValue(fieldSuggestions(all, new Set(), 'zzz', true), 'zzz')).toBe(
        GRID_SEARCH_TEXT_VALUE,
      );
      expect(suggestedValue(fieldSuggestions(all, new Set(), 'zzz', false), 'zzz')).toBeUndefined();
    });

    it('never highlights a disabled row', () => {
      expect(
        suggestedValue([{ value: 1, label: 'Sales', disabled: true }], 'sales'),
      ).toBeUndefined();
    });
  });
});

describe('to and from searchFields', () => {
  const tokens = byId([
    ...searchTokensFromColumns(columns, undefined),
    filterTokenFromField({ type: FieldType.toggle, key: 'remote' }, 'equals')!,
  ]);
  const item = (id: number, rest: Omit<GridSearchBarItem, 'id'>): GridSearchBarItem => ({
    id,
    ...rest,
  });

  it('an empty bar is one keyless entry with no value', () => {
    expect(toSearchFields([], tokens, '')).toEqual([
      { key: undefined, value: '', searchType: 'like' },
    ]);
    expect(toSearchFields([], tokens, '   ', 'equals')).toEqual([
      { key: undefined, value: '', searchType: 'equals' },
    ]);
  });

  it('puts free text first — pills, then what is still in the input — then column tokens', () => {
    const items = [
      item(1, { token: 'search:name', operator: 'like', value: 'ada' }),
      item(2, { value: 'emp' }),
      item(3, { token: 'search:age', operator: 'greaterThan', value: '30' }),
    ];
    expect(toSearchFields(items, tokens, ' typing ')).toEqual([
      { key: undefined, value: 'emp', searchType: 'like' },
      { key: undefined, value: 'typing', searchType: 'like' },
      { key: 'name', value: 'ada', searchType: 'like' },
      { key: 'age', value: '30', searchType: 'greaterThan' },
    ]);
  });

  it('leaves out filter tokens, tokens without a value, and tokens the grid no longer offers', () => {
    const items = [
      item(1, { token: 'filter:remote', operator: 'equals', value: true }),
      item(2, { token: 'search:name', operator: 'like', value: '' }),
      item(3, { token: 'search:gone', operator: 'like', value: 'x' }),
    ];
    expect(toSearchFields(items, tokens, '')).toEqual([
      { key: undefined, value: '', searchType: 'like' },
    ]);
  });

  it('reads searchFields back into pills and tokens, skipping empty and unknown entries', () => {
    expect(
      searchItemsFromFields(
        [
          { key: undefined, value: 'emp', searchType: 'like' },
          { key: 'name', value: 'ada', searchType: 'equals' },
          { key: 'name', value: '', searchType: 'like' },
          { key: 'id', value: '7', searchType: 'like' }, // not a searchable column
        ],
        tokens,
      ),
    ).toEqual([{ value: 'emp' }, { token: 'search:name', operator: 'equals', value: 'ada' }]);
  });

  it('round-trips', () => {
    const fields = [
      { key: undefined, value: 'emp', searchType: 'like' as const },
      { key: 'name', value: 'ada', searchType: 'like' as const },
    ];
    const items = searchItemsFromFields(fields, tokens).map((rest, i) => item(i, rest));
    expect(toSearchFields(items, tokens, '')).toEqual(fields);
  });
});
