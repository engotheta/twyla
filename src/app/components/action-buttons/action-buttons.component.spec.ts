import { ANIMATION_MODULE_TYPE, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { initialsOf, tidyDividers } from './action-button.helpers';
import { ActionButton } from './action-button.interface';
import { ActionButtonsComponent } from './action-buttons.component';

@Component({ template: '' })
class PageComponent {}

describe('ActionButtonsComponent — child buttons as a menu', () => {
  let fixture: ComponentFixture<ActionButtonsComponent<{ id: number }>>;
  let host: HTMLElement;

  async function mount(buttons: ActionButton<{ id: number }>[]): Promise<void> {
    TestBed.configureTestingModule({
      imports: [ActionButtonsComponent],
      providers: [
        provideRouter([{ path: 'reports/:id', component: PageComponent }]),
        // menus and dialogs open and close at once instead of on animation timers
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    fixture = TestBed.createComponent(ActionButtonsComponent<{ id: number }>);
    fixture.componentRef.setInput('buttons', buttons);
    fixture.componentRef.setInput('data', { id: 7 });
    await settle();
    host = fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  }

  const trigger = (label: string): HTMLButtonElement =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  const menus = (): HTMLElement[] => Array.from(document.querySelectorAll('[role="menu"]'));
  const items = (menu = menus()[0]): HTMLElement[] =>
    Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  /** a row's text, without its icon's ligature */
  const text = (row: HTMLElement): string => {
    const copy = row.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('mat-icon, mat-progress-spinner').forEach((icon) => icon.remove());
    return copy.textContent!.replace(/\s+/g, ' ').trim();
  };
  const item = (label: string): HTMLElement =>
    menus()
      .flatMap((menu) => items(menu))
      .find((row) => text(row) === label)!;
  const labels = (menu = menus()[0]): string[] => items(menu).map(text);

  function keydown(target: Element, key: string, keyCode: number): void {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { value: keyCode });
    target.dispatchEvent(event);
  }

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  it('renders the children as the items of a menu the button opens', async () => {
    const edit = vi.fn();
    await mount([
      {
        label: 'More',
        buttons: [
          { label: 'Edit', icon: 'edit', click: edit },
          { label: 'Archive', disabled: true },
          { label: 'Secret', visible: false },
          { type: 'icon', icon: 'delete', tooltip: 'Delete' },
        ],
      },
    ]);
    const more = trigger('More');
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    expect(menus()).toEqual([]);

    more.click();
    await settle();

    expect(more.getAttribute('aria-expanded')).toBe('true');
    // a hidden child is left out; an icon-only child is named by its tooltip
    expect(labels()).toEqual(['Edit', 'Archive', 'Delete']);
    expect(item('Edit').querySelector('mat-icon')?.textContent).toBe('edit');
    expect(item('Archive').getAttribute('aria-disabled')).toBe('true');
    // no plain buttons left in the menu for arrow keys to skip
    expect(menus()[0].querySelectorAll('button:not([role="menuitem"])').length).toBe(0);

    item('Edit').click();
    await settle();

    expect(edit).toHaveBeenCalledWith({ id: 7 });
    expect(menus()).toEqual([]);
  });

  it('moves through the items with the arrow keys', async () => {
    await mount([
      { label: 'More', buttons: [{ label: 'One' }, { label: 'Two' }, { label: 'Three' }] },
    ]);
    trigger('More').click();
    await settle();
    await vi.waitFor(() => expect(document.activeElement).toBe(item('One')));

    keydown(menus()[0], 'ArrowDown', 40);
    expect(document.activeElement).toBe(item('Two'));
    keydown(menus()[0], 'End', 35);
    expect(document.activeElement).toBe(item('Three'));
    keydown(menus()[0], 'ArrowUp', 38);
    expect(document.activeElement).toBe(item('Two'));
  });

  it('opens a child with children of its own as a submenu', async () => {
    const deep = vi.fn();
    await mount([
      {
        label: 'More',
        buttons: [
          { label: 'Plain' },
          { label: 'Deeper', buttons: [{ label: 'Deep action', click: deep, data: { id: 9 } }] },
        ],
      },
    ]);
    trigger('More').click();
    await settle();
    expect(item('Deeper').getAttribute('aria-haspopup')).toBe('menu');
    expect(item('Plain').getAttribute('aria-haspopup')).toBeNull();

    item('Deeper').click();
    await settle();

    expect(menus().length).toBe(2);
    expect(labels(menus()[1])).toEqual(['Deep action']);

    item('Deep action').click();
    await settle();
    // a child's own data wins over the parent's
    expect(deep).toHaveBeenCalledWith({ id: 9 });
    expect(menus()).toEqual([]);
  });

  it('asks before running a child that needs confirming', async () => {
    const remove = vi.fn();
    await mount([
      {
        label: 'More',
        buttons: [{ label: 'Remove', confirmMessage: 'Remove it for good?', click: remove }],
      },
    ]);
    trigger('More').click();
    await settle();
    item('Remove').click();
    await settle();

    const dialog = document.querySelector('mat-dialog-container')!;
    expect(dialog.textContent).toContain('Remove it for good?');
    expect(remove).not.toHaveBeenCalled();

    const confirm = Array.from(dialog.querySelectorAll('button')).at(-1)!;
    confirm.click();
    await settle();
    expect(remove).toHaveBeenCalledWith({ id: 7 });
  });

  it('picks files from a file child, shows their names, and forgets them on removeFile$', async () => {
    const removeFile$ = new Subject<void>();
    const picked: string[] = [];
    await mount([
      {
        label: 'More',
        buttons: [
          {
            label: 'Upload',
            fileConfig: { extensions: ['png', '.jpg'], multiple: true, removeFile$ },
            fileChange: (change) => picked.push(`${change.fileName}:${change.extension}`),
          },
        ],
      },
    ]);
    trigger('More').click();
    await settle();

    // the picker can't open here: stand in for the user choosing a file
    let input!: HTMLInputElement;
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      input = this;
    });
    item('Upload').click();
    click.mockRestore();

    expect(input.type).toBe('file');
    expect(input.accept).toBe('.png,.jpg');
    expect(input.multiple).toBe(true);
    expect(input.isConnected).toBe(true);

    Object.defineProperty(input, 'files', { value: [new File(['x'], 'logo.png')] });
    input.dispatchEvent(new Event('change'));
    await settle();

    expect(picked).toEqual(['logo.png:png']);
    expect(input.isConnected).toBe(false);

    trigger('More').click();
    await settle();
    expect(labels()).toEqual(['logo.png']);

    removeFile$.next();
    await settle();
    expect(labels()).toEqual(['Upload']);
  });

  it('follows observable props: a row appears, renames and disables as they emit', async () => {
    const visible$ = new BehaviorSubject(false);
    const label$ = new BehaviorSubject('Publish');
    await mount([
      { label: 'More', buttons: [{ label: 'Always' }, { label: label$, visible: visible$ }] },
    ]);
    trigger('More').click();
    await settle();
    expect(labels()).toEqual(['Always']);

    visible$.next(true);
    label$.next('Unpublish');
    await settle();
    expect(labels()).toEqual(['Always', 'Unpublish']);
  });

  it('a button without children opens no menu and carries no popup attributes', async () => {
    const save = vi.fn();
    await mount([{ label: 'Save', click: save }]);
    const button = trigger('Save');

    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    button.click();
    await settle();

    expect(save).toHaveBeenCalledWith({ id: 7 });
    expect(menus()).toEqual([]);
  });

  /** the menu's content in order: its items' text, `---` for a line, `# …` for a heading (its
   *  lines apart: `# title / subtitle`) */
  const outline = (menu = menus()[0]): string[] =>
    Array.from(menu.querySelector('.mat-mdc-menu-content')!.children).map((child) => {
      if (child.matches('mat-divider')) return '---';
      if (child.matches('[role="menuitem"]')) return text(child as HTMLElement);
      const lines = child.children.length ? Array.from(child.children) : [child];
      return `# ${lines.map((line) => line.textContent!.trim()).join(' / ')}`;
    });

  it('heads the menu with what menuConfig says, and names the menu by its title', async () => {
    await mount([
      {
        label: 'Account',
        menuConfig: {
          title: (data) => `Record ${data?.id}`,
          subtitle: 'Read only',
          xPosition: 'before',
          class: 'from-config',
        },
        childrenHolderClass: 'from-button',
        buttons: [{ label: 'Open' }],
      },
    ]);
    trigger('Account').click();
    await settle();

    expect(outline()).toEqual(['# Record 7 / Read only', '---', 'Open']);
    const menu = menus()[0];
    const title = document.getElementById(menu.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toBe('Record 7');
    // the heading is not an item: arrow keys pass over it
    expect(items()).toHaveLength(1);
    expect(menu.classList.contains('mat-menu-before')).toBe(true);
    expect(menu.classList.contains('from-config')).toBe(true);
    expect(menu.classList.contains('from-button')).toBe(true);
  });

  it('a menu without a title is not labelled by one', async () => {
    await mount([{ label: 'More', buttons: [{ label: 'Open' }] }]);
    trigger('More').click();
    await settle();

    expect(outline()).toEqual(['Open']);
    expect(menus()[0].hasAttribute('aria-labelledby')).toBe(false);
  });

  it('draws a divider only between two groups with an item showing', async () => {
    const drafts$ = new BehaviorSubject(false);
    await mount([
      {
        label: 'More',
        buttons: [
          { divider: true }, // nothing above it
          { label: 'Edit' },
          { divider: true },
          { divider: true }, // doubled
          { label: 'Draft', visible: drafts$ },
          { divider: true }, // beside a group with nothing showing, until a draft does
          { label: 'Share' },
          { divider: true, visible: false },
          { label: 'Print' },
          { divider: true }, // nothing below it
        ],
      },
    ]);
    trigger('More').click();
    await settle();
    expect(outline()).toEqual(['Edit', '---', 'Share', 'Print']);

    drafts$.next(true);
    await settle();
    expect(outline()).toEqual(['Edit', '---', 'Draft', '---', 'Share', 'Print']);
  });

  it('a divider with a label heads the group below it, even at the top', async () => {
    await mount([
      {
        label: 'More',
        buttons: [
          { divider: true, label: 'This record' },
          { label: 'Edit' },
          { divider: true, label: 'Everyone' },
          { label: 'Share' },
          { divider: true, label: 'Nobody' }, // a heading with no group is left out
        ],
      },
    ]);
    trigger('More').click();
    await settle();

    // no line above the first heading: there is nothing to divide it from
    expect(outline()).toEqual(['# This record', 'Edit', '---', '# Everyone', 'Share']);
    expect(labels()).toEqual(['Edit', 'Share']);
  });

  it('puts a rule between two groups of buttons in a row', async () => {
    const admin$ = new BehaviorSubject(false);
    await mount([
      { divider: true },
      { label: 'Save' },
      { divider: true },
      { label: 'Delete', visible: admin$ },
      { divider: true },
    ]);
    const rules = () => host.querySelectorAll('[role="separator"]');
    expect(rules()).toHaveLength(0);

    admin$.next(true);
    await settle();
    expect(rules()).toHaveLength(1);
    expect(rules()[0].getAttribute('aria-orientation')).toBe('vertical');
    expect(rules()[0].previousElementSibling?.textContent).toContain('Save');
  });

  it('a child with a link is a real link, and runs its click as it is followed', async () => {
    const seen = vi.fn();
    await mount([
      {
        label: 'More',
        buttons: [
          { label: 'Report', link: (data) => ['/reports', data?.id], click: seen },
          { label: 'Locked', link: '/reports/1', disabled: true, click: seen },
        ],
      },
    ]);
    trigger('More').click();
    await settle();

    const report = item('Report');
    expect(report.tagName).toBe('A');
    expect(report.getAttribute('href')).toBe('/reports/7');
    expect(item('Locked').getAttribute('aria-disabled')).toBe('true');

    report.click();
    await settle();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ id: 7 });
    expect(TestBed.inject(Router).url).toBe('/reports/7');
    expect(menus()).toEqual([]);
  });

  it('a button with a link goes there when clicked, after its click', async () => {
    const order: string[] = [];
    await mount([{ label: 'Report', link: '/reports/3', click: () => order.push('click') }]);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    navigate.mockImplementation((url) => {
      order.push(`go ${String(url)}`);
      return Promise.resolve(true);
    });

    trigger('Report').click();
    await settle();
    expect(order).toEqual(['click', 'go /reports/3']);
  });

  it('a button with a menu opens it instead of following its link', async () => {
    await mount([{ label: 'Reports', link: '/reports/3', buttons: [{ label: 'Latest' }] }]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    trigger('Reports').click();
    await settle();
    expect(labels()).toEqual(['Latest']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows an avatar: the picture, or initials when there is none or it fails to load', async () => {
    await mount([
      { label: 'Ada', avatar: { src: 'ada.png', name: 'Ada Lovelace' } },
      { label: 'Grace', avatar: { name: 'grace brewster hopper' } },
      { label: 'Nobody', avatar: {} },
    ]);
    const avatar = (label: string) => trigger(label).querySelector('action-avatar')!;

    const picture = avatar('Ada').querySelector('img')!;
    expect(picture.getAttribute('src')).toBe('ada.png');
    // decoration: the button's label says whose it is
    expect(picture.getAttribute('alt')).toBe('');

    picture.dispatchEvent(new Event('error'));
    await settle();
    expect(avatar('Ada').querySelector('img')).toBeNull();
    expect(avatar('Ada').textContent?.trim()).toBe('AL');

    expect(avatar('Grace').textContent?.trim()).toBe('GB');
    expect(avatar('Grace').querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(avatar('Nobody').querySelector('mat-icon')?.textContent).toBe('person');
  });

  it('shows a child avatar in its row', async () => {
    await mount([
      { label: 'Assign', buttons: [{ label: 'Ada Lovelace', avatar: { name: 'Ada Lovelace' } }] },
    ]);
    trigger('Assign').click();
    await settle();

    const row = items()[0];
    expect(row.querySelector('action-avatar')?.textContent?.trim()).toBe('AL');
    expect(row.textContent).toContain('Ada Lovelace');
  });

  it('names a button by ariaLabel when it gives one', async () => {
    await mount([
      { label: 'Ada', ariaLabel: (data) => `Account ${data?.id}: Ada` },
      { label: 'Save' },
      { type: 'icon', icon: 'delete', tooltip: 'Delete' },
    ]);
    const buttons = Array.from(host.querySelectorAll('button'));

    expect(buttons[0].getAttribute('aria-label')).toBe('Account 7: Ada');
    // a labelled button is named by its label; an icon-only one by its tooltip
    expect(buttons[1].hasAttribute('aria-label')).toBe(false);
    expect(buttons[2].getAttribute('aria-label')).toBe('Delete');
  });

  it('draws a labelled button outlined unless it asks for another appearance', async () => {
    await mount([
      { label: 'Plain' },
      { label: 'Quiet', appearance: 'text' },
      { label: 'Loud', appearance: 'filled' },
    ]);

    expect(trigger('Plain').classList.contains('mat-mdc-outlined-button')).toBe(true);
    expect(trigger('Quiet').classList.contains('mat-mdc-button')).toBe(true);
    expect(trigger('Quiet').classList.contains('mat-mdc-outlined-button')).toBe(false);
    expect(trigger('Loud').classList.contains('mat-mdc-unelevated-button')).toBe(true);
  });
});

describe('tidyDividers', () => {
  const button = { divider: false, visible: true, heading: false };
  const line = { divider: true, visible: true, heading: false };
  const heading = { divider: true, visible: true, heading: true };
  const hidden = { divider: false, visible: false, heading: false };

  /** `b` a button, `-` a line, `h` a heading without its line */
  const shape = (entries: (typeof button)[]): string =>
    tidyDividers(entries)
      .map((row) => (!row.entry.divider ? 'b' : row.line ? '-' : 'h'))
      .join('');

  it('keeps a divider that has a button on either side', () => {
    expect(shape([button, line, button])).toBe('b-b');
  });

  it('drops one at either end, a doubled one, and one beside a hidden group', () => {
    expect(shape([line, button, line])).toBe('b');
    expect(shape([button, line, line, button])).toBe('b-b');
    expect(shape([button, line, hidden, line, button])).toBe('b-b');
    expect(shape([line, hidden, line])).toBe('');
  });

  it('keeps a heading at the top, there without its line', () => {
    expect(shape([heading, button, heading, button])).toBe('hb-b');
    expect(shape([heading, hidden])).toBe('');
  });
});

describe('ActionButtonsComponent — a key of its own (ActionButton.shortcut)', () => {
  let fixture: ComponentFixture<ActionButtonsComponent>;

  async function mount(buttons: ActionButton[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [ActionButtonsComponent],
      providers: [
        provideRouter([]),
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
      ],
    });
    fixture = TestBed.createComponent(ActionButtonsComponent);
    fixture.componentRef.setInput('buttons', buttons);
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** what `ShortcutsService` looks for: the key, and the name the button goes by */
  const marked = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLElement>('[data-shortcut]')).map((element) => [
      element.dataset['shortcut'],
      element.dataset['shortcutLabel'],
    ]);

  it('marks the button with its key and its name, for the shortcuts of what it sits in', async () => {
    const host = await mount([
      { label: 'New employee', icon: 'add', shortcut: 'n' },
      { type: 'icon', icon: 'print', tooltip: 'Print the list', shortcut: 'i' },
      { type: 'icon', icon: 'sync', ariaLabel: 'Synchronise', tooltip: 'Sync', shortcut: 'y' },
      { label: 'Plain' },
    ]);

    expect(marked(host)).toEqual([
      ['n', 'New employee'],
      ['i', 'Print the list'],
      ['y', 'Synchronise'],
    ]);
  });

  it('runs the button’s own click when what it is marked on is clicked through', async () => {
    const click = vi.fn();
    const host = await mount([{ label: 'New employee', shortcut: 'n', click }]);

    // the service clicks the button inside the marked wrapper
    host.querySelector<HTMLElement>('[data-shortcut="n"] button')!.click();

    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Ada Lovelace')).toBe('AL');
    expect(initialsOf('  grace   brewster hopper ')).toBe('GB');
    expect(initialsOf('Plato')).toBe('P');
    expect(initialsOf('')).toBe('');
    expect(initialsOf(undefined)).toBe('');
  });
});
