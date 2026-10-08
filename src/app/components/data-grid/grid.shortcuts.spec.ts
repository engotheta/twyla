import { ANIMATION_MODULE_TYPE, computed, Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldType } from '@components/generic-form';
import { Shortcut } from '@services/shortcuts/shortcuts.interface';
import { ShortcutsService } from '@services/shortcuts/shortcuts.service';
import { DataGridComponent } from './data-grid.component';
import { GridEngineService, GridInstance } from './grid-engine.service';
import { GRID_EN } from './grid.messages';
import { gridShortcuts } from './grid.shortcuts';
import { GridParameter } from './interfaces/grid-parameter.interface';

interface Row {
  id: number;
  name: string;
}

const ROWS: Row[] = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));

describe('GridInstance.override', () => {
  let instance: GridInstance<Row>;
  const params = signal<GridParameter<Row>>({ columns: ['id', 'name'], gridData: ROWS, size: 5 });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    instance = TestBed.inject(GridEngineService).build(params, TestBed.inject(Injector));
  });

  it('lays a patch over the params, and nothing while there is none', () => {
    expect(instance.params()).toBe(params());

    instance.override({ showPaginator: false, mergeCells: true });

    expect(instance.params()).toMatchObject({ showPaginator: false, mergeCells: true, size: 5 });
    expect(instance.overrides()).toEqual({ showPaginator: false, mergeCells: true });
    expect(params().showPaginator).toBeUndefined();
  });

  it('gives a key back to the params when it is overridden with undefined', () => {
    instance.override({ showPaginator: false, mergeCells: true });
    instance.override({ showPaginator: undefined });

    expect(instance.overrides()).toEqual({ mergeCells: true });
    expect(instance.params().showPaginator).toBeUndefined();
  });

  it('resets to the params as they were configured', () => {
    instance.override({ addIndexColumn: false });
    expect(instance.visibleColumns().map((column) => column.key)).toEqual(['id', 'name']);

    instance.resetOverrides();
    expect(instance.params()).toBe(params());
    expect(instance.visibleColumns()).toHaveLength(3);
  });

  it('wins over the selected grid option', () => {
    const optioned = signal<GridParameter<Row>>({
      gridData: ROWS,
      gridOptions: [{ slug: 'wide', size: 50 }],
    });
    const withOptions = TestBed.inject(GridEngineService).build(optioned, TestBed.inject(Injector));
    expect(withOptions.params().size).toBe(50);

    withOptions.override({ size: 3 });
    expect(withOptions.params().size).toBe(3);
  });
});

describe('gridShortcuts', () => {
  let instance: GridInstance<Row>;
  let shortcuts: Shortcut[];
  const viewDetails = vi.fn();

  /** (a test may build more than one grid: nothing here configures the test module) */
  function build(params: GridParameter<Row>): void {
    instance = TestBed.inject(GridEngineService).build(signal(params), TestBed.inject(Injector));
    // as `DataGridComponent` works them out: what the params say, else what the grid needs
    const shown = (param: 'showToolbar' | 'showSearch' | 'showPaginator') =>
      computed(() => instance.params()[param] ?? true);
    shortcuts = gridShortcuts<Row>(
      {
        instance: () => instance,
        showToolbar: shown('showToolbar'),
        showSearch: shown('showSearch'),
        showPaginator: shown('showPaginator'),
        canViewDetails: () => true,
        viewDetails,
      },
      signal(GRID_EN),
    );
  }

  const shortcut = (id: string) => shortcuts.find((one) => one.id === id)!;

  it('switches a part of the grid off and on, starting from what the grid shows', () => {
    build({ gridData: ROWS });
    const paginator = shortcut('paginator');
    expect(paginator.on?.()).toBe(true);

    paginator.run();
    expect(instance.params().showPaginator).toBe(false);
    expect(paginator.on?.()).toBe(false);

    paginator.run();
    expect(instance.params().showPaginator).toBe(true);
  });

  it('knows which features are on unless told off, and which are off unless told on', () => {
    build({ gridData: ROWS });
    expect(shortcut('indexColumn').on?.()).toBe(true);
    expect(shortcut('columnSettings').on?.()).toBe(true);
    expect(shortcut('unifiedSearch').on?.()).toBe(true);
    expect(shortcut('mergeCells').on?.()).toBe(false);
    expect(shortcut('addColumns').on?.()).toBe(false);

    shortcut('indexColumn').run();
    shortcut('mergeCells').run();
    expect(instance.params()).toMatchObject({ addIndexColumn: false, mergeCells: true });
  });

  it('steps row selection through off, one row, several rows', () => {
    build({ gridData: ROWS });
    const selection = shortcut('selection');
    expect(selection.state?.()).toBe('Off');

    selection.run();
    expect(instance.params().selectionMode).toBe('single');
    expect(selection.state?.()).toBe('One row');

    selection.run();
    selection.run();
    expect(instance.params().selectionMode).toBe('none');
  });

  it('steps the view through the modes the grid has, or all three when it names none', () => {
    build({ gridData: ROWS });
    const view = shortcut('view');
    expect(view.state?.()).toBe('Table');
    view.run();
    expect(instance.renderMode()).toBe('list');

    build({ gridData: ROWS, renderMode: { modes: ['table'] } });
    expect(shortcut('view').available?.()).toBe(false);
  });

  it('offers every export format on a grid that has none, and takes them away again', () => {
    build({ gridData: ROWS });
    const exporting = shortcut('export');
    expect(exporting.on?.()).toBe(false);

    exporting.run();
    expect(instance.params().export?.formats).toEqual(['csv', 'excel', 'pdf']);

    exporting.run();
    expect(instance.overrides()).toEqual({});
  });

  it('hides the export of a grid that has one, keeping the rest of its export config', () => {
    build({ gridData: ROWS, export: { formats: ['pdf'], fileName: 'rows' } });
    const exporting = shortcut('export');
    expect(exporting.on?.()).toBe(true);

    exporting.run();
    expect(instance.params().export).toEqual({ formats: [], fileName: 'rows' });

    exporting.run();
    expect(instance.params().export).toEqual({ formats: ['pdf'], fileName: 'rows' });
  });

  it('hides the filters of a grid that has some, and is not offered on one that has none', () => {
    build({ gridData: ROWS });
    expect(shortcut('filters').available?.()).toBe(false);

    build({ gridData: ROWS, gridFilters: [{ type: FieldType.input, key: 'name' }] });
    const filters = shortcut('filters');
    expect(filters.available?.()).toBe(true);

    filters.run();
    expect(instance.params().gridFilters).toEqual([]);
    expect(filters.available?.()).toBe(true);

    filters.run();
    expect(instance.params().gridFilters).toHaveLength(1);
  });

  it('goes back to the grid as it was set up, once something was switched', () => {
    build({ gridData: ROWS });
    const reset = shortcut('reset');
    expect(reset.available?.()).toBe(false);

    shortcut('paginator').run();
    shortcut('mergeCells').run();
    expect(reset.available?.()).toBe(true);

    reset.run();
    expect(instance.overrides()).toEqual({});
  });

  it('opens the details of the row last clicked, closing the hint for it', () => {
    build({ gridData: ROWS });
    shortcut('rowDetails').run();
    expect(viewDetails).toHaveBeenCalled();
    expect(shortcut('rowDetails').dismiss).toBe(true);
  });
});

describe('the data grid answers its shortcuts', () => {
  let fixture: ComponentFixture<DataGridComponent<Row>>;
  let service: ShortcutsService;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function mount(params: GridParameter<Row>): Promise<void> {
    TestBed.configureTestingModule({
      imports: [DataGridComponent],
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
    service = TestBed.inject(ShortcutsService);
    fixture = TestBed.createComponent(DataGridComponent<Row>);
    fixture.componentRef.setInput('params', params);
    await settle();
  }

  const press = (key: string): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  const arm = (): void => {
    for (let i = 0; i < service.presses; i++) press('g');
  };
  const paginator = () => (fixture.nativeElement as HTMLElement).querySelector('mat-paginator');

  afterEach(() => service.close());

  it('G, six times, arms it under its own label; P then hides the paginator, and 0 brings it back', async () => {
    await mount({ label: 'Employees', columns: ['id', 'name'], gridData: ROWS, size: 5 });
    await vi.waitFor(() => expect(paginator()).toBeTruthy());

    arm();
    expect(service.hint()).toMatchObject({ title: 'Data grid: Employees', key: 'g' });
    expect((fixture.nativeElement as HTMLElement).hasAttribute('data-shortcut-target')).toBe(true);

    press('p');
    await settle();
    expect(paginator()).toBeNull();

    press('0');
    await settle();
    expect(paginator()).toBeTruthy();
  });

  it('stays as configured when its params say `shortcuts: false`', async () => {
    await mount({ columns: ['id', 'name'], gridData: ROWS, size: 5, shortcuts: false });
    arm();
    expect(service.hint()).toBeNull();
  });
});
