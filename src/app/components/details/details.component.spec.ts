import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { DetailsComponent } from './details.component';
import { DetailsParameter } from './interfaces/details.interface';
import { FieldData } from './interfaces/field.interface';

describe('DetailsComponent — fetchFn', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DetailsComponent] });
  });

  function mount(params: DetailsParameter) {
    const fixture = TestBed.createComponent(DetailsComponent);
    fixture.componentRef.setInput('params', params);
    return fixture;
  }

  // `loading`/`error` are `protected` (render-facing internals, not part of DetailsComponent's
  // public contract) — this narrow accessor is test-only, doesn't widen the real API surface.
  function state(fixture: ReturnType<typeof mount>) {
    return fixture.componentInstance as unknown as {
      loading: () => boolean;
      error: () => unknown;
    };
  }

  it('resolves an Observable fetchFn into the rendered entity', async () => {
    const fixture = mount({ fetchFn: () => of({ name: 'Ada' }) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ada');
  });

  it('resolves a Promise fetchFn into the rendered entity', async () => {
    const fixture = mount({ fetchFn: () => Promise.resolve({ name: 'Grace' }) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Grace');
  });

  it('resolves a plain-value fetchFn into the rendered entity', async () => {
    const fixture = mount({ fetchFn: () => ({ name: 'Alan' }) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Alan');
  });

  it('falls back to a static entity while no fetchFn is set at all', async () => {
    const fixture = mount({ entity: { name: 'Static Sam' } });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Static Sam');
    expect(state(fixture).loading()).toBe(false);
  });

  it('sets loading true while pending and false once resolved, using a static entity as a fallback meanwhile', async () => {
    const subject = new Subject<{ name: string }>();
    const fixture = mount({ entity: { name: 'Fallback Fiona' }, fetchFn: () => subject });
    fixture.detectChanges();

    expect(state(fixture).loading()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Fallback Fiona');

    subject.next({ name: 'Resolved Rita' });
    subject.complete();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(state(fixture).loading()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Resolved Rita');
  });

  it('sets error when the fetchFn source errors, without throwing', async () => {
    const fixture = mount({ fetchFn: () => throwError(() => new Error('boom')) });
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(state(fixture).loading()).toBe(false);
    expect(state(fixture).error()).toBeInstanceOf(Error);
  });

  it('a dynamic field resolver (icon/class/tooltip) sees the FETCHED entity, not a stale/undefined one', async () => {
    const fixture = mount({
      fetchFn: () => of({ name: 'Vip Vince', vip: true }),
      fieldsProperties: {
        name: { icon: (entity: { vip?: boolean }) => (entity?.vip ? 'star' : 'person') },
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // proves the dynamic resolver received the FETCHED entity ({ vip: true }), not the
    // parameter's static/undefined entity — the bug the effectiveParameter() fix guards against
    expect((fixture.nativeElement as HTMLElement).innerHTML).toContain('star');
  });
});

describe('DetailsComponent — field values', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DetailsComponent],
      // Material dialogs finish opening synchronously instead of on an animation timer
      providers: [{ provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }],
    });
  });

  async function render(params: DetailsParameter) {
    const fixture = TestBed.createComponent(DetailsComponent);
    fixture.componentRef.setInput('params', params);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const overlayText = () => document.querySelector('.cdk-overlay-container')?.textContent ?? '';

  it("an object value opens a titled dialog showing the object's own fields", async () => {
    const { fixture, el } = await render({
      entity: { name: 'Ada', address: { street: '123 Main', city: 'NYC' } },
    });

    el.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // the regression: the dialog opened as an empty panel (just its shadow), no fields
    expect(overlayText()).toContain('123 Main');
    expect(overlayText()).toContain('NYC');
    expect(document.querySelector('.cdk-overlay-container h2')?.textContent).toContain('Address');
  });

  it("a field's click turns its value into a button handed (entity, field)", async () => {
    const click = vi.fn();
    const entity = { name: 'Ada', role: 'admin' };
    const { el } = await render({ entity, fieldsProperties: { name: { click } } });

    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent?.includes('admin'))).toBe(false); // no click, no button
    buttons.find((b) => b.textContent?.includes('Ada'))!.click();

    expect(click).toHaveBeenCalledTimes(1);
    const [data, field] = click.mock.calls[0] as [unknown, FieldData];
    expect(data).toEqual(entity);
    expect(field.key).toBe('name');
    expect(field.value).toBe('Ada');
  });

  it("an object field's click replaces its dialog", async () => {
    const click = vi.fn();
    const { fixture, el } = await render({
      entity: { address: { street: '123 Main' } },
      fieldsProperties: { address: { click } },
    });

    const button = el.querySelector<HTMLButtonElement>('.text-primary')!;
    expect(button.hasAttribute('aria-haspopup')).toBe(false);
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(click).toHaveBeenCalledTimes(1);
    expect(overlayText()).not.toContain('123 Main');
  });

  it('a percentage fills its bar from a number or a "45%" string', async () => {
    const { el } = await render({
      entity: { score: 50, completion: '45%' },
      fieldsProperties: { completion: { type: 'percentage' } },
    });

    const fills = Array.from(
      el.querySelectorAll<HTMLElement>('[aria-hidden="true"] > .bg-primary'),
    );
    expect(fills.map((fill) => fill.style.width)).toEqual(['50%', '45%']);
  });

  it('arrayConfig.expanded starts array items open', async () => {
    const entity = { users: [{ id: 1, name: 'User 1', role: 'admin' }] };
    const toggle = async (params: DetailsParameter) =>
      (await render(params)).el.querySelector('button[aria-expanded]')!;

    expect((await toggle({ entity })).getAttribute('aria-expanded')).toBe('false');
    expect(
      (await toggle({ entity, arrayConfig: { expanded: true } })).getAttribute('aria-expanded'),
    ).toBe('true');
  });
});

describe('DetailsComponent — groups in tabs', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DetailsComponent] });
  });

  const entity = { name: 'Ada', role: 'admin', city: 'London', zip: 'N1', notes: 'none' };

  async function render(params: DetailsParameter) {
    const fixture = TestBed.createComponent(DetailsComponent);
    fixture.componentRef.setInput('params', params);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, el, settle };
  }

  /** the tabs of one tablist, and the panels they control */
  const tabsOf = (list: Element) => Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
  const labels = (list: Element) =>
    tabsOf(list).map((tab) => tab.querySelector('.cv-tab-nav-label')!.textContent);
  const panelOf = (el: HTMLElement, tab: HTMLElement) =>
    el.querySelector<HTMLElement>(`[id="${tab.getAttribute('aria-controls')}"]`)!;

  it('shows the groups as tabs — the custom ones, not Material’s — one panel at a time', async () => {
    const { el, settle } = await render({
      entity,
      header: { title: 'Speaker' },
      showGroupsInTabs: true,
      fieldGroups: [
        { label: 'Person', icon: 'person', fields: ['name', 'role'] },
        { fields: ['city', 'zip'] }, // no label of its own
      ],
    });

    expect(el.querySelector('mat-tab-group')).toBeNull();
    const list = el.querySelector('[role="tablist"]')!;
    expect(list.getAttribute('aria-label')).toBe('Speaker'); // named after the heading
    expect(labels(list)).toEqual(['Person', 'Group 2']);
    const [person, second] = tabsOf(list);
    expect(person.querySelector('mat-icon')!.textContent).toBe('person');

    expect(person.getAttribute('aria-selected')).toBe('true');
    expect(panelOf(el, person).hidden).toBe(false);
    expect(panelOf(el, person).textContent).toContain('Ada');
    expect(panelOf(el, second).hidden).toBe(true);
    expect(panelOf(el, second).textContent).not.toContain('London'); // not rendered yet

    second.click();
    await settle();
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(panelOf(el, second).hidden).toBe(false);
    expect(panelOf(el, second).textContent).toContain('London');
    expect(panelOf(el, person).hidden).toBe(true);
    expect(panelOf(el, person).textContent).toContain('Ada'); // kept, for when it is shown again
  });

  it('a group shown as a tab leaves its heading to the tab, and keeps its buttons', async () => {
    const heading = (panel: HTMLElement) => panel.querySelector('.font-semibold')?.textContent;
    const { el, settle } = await render({
      entity,
      showGroupsInTabs: true,
      fieldGroups: [
        {
          label: 'Person',
          icon: 'person',
          fields: ['name'],
          actionButtons: [{ label: 'Edit person' }],
        },
        { label: 'Place', fields: ['city'], showHeader: true }, // asks for its heading anyway
      ],
    });
    const [person, place] = tabsOf(el.querySelector('[role="tablist"]')!);

    expect(heading(panelOf(el, person))).toBeUndefined(); // the tab has said "Person"
    expect(panelOf(el, person).textContent).toContain('Edit person');
    expect(panelOf(el, person).textContent).toContain('Ada');

    place.click();
    await settle();
    expect(heading(panelOf(el, place))).toBe('Place');
  });

  it('in a list, as before, every group has its heading', async () => {
    const { el } = await render({
      entity,
      fieldGroups: [
        { label: 'Person', fields: ['name'] },
        { label: 'Place', fields: ['city'] },
      ],
    });
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(Array.from(el.querySelectorAll('.font-semibold')).map((h) => h.textContent)).toEqual([
      'Person',
      'Place',
    ]);
  });

  it('names the tabs "Sections" when there is no heading to name them after', async () => {
    const { el } = await render({
      entity,
      showGroupsInTabs: true,
      fieldGroups: [{ label: 'Person', fields: ['name'] }],
    });
    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Sections');
  });

  it('takes the four tab class hooks, and a wrapper class from groupConfig', async () => {
    const { el } = await render({
      entity,
      showGroupsInTabs: true,
      tabsContainerClass: 'hook-strip',
      tabClass: 'hook-tab',
      activeTabClass: 'hook-active',
      tabIndicatorClass: 'hook-indicator',
      groupConfig: { containerClass: 'hook-wrapper' },
      fieldGroups: [
        { label: 'Person', fields: ['name'] },
        { label: 'Place', fields: ['city'] },
      ],
    });

    expect(el.querySelector('tab-panels')!.className).toContain('hook-wrapper');
    expect(el.querySelector('tab-nav')!.className).toContain('hook-strip');
    const [active, other] = tabsOf(el.querySelector('[role="tablist"]')!);
    expect(active.className).toContain('hook-tab');
    expect(active.className).toContain('hook-active');
    expect(other.className).toContain('hook-tab');
    expect(other.className).not.toContain('hook-active');
    expect(el.querySelector('.cv-tab-nav-indicator')!.className).toContain('hook-indicator');
  });

  it('shows a group’s sub-groups as tabs of their own, restyled per group on top of the details’', async () => {
    const { el, settle } = await render({
      entity,
      tabsContainerClass: 'from-details',
      fieldGroups: [
        {
          label: 'Profile',
          showGroupsInTabs: true,
          tabsContainerClass: 'from-group',
          groupsClass: 'sub-wrapper',
          groupsContainerClass: 'sub-panel',
          fields: ['name'],
          groups: [
            { label: 'Role', fields: ['role'] },
            { label: 'Notes', fields: ['notes'] },
          ],
        },
        { label: 'Place', fields: ['city'] },
      ],
    });

    // the details' own groups are a list here: only "Profile" turns its sub-groups into tabs
    const lists = el.querySelectorAll('[role="tablist"]');
    expect(lists.length).toBe(1);
    expect(lists[0].getAttribute('aria-label')).toBe('Profile');
    expect(labels(lists[0])).toEqual(['Role', 'Notes']);

    const strip = el.querySelector('tab-nav')!;
    expect(strip.className).toContain('from-details');
    expect(strip.className).toContain('from-group');
    expect(el.querySelector('tab-panels')!.className).toContain('sub-wrapper');

    const [role, notes] = tabsOf(lists[0]);
    expect(panelOf(el, role).className).toContain('sub-panel');
    expect(panelOf(el, role).textContent).toContain('admin');
    notes.click();
    await settle();
    expect(panelOf(el, notes).textContent).toContain('none');
    // the group's own field, outside its tabs, and its sibling group are there throughout
    expect(el.textContent).toContain('Ada');
    expect(el.textContent).toContain('London');
  });

  it('reads the tab hooks from a group’s props string too', async () => {
    const { el } = await render({
      entity,
      fieldsGroupsMap: {
        'Profile showGroupsInTabs(true) tabsContainerClass(from-string)': {
          Role: ['role'],
          Notes: ['notes'],
        },
      },
    });
    expect(el.querySelector('tab-nav')!.className).toContain('from-string');
  });
});
