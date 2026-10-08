import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { FormInstance } from '../../form-engine.service';
import { GenericFormComponent } from '../../generic-form.component';
import { observe } from '../../interfaces/dynamic.interface';
import { FieldType } from '../../interfaces/field-type.interface';
import { FormField } from '../../interfaces/form-field.interface';
import { OptionsParameter, OptionsRequest } from '../../interfaces/form-state.interface';

interface Person {
  id: number;
  name: string;
  team: string;
}

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', team: 'core' },
  { id: 2, name: 'Bo', team: 'core' },
  { id: 3, name: 'Cy', team: 'ops' },
  { id: 4, name: 'Di', team: 'ops' },
  { id: 5, name: 'Ed', team: 'ops' },
];

const MAPPING = { labelKey: 'name', valueKey: 'id' } as const;

/** the browser's observer, as far as the list's end sentinel uses it */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  see(): void {
    const entry = { isIntersecting: true } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
}

describe('SelectFieldComponent — options from a source', () => {
  let fixture: ComponentFixture<GenericFormComponent>;
  let announce: ReturnType<typeof vi.fn>;

  const host = () => fixture.nativeElement as HTMLElement;
  const instance = () =>
    (fixture.componentInstance as unknown as { instance: FormInstance }).instance;
  const control = (key: string) => instance().form.get(key)!;

  /** a moment for what was typed to be sent, then for what came back to render */
  async function settle(wait = 0): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function render(fields: FormField[], model?: Record<string, unknown>): Promise<void> {
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [GenericFormComponent],
      providers: [
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
    fixture = TestBed.createComponent(GenericFormComponent);
    fixture.componentRef.setInput('params', { fields, model });
    await settle();
  }

  const selects = () => Array.from(host().querySelectorAll<HTMLElement>('mat-select'));
  /** the label the closed select shows for its value */
  const shown = (index = 0) =>
    (selects()[index].querySelector('.mat-mdc-select-value-text')?.textContent ?? '').trim();

  async function open(index = 0): Promise<void> {
    selects()[index].querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    await settle();
  }

  /** a click outside the open list */
  async function close(): Promise<void> {
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await settle(20);
  }

  const options = () => Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
  /** what the open list shows: its options, without those kept mounted out of sight */
  const listed = () =>
    options()
      .filter((option) => !option.classList.contains('hidden!'))
      .map((option) => (option.textContent ?? '').trim());
  const searchBox = () =>
    document.querySelector<HTMLInputElement>('.cdk-overlay-container input[type="text"]');

  async function pick(label: string): Promise<void> {
    options()
      .find((option) => (option.textContent ?? '').trim() === label)!
      .click();
    await settle();
  }

  async function type(text: string): Promise<void> {
    const input = searchBox()!;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(20);
  }

  const requests = (fn: { mock: { calls: unknown[][] } }) =>
    fn.mock.calls.map(([request]) => request as OptionsRequest);

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows the options an API gave, mapped by labelKey and valueKey', async () => {
    const load = vi.fn(() => of(PEOPLE.slice(0, 3)));
    await render([
      {
        type: FieldType.select,
        key: 'person',
        optionsParameter: { ...MAPPING, optionsFunction: load },
      },
    ]);

    await open();
    expect(listed()).toEqual(['Ada', 'Bo', 'Cy']);

    await pick('Bo');
    expect(control('person').value).toBe(2);
    expect(shown()).toBe('Bo');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('says so while the options load, and when there are none', async () => {
    const answer = new Subject<Person[]>();
    await render([
      {
        type: FieldType.select,
        key: 'person',
        optionsParameter: { ...MAPPING, optionsFunction: () => answer },
      },
    ]);

    await open();
    expect(listed()).toEqual(['Loading options…']);

    answer.next([]);
    await settle();
    expect(listed()).toEqual(['No options found']);
    expect(options()[0].getAttribute('aria-disabled')).toBe('true');

    await pick('No options found'); // a row that says something is not a choice
    expect(control('person').value).toBeNull();
  });

  it('says the options could not be loaded, and asks again each time the list is opened', async () => {
    let fail = true;
    const load = vi.fn((): Observable<Person[]> =>
      fail ? throwError(() => new Error('offline')) : of(PEOPLE.slice(0, 2)),
    );
    await render([
      {
        type: FieldType.select,
        key: 'person',
        optionsParameter: { ...MAPPING, optionsFunction: load },
      },
    ]);
    expect(load).toHaveBeenCalledTimes(1);

    await open();
    expect(load).toHaveBeenCalledTimes(2);
    expect(listed()).toEqual(['The options could not be loaded']);

    await close();
    fail = false;
    await open();
    expect(listed()).toEqual(['Ada', 'Bo']);
  });

  describe('API filter (searchMode: server)', () => {
    const search = vi.fn((request: OptionsRequest) =>
      of(PEOPLE.filter((p) => p.name.toLowerCase().includes(request.search.toLowerCase()))),
    );
    const field = (): FormField => ({
      type: FieldType.select,
      key: 'person',
      optionsParameter: {
        ...MAPPING,
        optionsFunction: search,
        searchMode: 'server',
        searchDebounce: 0,
        filters: { active: true },
      },
    });

    // (a block: a function returned from a hook is run as its cleanup, and `mockClear()` returns
    // the mock)
    beforeEach(() => {
      search.mockClear();
    });

    it('has a search box without being told to, and sends what is typed to the API', async () => {
      await render([field()]);
      await open();
      expect(searchBox()).toBeTruthy();
      expect(listed()).toHaveLength(5);

      await type('d');

      expect(requests(search).map((request) => request.search)).toEqual(['', 'd']);
      expect(listed()).toEqual(['Ada', 'Di', 'Ed']);
    });

    it('sends the fixed filters with every request', async () => {
      await render([field()]);
      await open();
      await type('bo');

      expect(requests(search).map((request) => request.filters)).toEqual([
        { active: true },
        { active: true },
      ]);
    });

    it('announces what a search brought', async () => {
      await render([field()]);
      await open();
      expect(announce).not.toHaveBeenCalled();

      await type('bo');
      expect(announce).toHaveBeenCalledWith('1 options available', 'polite');

      await type('zz');
      expect(listed()).toEqual(['No options found']);
      expect(announce).toHaveBeenLastCalledWith('No options found', 'polite');
    });

    it('keeps showing the picked option’s label while another is searched for', async () => {
      await render([field()]);
      await open();
      await pick('Ada');
      expect(shown()).toBe('Ada');

      await open();
      await type('bo');

      expect(listed()).toEqual(['Bo']);
      expect(shown()).toBe('Ada');
      expect(control('person').value).toBe(1);
    });

    it('goes back to the whole list once the select is closed', async () => {
      await render([field()]);
      await open();
      await type('bo');

      await close();
      await open();

      expect(searchBox()!.value).toBe('');
      expect(listed()).toHaveLength(5);
    });
  });

  it('keeps what a multiple select holds when a search leaves it out of the list', async () => {
    await render([
      {
        type: FieldType.select,
        key: 'people',
        multiple: true,
        searchable: true,
        options: PEOPLE.slice(0, 3).map((p) => ({ label: p.name, value: p.id })),
      },
    ]);
    await open();
    await pick('Ada');

    await type('bo');
    expect(listed()).toEqual(['Bo']);
    await pick('Bo');

    expect(control('people').value).toEqual([1, 2]);
  });

  it('keeps a multiple select’s value in the order of the list, whatever was picked first', async () => {
    await render([
      {
        type: FieldType.select,
        key: 'people',
        multiple: true,
        searchable: true,
        options: PEOPLE.slice(0, 3).map((p) => ({ label: p.name, value: p.id })),
      },
    ]);
    await open();
    await pick('Cy');

    // Cy is searched away, and so kept mounted ahead of the list: Ada still comes first
    await type('ad');
    await pick('Ada');

    expect(control('people').value).toEqual([1, 3]);
  });

  describe('options fetched on a form event', () => {
    const byTeam = vi.fn((request: OptionsRequest) =>
      of(PEOPLE.filter((p) => p.team === request.filters['team'])),
    );
    const fields = (): FormField[] => [
      {
        type: FieldType.select,
        key: 'team',
        options: [
          { label: 'Core', value: 'core' },
          { label: 'Ops', value: 'ops' },
        ],
      },
      {
        type: FieldType.select,
        key: 'person',
        optionsParameter: observe('team', (team: string) => ({
          ...MAPPING,
          filters: { team },
          optionsFunction: byTeam,
        })),
      },
    ];

    beforeEach(() => {
      byTeam.mockClear();
    });

    it('fetches again, with the new value, when the field it depends on changes', async () => {
      await render(fields());
      expect(requests(byTeam).map((request) => request.filters)).toEqual([{ team: null }]);

      await open(0);
      await pick('Ops');

      expect(requests(byTeam).at(-1)!.filters).toEqual({ team: 'ops' });
      await open(1);
      expect(listed()).toEqual(['Cy', 'Di', 'Ed']);
    });

    it('hands the form to the function, as it is when the request is made', async () => {
      await render(fields(), { team: 'core' });

      expect(requests(byTeam).at(-1)!.formState.value).toMatchObject({ team: 'core' });
      await open(1);
      expect(listed()).toEqual(['Ada', 'Bo']);
    });

    it('takes an Observable from an options observer', async () => {
      await render([
        fields()[0],
        {
          type: FieldType.select,
          key: 'person',
          options: observe('team', (team: string) =>
            of(PEOPLE.filter((p) => p.team === team).map((p) => ({ label: p.name, value: p.id }))),
          ),
        },
      ]);
      control('team').setValue('core');
      await settle();

      await open(1);
      expect(listed()).toEqual(['Ada', 'Bo']);
    });
  });

  describe('paginated', () => {
    const paged = vi.fn((request: OptionsRequest) =>
      of({
        content: PEOPLE.slice((request.page - 1) * request.size, request.page * request.size),
        totalLength: PEOPLE.length,
      }),
    );
    const field = (extra: Partial<OptionsParameter<Person, number>> = {}): FormField => ({
      type: FieldType.select,
      key: 'person',
      optionsParameter: {
        ...MAPPING,
        optionsFunction: paged,
        paginated: true,
        pageSize: 2,
        ...extra,
      },
    });
    /** the list was scrolled to its end */
    async function reachEnd(): Promise<void> {
      FakeIntersectionObserver.instances.at(-1)!.see();
      await settle();
    }

    beforeEach(() => {
      paged.mockClear();
    });

    it('pulls the next page each time the end of the list is reached, until there is no more', async () => {
      await render([field()]);
      await open();
      expect(listed()).toEqual(['Ada', 'Bo']);

      await reachEnd();
      expect(listed()).toEqual(['Ada', 'Bo', 'Cy', 'Di']);

      await reachEnd();
      expect(listed()).toEqual(['Ada', 'Bo', 'Cy', 'Di', 'Ed']);
      expect(requests(paged).map((request) => request.page)).toEqual([1, 2, 3]);

      // nothing is left to watch for once the last page is in
      expect(document.querySelector('[scrollEnd]')).toBeNull();
    });

    it('announces how many options there are after a page', async () => {
      await render([field()]);
      await open();
      await reachEnd();
      expect(announce).toHaveBeenLastCalledWith('4 options available', 'polite');
    });

    it('shows a value from a page not loaded yet, by asking for its option', async () => {
      const selected = vi.fn((ids: number[]) => of(PEOPLE.filter((p) => ids.includes(p.id))));
      await render([field({ selectedFunction: selected })], { person: 5 });

      expect(selected).toHaveBeenCalledWith([5]);
      expect(shown()).toBe('Ed');

      await open();
      expect(listed()).toEqual(['Ed', 'Ada', 'Bo']); // what is selected comes first
    });

    it('shows such a value as it is when there is no way to ask', async () => {
      await render([field()], { person: 5 });
      expect(shown()).toBe('5');
    });

    it('asks for no more pages while the select itself is searching what it has', async () => {
      await render([{ ...field(), searchable: true } as FormField]);
      await open();
      expect(document.querySelector('[scrollEnd]')).not.toBeNull();

      await type('zz');

      expect(listed()).toEqual(['No options found']);
      expect(document.querySelector('[scrollEnd]')).toBeNull();
    });
  });

  describe('keys in the search box', () => {
    const fields = (): FormField[] => [
      {
        type: FieldType.select,
        key: 'person',
        searchable: true,
        options: PEOPLE.slice(0, 3).map((p) => ({ label: p.name, value: p.id })),
      },
    ];

    async function press(key: string, keyCode: number): Promise<KeyboardEvent> {
      const event = new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true });
      searchBox()!.dispatchEvent(event);
      await settle();
      return event;
    }

    it('hands the arrows and Enter to the list: Enter picks the option the arrows reached', async () => {
      await render(fields());
      await open();

      await press('ArrowDown', 40);
      await press('Enter', 13);

      expect(control('person').value).toBe(2);
      expect(options()).toHaveLength(0);
    });

    it('picks the first of what a search left when Enter follows the typing', async () => {
      await render(fields());
      await open();
      await type('c');

      await press('Enter', 13);

      expect(control('person').value).toBe(3);
    });

    it('takes a space, or a letter, for typing: nothing is picked', async () => {
      await render(fields());
      await open();

      await press(' ', 32);
      await press('b', 66);

      expect(control('person').value).toBeNull();
      expect(listed()).toEqual(['Ada', 'Bo', 'Cy']);
    });

    it('closes the list on Esc', async () => {
      await render(fields());
      await open();

      const event = await press('Escape', 27);

      expect(options()).toHaveLength(0);
      expect(event.defaultPrevented).toBe(true);
    });

    it('keeps the search box out of the listbox, which may hold options only', async () => {
      await render(fields());
      await open();
      const panel = document.querySelector('.mat-mdc-select-panel')!;
      const list = panel.querySelector('[role="listbox"]')!;

      // the options' own element is the listbox the select controls; the panel only holds things
      expect(panel.getAttribute('role')).toBe('presentation');
      expect(list.id).toBe(selects()[0].getAttribute('aria-controls'));
      expect(list.getAttribute('aria-labelledby')).toBeTruthy();
      expect(list.contains(searchBox())).toBe(false);
      expect(list.querySelectorAll('mat-option')).toHaveLength(3);
      expect(document.querySelectorAll(`#${list.id}`)).toHaveLength(1);
    });

    it('leaves Material’s panel the listbox where there is no search box', async () => {
      await render([{ ...fields()[0], searchable: false } as FormField]);
      await open();
      const panel = document.querySelector('.mat-mdc-select-panel')!;

      expect(panel.getAttribute('role')).toBe('listbox');
      expect(panel.querySelector('[role="listbox"]')).toBeNull();
      expect(panel.querySelectorAll('mat-option')).toHaveLength(3);
    });

    it('keeps every key from reaching the select a second time', async () => {
      await render(fields());
      await open();
      const reached = vi.fn();
      document.body.addEventListener('keydown', reached);

      await press('ArrowDown', 40);
      await press('a', 65);
      document.body.removeEventListener('keydown', reached);

      expect(reached).not.toHaveBeenCalled();
    });
  });
});
