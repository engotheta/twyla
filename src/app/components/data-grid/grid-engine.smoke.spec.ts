import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GridEngineService } from './grid-engine.service';
import { GridParameter } from './interfaces/grid-parameter.interface';
import { GridColumn_ } from './interfaces/grid-column.interface';
import { getCellValue } from './helpers/grid-row.helpers';
import { GridCellComponent } from './grid-cell/grid-cell.component';
import { DataGridComponent } from './data-grid.component';

interface Row {
  id: number;
  name: string;
}

describe('GridEngineService (parameter reactivity)', () => {
  let engine: GridEngineService;
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(GridEngineService);
    injector = TestBed.inject(Injector);
  });

  // `rows()` flows through a `toObservable`/`switchMap`/`toSignal` pipeline (grid-engine.service.ts's
  // `rawData`) — its first (and every subsequent) value lands via a microtask, same as
  // generic-form's own Dynamic-prop resolution (see generic-form.smoke.spec.ts's `await
  // Promise.resolve()` pairs). `vi.waitFor` polls instead of guessing an exact tick count.

  it('picks up a genuinely new `columns`/`gridData` on the next parameter() emission', async () => {
    const params = signal<GridParameter<Row>>({
      columns: ['id', 'name'],
      gridData: [{ id: 1, name: 'Ada' }],
    });
    const instance = engine.build(params, injector);

    await vi.waitFor(() => expect(instance.rows()).toEqual([{ id: 1, name: 'Ada' }]));
    expect(instance.leafColumns().map((c) => c.key)).toEqual(['id', 'name']);

    params.set({
      columns: ['id', 'name', 'role'],
      gridData: [
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Grace' } as Row,
      ],
    });

    await vi.waitFor(() =>
      expect(instance.rows()).toEqual([
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Grace' },
      ]),
    );
    expect(instance.leafColumns().map((c) => c.key)).toEqual(['id', 'name', 'role']);
  });

  it('does NOT reset page/selection/sort just because parameter() re-emits an unrelated change', async () => {
    const params = signal<GridParameter<Row>>({
      columns: ['id', 'name'],
      gridData: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` })),
      size: 5,
      selectionMode: 'multiple',
    });
    const instance = engine.build(params, injector);
    await vi.waitFor(() => expect(instance.rows().length).toBe(5));

    // setSort() itself resets page to 1 (a new sort order invalidates "page 2"'s meaning) — so
    // it must run BEFORE the deliberate setPage(2) below, or it would clobber it and this
    // test would trivially pass for the wrong reason.
    instance.setSort({ key: 'name', direction: 'desc' });
    instance.setPage(2);
    instance.toggleSelect(instance.rows()[0]);

    // same gridData/columns identity, just a new object with an unrelated field changed —
    // the exact shape field-group's tabularGridParameter() produces on every CD cycle
    params.set({ ...params(), label: 'Employees' });

    // give the (intentionally NOT-installed) reactive path a chance to have fired, if it were
    // ever going to — then assert the runtime state is still exactly what we set
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(instance.page()).toBe(2);
    expect(instance.sort()).toEqual({ key: 'name', direction: 'desc' });
    expect(instance.selected().length).toBe(1);
  });

  it('resets page/manual order once gridData genuinely changes identity', async () => {
    const pageOneData = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));
    const params = signal<GridParameter<Row>>({ columns: ['id', 'name'], gridData: pageOneData, size: 5 });
    const instance = engine.build(params, injector);
    await vi.waitFor(() => expect(instance.rows().length).toBe(5));

    instance.setPage(3);
    expect(instance.page()).toBe(3);

    params.set({ ...params(), gridData: [{ id: 1, name: 'Only row now' }] });

    await vi.waitFor(() => expect(instance.page()).toBe(1));
  });

  it('a gridOptions slug swap updates rowButtons/selectionMode-dependent rendering consistently', () => {
    const params = signal<GridParameter<Row>>({
      columns: ['id', 'name'],
      gridData: [{ id: 1, name: 'Ada' }],
      gridOptions: [
        { slug: 'plain' },
        {
          slug: 'selectable',
          selectionMode: 'multiple',
          rowButtons: [{ label: 'View', click: () => undefined }],
        },
      ],
    });
    const instance = engine.build(params, injector);

    expect(instance.params().selectionMode).toBeUndefined();
    expect(instance.params().rowButtons).toBeUndefined();
    expect(instance.visibleColumns().some((c) => c.key === '__grid_select__')).toBe(false);

    instance.selectOption('selectable');

    expect(instance.params().selectionMode).toBe('multiple');
    expect(instance.params().rowButtons?.length).toBe(1);
    expect(instance.visibleColumns().some((c) => c.key === '__grid_select__')).toBe(true);
    expect(instance.visibleColumns().some((c) => c.key === '__grid_actions__')).toBe(true);
  });

  describe('canAddColumns / addColumnsFromData', () => {
    interface RichRow {
      id: number;
      name: string;
      address: { city: string; zip: string };
    }

    it('appends columns discovered from the data, starting hidden', async () => {
      const params = signal<GridParameter<RichRow>>({
        columns: ['id'],
        canAddColumns: true,
        gridData: [
          { id: 1, name: 'Ada', address: { city: 'NYC', zip: '10001' } },
          { id: 2, name: 'Grace', address: { city: 'LA', zip: '90001' } },
        ],
      });
      const instance = engine.build(params, injector);
      await vi.waitFor(() => expect(instance.rows().length).toBe(2));

      expect(instance.leafColumns().map((c) => c.key)).toEqual(['id']);

      await instance.addColumnsFromData();

      const keys = instance.leafColumns().map((c) => c.key);
      expect(keys).toContain('name');
      expect(keys).toContain('address.city');
      expect(keys).toContain('address.zip');

      const nameState = instance.columnState().find((s) => s.key === 'name');
      expect(nameState?.visible).toBe(false); // starts unchecked

      // 'id' is already declared — must not be re-discovered/duplicated
      expect(keys.filter((k) => k === 'id').length).toBe(1);
    });

    it('does nothing when there is nothing new to discover', async () => {
      const params = signal<GridParameter<Row>>({
        columns: ['id', 'name'],
        canAddColumns: true,
        gridData: [{ id: 1, name: 'Ada' }],
      });
      const instance = engine.build(params, injector);
      await vi.waitFor(() => expect(instance.rows().length).toBe(1));

      await instance.addColumnsFromData();
      expect(instance.leafColumns().map((c) => c.key)).toEqual(['id', 'name']);
    });

    it('drops previously-discovered columns once gridData genuinely changes identity', async () => {
      const params = signal<GridParameter<RichRow>>({
        columns: ['id'],
        canAddColumns: true,
        gridData: [{ id: 1, name: 'Ada', address: { city: 'NYC', zip: '10001' } }],
      });
      const instance = engine.build(params, injector);
      await vi.waitFor(() => expect(instance.rows().length).toBe(1));

      await instance.addColumnsFromData();
      expect(instance.leafColumns().map((c) => c.key)).toContain('name');

      // a fundamentally different dataset — mirrors the existing page/manualRowOrder reset test
      params.set({ ...params(), gridData: [{ id: 9, name: 'Only row now' } as unknown as RichRow] });

      await vi.waitFor(() =>
        expect(instance.leafColumns().map((c) => c.key)).not.toContain('name'),
      );
    });
  });
});

describe('getCellValue (helpers/grid-row.helpers)', () => {
  it('uses column.valueFn when present', () => {
    const column: GridColumn_<{ first: string; last: string }> = {
      key: 'full',
      valueFn: (row) => `${row.first} ${row.last}`,
    };
    expect(getCellValue({ first: 'Ada', last: 'Lovelace' }, column)).toBe('Ada Lovelace');
  });

  it('falls back to the path when no valueFn is set', () => {
    const column: GridColumn_<{ name: string }> = { key: 'name' };
    expect(getCellValue({ name: 'Grace' }, column)).toBe('Grace');
  });
});

describe('GridCellComponent — column buttons', () => {
  let engine: GridEngineService;
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GridCellComponent] });
    engine = TestBed.inject(GridEngineService);
    injector = TestBed.inject(Injector);
  });

  it('renders column.buttons in the body cell, passing the ROW as data', async () => {
    const clicked: Row[] = [];
    const column: GridColumn_<Row> = {
      key: 'name',
      buttons: [{ label: 'View', click: (row) => clicked.push(row as Row) }],
    };
    const params = signal<GridParameter<Row>>({
      columns: [column],
      gridData: [{ id: 1, name: 'Ada' }],
    });
    const instance = engine.build(params, injector);
    await vi.waitFor(() => expect(instance.rows().length).toBe(1));

    const fixture = TestBed.createComponent(GridCellComponent<Row>);
    fixture.componentRef.setInput('instance', instance);
    fixture.componentRef.setInput('column', column);
    fixture.componentRef.setInput('row', instance.rows()[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const btn = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(clicked).toEqual([{ id: 1, name: 'Ada' }]);
  });

  it("a _cellsProps override's buttons wins over the column's", async () => {
    const column: GridColumn_<Row> = {
      key: 'name',
      buttons: [{ label: 'Column button' }],
    };
    const rowWithOverride = {
      id: 1,
      name: 'Ada',
      _cellsProps: { name: { buttons: [{ label: 'Override button' }] } },
    };
    const params = signal<GridParameter<Row>>({ columns: [column], gridData: [rowWithOverride] });
    const instance = engine.build(params, injector);
    await vi.waitFor(() => expect(instance.rows().length).toBe(1));

    const fixture = TestBed.createComponent(GridCellComponent<Row>);
    fixture.componentRef.setInput('instance', instance);
    fixture.componentRef.setInput('column', column);
    fixture.componentRef.setInput('row', instance.rows()[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Override button');
    expect(text).not.toContain('Column button');
  });
});

describe('DataGridComponent — headerButtons', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DataGridComponent] });
  });

  it("renders column.headerButtons in the header cell, passing the grid's GridState as data", async () => {
    const seenPages: (number | undefined)[] = [];
    const params: GridParameter<Row> = {
      columns: [
        {
          key: 'name',
          headerButtons: [
            { label: 'Refresh', click: (state) => seenPages.push(state?.gridData?.page) },
          ],
        },
      ],
      gridData: [{ id: 1, name: 'Ada' }],
    };

    const fixture = TestBed.createComponent(DataGridComponent<Row>);
    fixture.componentRef.setInput('parameter', params);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const btn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('th button')).find(
      (b) => b.textContent?.includes('Refresh'),
    );
    expect(btn).toBeTruthy();
    btn?.dispatchEvent(new Event('click', { bubbles: true }));

    expect(seenPages).toEqual([1]); // GridState.gridData.page, not the column
  });
});
