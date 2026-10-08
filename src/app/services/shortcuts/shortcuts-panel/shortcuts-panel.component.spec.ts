import { LiveAnnouncer } from '@angular/cdk/a11y';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { ViewService } from '@services/view/view.service';
import { toggleShortcut } from '../shortcuts.helpers';
import { ShortcutTarget } from '../shortcuts.interface';
import { ShortcutsService } from '../shortcuts.service';
import { ShortcutsPanelComponent } from './shortcuts-panel.component';

describe('ShortcutsPanelComponent', () => {
  let fixture: ComponentFixture<ShortcutsPanelComponent>;
  let service: ShortcutsService;
  let announce: ReturnType<typeof vi.fn>;
  let handed: ShortcutTarget[];

  const paginator = signal(true);
  const openSettings = vi.fn();
  const close = vi.fn();

  const host = () => fixture.nativeElement as HTMLElement;
  const text = (element: Element | null | undefined) =>
    (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const headings = () => Array.from(host().querySelectorAll('h3')).map(text);
  const buttons = () => Array.from(host().querySelectorAll<HTMLButtonElement>('button'));
  /** a row's button, by the name a screen reader gives it */
  const names = () => buttons().map((one) => one.getAttribute('aria-label'));
  const button = (name: string) => buttons().find((one) => text(one).includes(name))!;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** the panel, opened the way the service opens it: with what could be reached then */
  async function render(register: () => void): Promise<void> {
    announce = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn(() => ({ afterClosed: () => EMPTY }));
    TestBed.configureTestingModule({
      imports: [ShortcutsPanelComponent],
      providers: [
        { provide: LiveAnnouncer, useValue: { announce } },
        { provide: ViewService, useValue: { open } },
      ],
    });
    service = TestBed.inject(ShortcutsService);
    register();
    await service.openPanel();
    handed = (
      open.mock.calls[0] as unknown as [unknown, { inputs: { targets: ShortcutTarget[] } }]
    )[1].inputs.targets;

    fixture = TestBed.createComponent(ShortcutsPanelComponent);
    fixture.componentRef.setInput('targets', handed);
    fixture.componentRef.setInput('dialogRef', { close });
    await settle();
  }

  const registerTwo = (): void => {
    service.register({
      scope: { id: 'data-grid', key: 'g' },
      label: () => 'Data grid',
      name: () => 'Employees',
      shortcuts: () => [
        toggleShortcut(
          'paginator',
          'p',
          () => 'Paginator',
          paginator,
          (on) => paginator.set(on),
        ),
      ],
    });
    service.register({
      scope: { id: 'app', key: 'a' },
      label: () => 'App',
      shortcuts: () => [
        {
          id: 'settings',
          key: 's',
          label: () => 'Open settings',
          run: openSettings,
          dismiss: true,
        },
      ],
    });
  };

  beforeEach(() => {
    paginator.set(true);
    openSettings.mockClear();
    close.mockClear();
  });

  it('lists every scope that can be reached, with its key and how to press it', async () => {
    await render(registerTwo);

    expect(headings()).toEqual(['Data grid: Employees G, 6 times', 'App A, 6 times']);
    expect(text(host())).toContain('6 times in a row');
  });

  it('makes each shortcut a button, showing its key and where it stands', async () => {
    await render(registerTwo);

    expect(names()).toEqual(['Paginator: on, key P', 'Open settings, key S']);
    expect(text(buttons()[0].querySelector('kbd'))).toBe('P');
    expect(buttons().every((one) => one.type === 'button')).toBe(true);
  });

  it('runs a shortcut when its button is clicked, stays open, and follows the new state', async () => {
    await render(registerTwo);

    button('Paginator').click();
    await settle();

    expect(paginator()).toBe(false);
    expect(names()[0]).toBe('Paginator: off, key P');
    expect(close).not.toHaveBeenCalled();
    expect(announce).toHaveBeenLastCalledWith('Paginator: off', 'polite');
  });

  it('closes first for a shortcut that opens something of its own', async () => {
    await render(registerTwo);

    button('Open settings').click();

    expect(openSettings).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('says so when nothing on the page has shortcuts', async () => {
    await render(() => undefined);

    expect(headings()).toEqual([]);
    expect(text(host())).toContain('Nothing on this page has shortcuts.');
  });
});
