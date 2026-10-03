import { Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldType, FormField, observe, VALIDATOR_REQUIRED } from '@components/generic-form';
import { GridEngineService, GridInstance } from '../grid-engine.service';
import { GridToolbarComponent } from '../grid-toolbar/grid-toolbar.component';
import { GridParameter } from '../interfaces/grid-parameter.interface';
import { GridSearchBarComponent } from './grid-search-bar.component';

interface Row {
  id: number;
  name: string;
  city: string;
  department: string;
  active: boolean;
}

const ROWS: Row[] = [
  { id: 1, name: 'Ada', city: 'NYC', department: 'Sales', active: true },
  { id: 2, name: 'Grace', city: 'Chicago', department: 'Sales', active: false },
  { id: 3, name: 'Alan', city: 'NYC', department: 'Support', active: true },
  { id: 4, name: 'Edsger', city: 'Austin', department: 'Engineering', active: true },
];

/** a filter that only shows once another has a value, like the demo grid's */
const filters = (): FormField[] => [
  {
    type: FieldType.select,
    key: 'department',
    options: [
      { label: 'Sales', value: 'Sales' },
      { label: 'Support', value: 'Support' },
      { label: 'Engineering', value: 'Engineering' },
    ],
  },
  { type: FieldType.toggle, key: 'active', visible: observe('department', (d) => !!d) },
];

const params = (over: Partial<GridParameter<Row>> = {}): GridParameter<Row> => ({
  label: 'People',
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name', searchable: true },
    { key: 'city', label: 'City', searchable: true },
    { key: 'department', label: 'Department' },
  ],
  gridData: ROWS,
  gridFilters: filters(),
  searchConfig: { changeDebounce: 5 },
  ...over,
});

describe('GridSearchBarComponent', () => {
  let engine: GridEngineService;
  let injector: Injector;
  let fixture: ComponentFixture<GridSearchBarComponent<Row>>;
  let instance: GridInstance<Row>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GridSearchBarComponent] });
    engine = TestBed.inject(GridEngineService);
    injector = TestBed.inject(Injector);
  });

  /** lets effects, the apply microtask, the debounce and the grid's own pipeline run */
  async function settle(ms = 20): Promise<void> {
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve, round === 0 ? ms : 0));
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  async function mount(over: Partial<GridParameter<Row>> = {}, search = true): Promise<void> {
    instance = engine.build(signal(params(over)), injector);
    fixture = TestBed.createComponent(GridSearchBarComponent<Row>);
    fixture.componentRef.setInput('instance', instance);
    fixture.componentRef.setInput('search', search);
    host = fixture.nativeElement;
    await settle();
    await vi.waitFor(() => expect(instance.loading()).toBe(false));
  }

  // ── what a user does ──

  const box = (): HTMLInputElement =>
    host.querySelector<HTMLInputElement>(':scope > div > grid-search-segment input')!;
  const focused = (): HTMLInputElement => document.activeElement as HTMLInputElement;

  /** a key the way a browser delivers it: keydown, then — unless a handler prevented it — the
   *  edit it makes to whichever box holds the focus by then, and that box's `input` event */
  function press(key: string): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    focused().dispatchEvent(event);
    if (event.defaultPrevented) return;

    const target = focused();
    const text = target.value;
    const start = target.selectionStart ?? text.length;
    const end = target.selectionEnd ?? start;
    if (key.length === 1) target.value = text.slice(0, start) + key + text.slice(end);
    else if (key !== 'Backspace') return;
    else if (start !== end) target.value = text.slice(0, start) + text.slice(end);
    else target.value = text.slice(0, Math.max(0, start - 1)) + text.slice(start);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** every key back to back, with no render awaited in between */
  function type(...keys: string[]): void {
    for (const key of keys) {
      if (key.length > 1 && /^(Enter|Backspace|Escape|Arrow\w+)$/.test(key)) press(key);
      else for (const char of key) press(char);
    }
  }

  function click(element: Element): void {
    element.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
    );
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  }

  // ── what a user sees ──

  const tokens = (): string[] =>
    Array.from(host.querySelectorAll('grid-search-token')).map((t) =>
      t.getAttribute('aria-label')!,
    );
  const listbox = (): HTMLElement | null => document.querySelector('[role="listbox"]');
  const options = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]'));
  const optionLabels = (): string[] =>
    options().map((o) => o.querySelector('span')!.textContent!.trim());
  const highlighted = (): string | undefined =>
    options()
      .find((o) => o.id === focused().getAttribute('aria-activedescendant'))
      ?.querySelector('span')
      ?.textContent?.trim();
  const status = (): string => host.querySelector('[role="status"]')!.textContent!.trim();
  const names = (): string[] => instance.rows().map((row) => row.name);

  describe('a grid with nothing to pick', () => {
    beforeEach(() => mount({ columns: ['id', 'name', 'city'], gridFilters: undefined }));

    it('is a plain search box: no combobox, no list', () => {
      box().focus();
      fixture.detectChanges();

      expect(box().getAttribute('role')).toBeNull();
      expect(box().placeholder).toBe('Search…');
      expect(listbox()).toBeNull();
      expect(host.getAttribute('role')).toBe('search');
      expect(host.getAttribute('aria-label')).toBe('Search People');
    });

    it('searches every column as the text is typed, and Enter leaves the text where it is', async () => {
      box().focus();
      type('chicago');
      await settle();

      expect(instance.searchFields()).toEqual([
        { key: undefined, value: 'chicago', searchType: 'like' },
      ]);
      await vi.waitFor(() => expect(names()).toEqual(['Grace']));

      type('Enter');
      await settle();
      expect(tokens()).toEqual([]);
      expect(box().value).toBe('chicago');
    });

    it('Clear empties the box, applies at once and takes the focus back', async () => {
      box().focus();
      type('chicago');
      await settle();

      click(host.querySelector('button[aria-label="Clear search"]')!);
      await settle();

      expect(box().value).toBe('');
      expect(instance.searchFields()).toEqual([{ key: undefined, value: '', searchType: 'like' }]);
      expect(focused()).toBe(box());
      expect(host.querySelector('button[aria-label="Clear search"]')).toBeNull();
      await vi.waitFor(() => expect(names().length).toBe(4));
    });
  });

  describe('the list', () => {
    beforeEach(() => mount());

    it('opens on focus as a combobox list of every field, under Columns and Filters', () => {
      box().focus();
      fixture.detectChanges();

      expect(box().getAttribute('role')).toBe('combobox');
      expect(box().getAttribute('aria-expanded')).toBe('true');
      expect(box().getAttribute('aria-controls')).toBe(listbox()!.id);
      expect(box().placeholder).toBe('Search or filter…');
      // the Active filter depends on Department, so it isn't offered yet
      expect(optionLabels()).toEqual(['Name', 'City', 'Department']);
      expect(
        Array.from(listbox()!.querySelectorAll('[role="group"]')).map((g) =>
          g.getAttribute('aria-label'),
        ),
      ).toEqual(['Columns', 'Filters']);
      // nothing typed: nothing highlighted, so Enter would search, not pick
      expect(box().getAttribute('aria-activedescendant')).toBeNull();
    });

    it('narrows as you type and highlights the field Enter would pick', () => {
      box().focus();
      type('na');
      expect(optionLabels()).toEqual(['Name', 'Search for this text']);
      expect(highlighted()).toBe('Name');

      type('x');
      expect(optionLabels()).toEqual(['Search for this text']);
      expect(highlighted()).toBe('Search for this text');
    });

    it('↓ / ↑ move the highlight, wrapping, and Esc closes the list until the next key', () => {
      box().focus();
      fixture.detectChanges();

      type('ArrowDown');
      fixture.detectChanges();
      expect(highlighted()).toBe('Name');
      type('ArrowUp');
      fixture.detectChanges();
      expect(highlighted()).toBe('Department');

      type('Escape');
      fixture.detectChanges();
      expect(listbox()).toBeNull();
      expect(box().getAttribute('aria-expanded')).toBe('false');

      type('ArrowDown');
      fixture.detectChanges();
      expect(listbox()).not.toBeNull();
    });
  });

  describe('a filter token', () => {
    beforeEach(() => mount());

    it('is built by keyboard in one burst: field, then value', async () => {
      box().focus();
      type('dep', 'Enter', 'sup', 'Enter');
      await settle();

      expect(tokens()).toEqual(['Department is Support']);
      expect(instance.filters()).toEqual({ department: 'Support', active: null });
      expect(focused()).toBe(box());
      expect(status()).toBe('Added Department is Support');
      await vi.waitFor(() => expect(names()).toEqual(['Alan']));
    });

    it('picked with the arrow keys, leaves no row highlighted in the box it returns to', async () => {
      box().focus();
      fixture.detectChanges();
      type('ArrowDown', 'ArrowDown', 'ArrowDown');
      fixture.detectChanges();
      expect(highlighted()).toBe('Department');

      type('Enter', 'Enter');
      await settle();
      expect(tokens()).toEqual(['Department is Sales']);
      expect(focused()).toBe(box());
      // the list is open again — but Enter here must search, not take whatever sits third now
      expect(optionLabels()).toEqual(['Name', 'City', 'Active']);
      expect(box().getAttribute('aria-activedescendant')).toBeNull();
    });

    it('lists the values with the first highlighted, and a click takes one', async () => {
      box().focus();
      type('dep', 'Enter');
      expect(tokens()).toEqual(['Department is']);
      expect(focused().getAttribute('aria-label')).toBe('Department, value');
      expect(optionLabels()).toEqual(['Sales', 'Support', 'Engineering']);
      expect(highlighted()).toBe('Sales');

      click(options()[2]);
      await settle();
      expect(tokens()).toEqual(['Department is Engineering']);
      await vi.waitFor(() => expect(names()).toEqual(['Edsger']));
    });

    it('offers a dependent filter only once the one it depends on has a value — and a toggle is complete as soon as it is picked', async () => {
      box().focus();
      type('dep', 'Enter', 'sal', 'Enter');
      await settle();
      expect(optionLabels()).toEqual(['Name', 'City', 'Active']);

      type('act', 'Enter');
      await settle();
      expect(tokens()).toEqual(['Department is Sales', 'Active is Yes']);
      expect(instance.filters()).toEqual({ department: 'Sales', active: true });
      await vi.waitFor(() => expect(names()).toEqual(['Ada']));
    });

    it('leaves the list when used, and typed text matching no option is discarded', async () => {
      box().focus();
      type('dep', 'Enter', 'sal', 'Enter');
      await settle();
      expect(optionLabels()).not.toContain('Department');

      // edit the value, type nonsense, Enter: the value stays
      click(host.querySelector('button[aria-label="Change the value of Department is Sales"]')!);
      expect(focused().value).toBe('Sales');
      type('zzz', 'Enter');
      await settle();
      expect(tokens()).toEqual(['Department is Sales']);
    });

    it('a token left without a value is dropped', async () => {
      box().focus();
      type('dep', 'Enter');
      expect(tokens()).toEqual(['Department is']);

      focused().blur();
      await settle();
      expect(tokens()).toEqual([]);
      expect(instance.filters()).toEqual({});
    });

    it('its remove button takes it away, applies, and hands the focus to the box', async () => {
      box().focus();
      type('dep', 'Enter', 'sal', 'Enter');
      await settle();

      const remove = host.querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Department is Sales"]',
      )!;
      expect(remove.tabIndex).toBe(0);
      remove.click();
      await settle();

      expect(tokens()).toEqual([]);
      expect(instance.filters()).toEqual({});
      expect(focused()).toBe(box());
      expect(status()).toBe('Removed Department is Sales');
    });
  });

  describe('a column token', () => {
    it('has a fixed operator by default: field, then the text', async () => {
      await mount();
      box().focus();
      type('name', 'Enter', 'a', 'Enter');
      await settle();

      expect(tokens()).toEqual(['Name contains a']);
      expect(instance.searchFields()).toEqual([{ key: 'name', value: 'a', searchType: 'like' }]);
      await vi.waitFor(() => expect(names()).toEqual(['Ada', 'Grace', 'Alan']));
    });

    it('narrows together with a second token (AND), where the classic fields would widen', async () => {
      await mount();
      box().focus();
      type('name', 'Enter', 'a', 'Enter', 'city', 'Enter', 'nyc', 'Enter');
      await settle();

      expect(tokens()).toEqual(['Name contains a', 'City contains nyc']);
      await vi.waitFor(() => expect(names()).toEqual(['Ada', 'Alan']));
    });

    it('filters while its value is typed', async () => {
      await mount();
      box().focus();
      type('name', 'Enter', 'gra');
      await settle();

      expect(tokens()).toEqual(['Name contains gra']);
      await vi.waitFor(() => expect(names()).toEqual(['Grace']));
    });

    it('moves to another field keeping its typed value, since that field is typed into as well', async () => {
      await mount();
      box().focus();
      type('name', 'Enter', 'nyc', 'Enter');
      await settle();
      await vi.waitFor(() => expect(names()).toEqual([]));

      click(host.querySelector('button[aria-label="Change the field of Name contains nyc"]')!);
      expect(focused().getAttribute('aria-label')).toBe('Name, field');
      // every field still free, and its own, which starts highlighted
      expect(optionLabels()).toEqual(['Name', 'City', 'Department']);
      expect(highlighted()).toBe('Name');

      type('ArrowDown', 'Enter', 'Enter');
      await settle();
      expect(tokens()).toEqual(['City contains nyc']);
      expect(instance.searchFields()).toEqual([{ key: 'city', value: 'nyc', searchType: 'like' }]);
      await vi.waitFor(() => expect(names()).toEqual(['Ada', 'Alan']));
    });

    it('moving it to a field that is picked from drops the typed value', async () => {
      await mount();
      box().focus();
      type('name', 'Enter', 'nyc', 'Enter');
      await settle();

      click(host.querySelector('button[aria-label="Change the field of Name contains nyc"]')!);
      type('dep', 'Enter');
      expect(tokens()).toEqual(['Department is']);
      expect(focused().getAttribute('aria-label')).toBe('Department, value');
    });

    it('← and → walk the parts: out of the box into the last token, part by part, and back', async () => {
      await mount({ searchConfig: { changeDebounce: 5, searchTypeChangeable: true } });
      box().focus();
      type('name', 'Enter', '=', 'ada', 'Enter', 'city', 'Enter', '=', 'nyc', 'Enter');
      await settle();
      const where = (): string | null => focused().getAttribute('aria-label');
      const caretToStart = (): void => focused().setSelectionRange(0, 0);
      const left = (): void => {
        caretToStart();
        type('ArrowLeft');
      };

      type('ArrowLeft'); // the box is empty: its caret is at the start
      expect(where()).toBe('City, value');
      expect(focused().value).toBe('nyc');
      // mid-text, the arrow is the input's own
      type('ArrowLeft');
      expect(where()).toBe('City, value');

      left();
      expect(where()).toBe('City, operator');
      left();
      expect(where()).toBe('City, field');
      left();
      expect(where()).toBe('Name, value');

      // and forward again: → at the end of each part
      type('ArrowRight');
      expect(where()).toBe('City, field');
      focused().setSelectionRange(4, 4);
      type('ArrowRight');
      expect(where()).toBe('City, operator');
      focused().setSelectionRange(1, 1);
      type('ArrowRight');
      expect(where()).toBe('City, value');
      focused().setSelectionRange(3, 3);
      type('ArrowRight');
      expect(focused()).toBe(box());

      // nothing was changed on the way
      await settle();
      expect(tokens()).toEqual(['Name is ada', 'City is nyc']);
    });

    describe('with a pickable operator (searchTypeChangeable)', () => {
      beforeEach(() => mount({ searchConfig: { changeDebounce: 5, searchTypeChangeable: true } }));

      it('opens on the operator list with the default highlighted', () => {
        box().focus();
        type('name', 'Enter');

        expect(focused().getAttribute('aria-label')).toBe('Name, operator');
        expect(optionLabels()).toEqual(['=', '!=', 'contains', '>', '>=', '<', '<=']);
        expect(highlighted()).toBe('contains');
      });

      it('takes an operator typed as a symbol, then the value', async () => {
        box().focus();
        type('name', 'Enter', '=', 'Ada', 'Enter');
        await settle();

        expect(tokens()).toEqual(['Name is Ada']);
        expect(instance.searchFields()).toEqual([
          { key: 'name', value: 'Ada', searchType: 'equals' },
        ]);
      });

      it('a value typed straight past the list keeps the default operator — even one starting like an operator word', async () => {
        box().focus();
        type('city', 'Enter', 'chi', 'Enter');
        await settle();

        // "c" could have been the start of `contains`; "h" settles it as text
        expect(tokens()).toEqual(['City contains chi']);
        expect(instance.searchFields()).toEqual([
          { key: 'city', value: 'chi', searchType: 'like' },
        ]);
      });

      it("clicking a token's operator changes it and keeps the value", async () => {
        box().focus();
        type('name', 'Enter', 'Ada', 'Enter');
        await settle();

        click(host.querySelector('button[aria-label="Change the operator of Name contains Ada"]')!);
        expect(highlighted()).toBe('contains');
        type('ArrowUp', 'Enter', 'Enter');
        await settle();

        expect(tokens()).toEqual(['Name is not Ada']);
        expect(instance.searchFields()[0].searchType).toBe('notEquals');
      });

      it('Backspace peels a token: its value, then the operator, then the token', async () => {
        box().focus();
        type('name', 'Enter', '=', 'ab', 'Enter');
        await settle();

        type('Backspace');
        expect(focused().getAttribute('aria-label')).toBe('Name, value');
        expect(focused().value).toBe('ab');

        type('Backspace', 'Backspace', 'Backspace');
        expect(focused().getAttribute('aria-label')).toBe('Name, operator');
        expect(tokens()).toEqual(['Name is']);

        type('Backspace');
        await settle();
        expect(tokens()).toEqual([]);
        expect(focused()).toBe(box());
      });
    });
  });

  describe('free text', () => {
    beforeEach(() => mount());

    it('one Enter turns it into a pill and searches', async () => {
      box().focus();
      type('nyc', 'Enter');
      await settle();

      expect(tokens()).toEqual(['Text: nyc']);
      expect(box().value).toBe('');
      expect(instance.searchFields()).toEqual([
        { key: undefined, value: 'nyc', searchType: 'like' },
      ]);
      await vi.waitFor(() => expect(names()).toEqual(['Ada', 'Alan']));
    });

    it('comes first in searchFields, ahead of column tokens', async () => {
      box().focus();
      type('name', 'Enter', 'a', 'Enter', 'nyc', 'Enter');
      await settle();

      expect(instance.searchFields()).toEqual([
        { key: undefined, value: 'nyc', searchType: 'like' },
        { key: 'name', value: 'a', searchType: 'like' },
      ]);
    });

    it('is searched as typed only while it could not be a field’s name', async () => {
      box().focus();
      type('ci'); // City
      await settle();
      expect(instance.searchFields()[0].value).toBe('');

      type('x'); // no field contains "cix"
      await settle();
      expect(instance.searchFields()[0].value).toBe('cix');
    });

    it('left in the box when focus leaves, it is searched whatever it reads as', async () => {
      box().focus();
      type('ci');
      box().blur();
      await settle();

      expect(instance.searchFields()[0].value).toBe('ci');
    });

    it('`field:` picks the highlighted field', () => {
      box().focus();
      type('cit', ':');
      expect(tokens()).toEqual(['City contains']);
      expect(focused().getAttribute('aria-label')).toBe('City, value');
    });

    it('Backspace in the empty box reopens the last pill for editing', async () => {
      box().focus();
      type('nyc', 'Enter');
      await settle();

      type('Backspace');
      expect(focused().getAttribute('aria-label')).toBe('Search text');
      expect(focused().value).toBe('nyc');
    });
  });

  describe("searchTrigger: 'manual'", () => {
    beforeEach(() => mount({ searchConfig: { changeDebounce: 5, searchTrigger: 'manual' } }));

    it('applies nothing until Enter in the empty box', async () => {
      box().focus();
      type('dep', 'Enter', 'sal', 'Enter', 'name', 'Enter', 'a', 'Escape');
      await settle();

      expect(tokens()).toEqual(['Department is Sales', 'Name contains a']);
      expect(instance.filters()).toEqual({});
      expect(instance.searchFields()[0].value).toBe('');

      type('Enter');
      await settle();
      expect(instance.filters()).toEqual({ department: 'Sales', active: null });
      expect(instance.searchFields()).toEqual([{ key: 'name', value: 'a', searchType: 'like' }]);
    });

    it('the search button applies too — and Clear applies at once', async () => {
      box().focus();
      type('dep', 'Enter', 'sal', 'Enter');
      await settle();
      expect(instance.filters()).toEqual({});

      host.querySelector<HTMLButtonElement>('button[aria-label="Search"]')!.click();
      await settle();
      expect(instance.filters()['department']).toBe('Sales');

      click(host.querySelector('button[aria-label="Clear search"]')!);
      await settle();
      expect(instance.filters()).toEqual({});
    });

    it('still shows a dependent filter before anything is applied', async () => {
      box().focus();
      type('dep', 'Enter', 'sal', 'Enter');
      await settle();
      expect(optionLabels()).toContain('Active');
    });
  });

  describe('filters of other kinds', () => {
    it('holds several values for a multiple select: the list stays open and checks the picked ones', async () => {
      await mount({
        gridFilters: [
          {
            type: FieldType.select,
            key: 'city',
            multiple: true,
            options: [
              { label: 'NYC', value: 'NYC' },
              { label: 'Chicago', value: 'Chicago' },
              { label: 'Austin', value: 'Austin' },
            ],
          },
        ],
        filterConfig: { filterOperators: { city: 'in' } },
        columns: ['id', 'name'],
      });
      box().focus();
      type('city', 'Enter');
      expect(listbox()!.getAttribute('aria-multiselectable')).toBe('true');

      type('Enter', 'ArrowDown', 'ArrowDown', 'Enter');
      await settle();
      expect(listbox()).not.toBeNull();
      expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual([
        'true',
        'false',
        'true',
      ]);

      type('Escape', 'Escape');
      await settle();
      expect(tokens()).toEqual(['City is one of NYC, Austin']);
      expect(instance.filters()).toEqual({ city: ['NYC', 'Austin'] });
      await vi.waitFor(() => expect(names()).toEqual(['Ada', 'Alan', 'Edsger']));
    });

    it('types a text filter into its control as it is typed, numbers as numbers', async () => {
      await mount({
        gridFilters: [{ type: FieldType.input, key: 'id', inputType: 'integer' }],
        columns: ['id', 'name'],
      });
      box().focus();
      type('id', 'Enter', '3');
      await settle();

      expect(instance.filters()).toEqual({ id: 3 });
      await vi.waitFor(() => expect(names()).toEqual(['Alan']));
    });

    it('takes a date filter through a native date input, and holds a Date like the date picker does', async () => {
      await mount({
        gridFilters: [{ type: FieldType.date, key: 'joined' }],
        columns: ['id', 'name'],
      });
      box().focus();
      type('joined', 'Enter');
      expect(focused().type).toBe('date');
      expect(focused().getAttribute('role')).toBeNull(); // typed into, not picked: no list

      focused().value = '2024-03-05';
      focused().dispatchEvent(new Event('input', { bubbles: true }));
      type('Enter');
      await settle();

      const held = instance.filters()['joined'] as Date;
      expect(held).toBeInstanceOf(Date);
      expect([held.getFullYear(), held.getMonth(), held.getDate()]).toEqual([2024, 2, 5]);
      expect(tokens()[0]).toMatch(/^Joined is .*2024/);

      // reopened, the input shows the same day again
      click(host.querySelector('button[aria-label^="Change the value of Joined"]')!);
      expect(focused().value).toBe('2024-03-05');
    });

    it('applies the filters’ own initial values, as its first tokens', async () => {
      await mount({
        gridFilters: [
          {
            type: FieldType.select,
            key: 'department',
            value: 'Support',
            options: [
              { label: 'Sales', value: 'Sales' },
              { label: 'Support', value: 'Support' },
            ],
          },
        ],
      });
      await settle();

      expect(tokens()).toEqual(['Department is Support']);
      expect(instance.filters()).toEqual({ department: 'Support' });
    });

    it('flags a filter its validators refuse, and applies none of them', async () => {
      await mount({
        gridFilters: [
          { type: FieldType.input, key: 'code', validations: [VALIDATOR_REQUIRED] },
          {
            type: FieldType.select,
            key: 'department',
            options: [{ label: 'Sales', value: 'Sales' }],
          },
        ],
      });
      box().focus();
      type('dep', 'Enter', 'Enter');
      await settle();

      expect(tokens()).toEqual(['Department is Sales']);
      expect(instance.filters()).toEqual({});
      expect(host.querySelector('[role="alert"]')!.textContent).toContain('Code');
    });

    it('without search, offers filters only and searches no text', async () => {
      await mount({}, false);
      box().focus();
      fixture.detectChanges();

      expect(box().placeholder).toBe('Filter…');
      expect(optionLabels()).toEqual(['Department']);

      type('zzz', 'Enter');
      await settle();
      expect(tokens()).toEqual([]);
      expect(instance.searchFields()[0].value).toBe('');
    });
  });

  describe('following the engine', () => {
    beforeEach(() => mount());

    it('shows a search set from code as tokens', async () => {
      instance.setSearchFields([
        { key: undefined, value: 'nyc', searchType: 'like' },
        { key: 'name', value: 'ada', searchType: 'like' },
      ]);
      await settle();
      expect(tokens()).toEqual(['Text: nyc', 'Name contains ada']);
    });

    it('shows filters set from code, and drops their tokens on clearFilters()', async () => {
      instance.setFilters({ department: 'Sales' });
      await settle();
      expect(tokens()).toEqual(['Department is Sales']);

      instance.clearFilters();
      await settle();
      expect(tokens()).toEqual([]);
    });

    it('leaves a search of its own alone', async () => {
      box().focus();
      type('name', 'Enter', 'ada', 'Enter');
      await settle();
      const [token] = Array.from(host.querySelectorAll('grid-search-token'));

      await settle(30);
      // the same element: not torn down and rebuilt from what the engine echoed back
      expect(host.querySelector('grid-search-token')).toBe(token);
    });
  });

  it("takes its placeholder, and the input's name, from searchPlaceholder", async () => {
    await mount({ searchConfig: { searchPlaceholder: 'Find people…' } });
    expect(box().placeholder).toBe('Find people…');
    expect(box().getAttribute('aria-label')).toBe('Find people');

    // GitLab's: the placeholder goes once the bar holds something
    box().focus();
    type('nyc', 'Enter');
    await settle();
    expect(box().placeholder).toBe('');
  });

  it('names every part for assistive technology', async () => {
    await mount({ searchConfig: { changeDebounce: 5, searchTypeChangeable: true } });
    box().focus();
    type('dep', 'Enter', 'sal', 'Enter', 'name', 'Enter', 'ada', 'Enter', 'nyc', 'Enter');
    await settle();

    const groups = Array.from(host.querySelectorAll('grid-search-token'));
    expect(groups.map((g) => g.getAttribute('role'))).toEqual(['group', 'group', 'group']);
    expect(tokens()).toEqual(['Department is Sales', 'Name contains ada', 'Text: nyc']);

    const buttons = Array.from(host.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(buttons).toEqual([
      'Change the field of Department is Sales',
      'Change the value of Department is Sales',
      'Remove Department is Sales',
      'Change the field of Name contains ada',
      'Change the operator of Name contains ada',
      'Change the value of Name contains ada',
      'Remove Name contains ada',
      'Change the text nyc',
      'Remove Text: nyc',
      'Clear search',
      'Search',
    ]);
    // the parts are reached with the arrow keys and by pointer; Tab stops at the remove buttons
    expect(
      Array.from(host.querySelectorAll('button'))
        .filter((b) => b.tabIndex === 0)
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'Remove Department is Sales',
      'Remove Name contains ada',
      'Remove Text: nyc',
      'Clear search',
      'Search',
    ]);
  });
});

describe('GridToolbarComponent — unifiedSearch', () => {
  let engine: GridEngineService;
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GridToolbarComponent] });
    engine = TestBed.inject(GridEngineService);
    injector = TestBed.inject(Injector);
  });

  async function mount(
    source: ReturnType<typeof signal<GridParameter<Row>>>,
    showSearch = true,
  ): Promise<{
    fixture: ComponentFixture<GridToolbarComponent<Row>>;
    instance: GridInstance<Row>;
  }> {
    const instance = engine.build(source, injector);
    const fixture = TestBed.createComponent(GridToolbarComponent<Row>);
    fixture.componentRef.setInput('instance', instance);
    fixture.componentRef.setInput('showSearch', showSearch);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, instance };
  }

  const shown = (
    fixture: ComponentFixture<unknown>,
  ): { bar: number; fields: number; panel: number; filterButton: number } => {
    const host = fixture.nativeElement as HTMLElement;
    return {
      bar: host.querySelectorAll('grid-search-bar').length,
      fields: host.querySelectorAll('grid-search-fields').length,
      panel: host.querySelectorAll('grid-filter-panel').length,
      filterButton: host.querySelectorAll('button[aria-label="Filters"]').length,
    };
  };

  it('shows the one bar by default, in place of the search fields and the filter panel', async () => {
    const { fixture } = await mount(signal(params()));
    expect(shown(fixture)).toEqual({ bar: 1, fields: 0, panel: 0, filterButton: 0 });
  });

  it('unifiedSearch: false shows the classic pair', async () => {
    const { fixture } = await mount(signal(params({ unifiedSearch: false })));
    expect(shown(fixture)).toEqual({ bar: 0, fields: 1, panel: 0, filterButton: 1 });
  });

  it('shows the bar for filters alone when search is hidden, and nothing when there is neither', async () => {
    const filtersOnly = await mount(signal(params()), false);
    expect(shown(filtersOnly.fixture).bar).toBe(1);

    const neither = await mount(signal(params({ gridFilters: undefined })), false);
    expect(shown(neither.fixture).bar).toBe(0);
  });

  it('switching view at runtime clears search and filters', async () => {
    const source = signal(params());
    const { fixture, instance } = await mount(source);
    instance.setSearchFields([{ key: 'name', value: 'ada', searchType: 'like' }]);
    instance.setFilters({ department: 'Sales' });
    fixture.detectChanges();
    await fixture.whenStable();

    source.set({ ...source(), unifiedSearch: false });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(shown(fixture).bar).toBe(0);
    expect(instance.filters()).toEqual({});
    expect(instance.searchFields()).toEqual([{ key: 'name', value: '', searchType: 'like' }]);
  });

  it('combines search entries with AND under the bar and OR under the classic fields', async () => {
    const both = [
      { key: 'name', value: 'ada', searchType: 'like' as const },
      { key: 'city', value: 'chicago', searchType: 'like' as const },
    ];
    const unified = engine.build(signal(params()), injector);
    unified.setSearchFields(both);
    await vi.waitFor(() => expect(unified.rows()).toEqual([]));

    const classic = engine.build(signal(params({ unifiedSearch: false })), injector);
    classic.setSearchFields(both);
    await vi.waitFor(() => expect(classic.rows().map((r) => r.name)).toEqual(['Ada', 'Grace']));

    const forced = engine.build(
      signal(params({ searchConfig: { searchCombination: 'or' } })),
      injector,
    );
    forced.setSearchFields(both);
    await vi.waitFor(() => expect(forced.rows().map((r) => r.name)).toEqual(['Ada', 'Grace']));
  });
});
