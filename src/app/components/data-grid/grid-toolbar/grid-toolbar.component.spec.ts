import { Injector, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldType } from '@components/generic-form';
import { GridEngineService } from '../grid-engine.service';
import { GridParameter } from '../interfaces/grid-parameter.interface';
import { GridToolbarComponent } from './grid-toolbar.component';

interface Row {
  id: number;
  name: string;
}

const params = (over: Partial<GridParameter<Row>> = {}): GridParameter<Row> => ({
  columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
  ],
  gridData: [{ id: 1, name: 'Ada' }],
  ...over,
});

// focus moving into the panel is checked in the browser: jsdom gives elements no size, so CDK's
// focus trap finds nothing tabbable here
describe('GridToolbarComponent — popovers', () => {
  let fixture: ComponentFixture<GridToolbarComponent<Row>>;
  let host: HTMLElement;

  async function mount(over: Partial<GridParameter<Row>> = {}): Promise<void> {
    TestBed.configureTestingModule({ imports: [GridToolbarComponent] });
    const instance = TestBed.inject(GridEngineService).build(
      signal(params(over)),
      TestBed.inject(Injector),
    );
    fixture = TestBed.createComponent(GridToolbarComponent<Row>);
    fixture.componentRef.setInput('instance', instance);
    fixture.detectChanges();
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const trigger = (name: string): HTMLButtonElement =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
  const dialog = (name: string): HTMLElement | null =>
    document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"]`);

  function pressEscape(): void {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { value: 27 });
    document.body.dispatchEvent(event);
  }

  it('opens Column settings as a named modal dialog, and Esc closes it', async () => {
    await mount();
    const button = trigger('Column settings');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    await settle();

    const panel = dialog('Column settings')!;
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.querySelector('grid-column-panel')).toBeTruthy();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    pressEscape();
    await settle();

    expect(dialog('Column settings')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the classic Filters popover as a dialog too', async () => {
    await mount({
      unifiedSearch: false,
      gridFilters: [{ type: FieldType.input, key: 'name', label: 'Name' }],
    });
    const button = trigger('Filters');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');

    button.click();
    await settle();

    const panel = dialog('Filters')!;
    expect(panel).toBeTruthy();
    expect(panel.querySelector('grid-filter-panel')).toBeTruthy();

    pressEscape();
    await settle();
    expect(dialog('Filters')).toBeNull();
  });
});
