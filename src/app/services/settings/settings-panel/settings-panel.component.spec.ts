import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18n } from '@services/i18n/i18n-config.token';
import { provideSettings } from '../provide-settings';
import { SettingsService } from '../settings.service';
import { SettingsPanelComponent } from './settings-panel.component';

describe('SettingsPanelComponent', () => {
  let fixture: ComponentFixture<SettingsPanelComponent>;
  let host: HTMLElement;
  let service: SettingsService;
  let announce: ReturnType<typeof vi.fn>;

  const root = document.documentElement;

  beforeEach(async () => {
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [SettingsPanelComponent],
      providers: [
        provideI18n({
          languages: [
            { code: 'en', name: 'English' },
            { code: 'sw', name: 'Kiswahili' },
          ],
        }),
        provideSettings({ storageKey: 'test.settings' }),
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
    fixture = TestBed.createComponent(SettingsPanelComponent);
    host = fixture.nativeElement as HTMLElement;
    service = TestBed.inject(SettingsService);
    await settle();
  });

  afterEach(() => {
    root.className = '';
    for (const name of [...root.getAttributeNames()]) {
      if (name.startsWith('data-')) root.removeAttribute(name);
    }
    root.lang = 'en';
    document.head.querySelectorAll('link[data-readable-font]').forEach((link) => link.remove());
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const text = (element: Element | null | undefined): string =>
    (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

  /** a choice setting's radio group, by its legend */
  const group = (legend: string): HTMLFieldSetElement =>
    Array.from(host.querySelectorAll('fieldset')).find(
      (fieldset) => text(fieldset.querySelector('legend')) === legend,
    )!;
  const radios = (legend: string): HTMLInputElement[] =>
    Array.from(group(legend).querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  /** a radio's name: the label it sits in, without its icon's ligature */
  const nameOf = (radio: HTMLInputElement | undefined): string => {
    const label = radio?.closest('label')?.cloneNode(true) as HTMLElement | undefined;
    label?.querySelectorAll('mat-icon').forEach((icon) => icon.remove());
    return text(label);
  };
  const choices = (legend: string): string[] => radios(legend).map(nameOf);
  const checked = (legend: string): string => nameOf(radios(legend).find((radio) => radio.checked));

  async function pick(legend: string, choice: string): Promise<void> {
    const radio = radios(legend).find((input) => nameOf(input) === choice)!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  /** an on/off setting's switch, by the label it is named by */
  const toggle = (label: string): HTMLButtonElement =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button[role="switch"]')).find(
      (button) => text(document.getElementById(button.getAttribute('aria-labelledby')!)) === label,
    )!;

  it('shows every setting with the current choice picked', () => {
    expect(choices('Theme')).toEqual(['System', 'Light', 'Dark']);
    expect(choices('Text size')).toEqual(['Default', 'Large', 'Larger', 'Largest']);
    expect(choices('Density')).toEqual(['Comfortable', 'Compact']);
    expect(choices('Language')).toEqual(['System', 'English', 'Kiswahili']);
    expect(choices('Contrast')).toEqual(['System', 'Standard', 'More']);

    expect(checked('Theme')).toBe('System');
    expect(checked('Text size')).toBe('Default');
    expect(checked('Density')).toBe('Comfortable');

    for (const label of ['Reduce motion', 'Readable font', 'Wider text spacing']) {
      expect(toggle(label).getAttribute('aria-checked')).toBe('false');
    }
  });

  it('names and describes every control', () => {
    for (const fieldset of Array.from(host.querySelectorAll('fieldset'))) {
      expect(text(fieldset.querySelector('legend'))).not.toBe('');
      const hint = document.getElementById(fieldset.getAttribute('aria-describedby')!);
      expect(text(hint)).not.toBe('');
      // one radio group per setting: every radio shares the group's name
      const names = new Set(
        Array.from(fieldset.querySelectorAll<HTMLInputElement>('input')).map((input) => input.name),
      );
      expect(names.size).toBe(1);
    }
    for (const button of Array.from(host.querySelectorAll('button[role="switch"]'))) {
      expect(text(document.getElementById(button.getAttribute('aria-labelledby')!))).not.toBe('');
      expect(text(document.getElementById(button.getAttribute('aria-describedby')!))).not.toBe('');
    }
    // a language is listed under its own name, marked as that language
    const kiswahili = radios('Language')[2].closest('label')!.querySelector('[lang]');
    expect(kiswahili?.getAttribute('lang')).toBe('sw');
  });

  it('applies a choice at once and announces it', async () => {
    await pick('Theme', 'Dark');
    expect(service.settings().theme).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(checked('Theme')).toBe('Dark');
    expect(announce).toHaveBeenLastCalledWith('Theme: Dark', 'polite');

    await pick('Text size', 'Larger');
    expect(root.getAttribute('data-text-size')).toBe('larger');
    expect(announce).toHaveBeenLastCalledWith('Text size: Larger', 'polite');

    await pick('Contrast', 'More');
    expect(root.getAttribute('data-contrast')).toBe('more');

    await pick('Density', 'Compact');
    expect(root.getAttribute('data-density')).toBe('compact');
  });

  it('turns the switches on and off', async () => {
    toggle('Reduce motion').click();
    await settle();
    expect(service.settings().motion).toBe('reduced');
    expect(toggle('Reduce motion').getAttribute('aria-checked')).toBe('true');
    expect(announce).toHaveBeenLastCalledWith('Reduce motion: on', 'polite');

    toggle('Readable font').click();
    toggle('Wider text spacing').click();
    await settle();
    expect(service.settings()).toMatchObject({ font: 'readable', textSpacing: 'wide' });

    toggle('Reduce motion').click();
    await settle();
    expect(service.settings().motion).toBe('system');
    expect(announce).toHaveBeenLastCalledWith('Reduce motion: off', 'polite');
  });

  it('switches its own text with the language, and announces in the new one', async () => {
    await pick('Language', 'Kiswahili');

    expect(service.language()).toBe('sw');
    expect(root.lang).toBe('sw');
    expect(text(group('Mandhari').querySelector('legend'))).toBe('Mandhari');
    expect(choices('Lugha')).toEqual(['Mfumo', 'English', 'Kiswahili']);
    expect(announce).toHaveBeenLastCalledWith('Lugha: Kiswahili', 'polite');

    await pick('Lugha', 'English');
    expect(group('Theme')).toBeTruthy();
  });

  it('resets to the defaults, once there is something to reset', async () => {
    const reset = (): HTMLButtonElement =>
      Array.from(host.querySelectorAll('button')).find((b) => text(b).includes('Reset'))!;
    expect(reset().disabled).toBe(true);

    await pick('Theme', 'Dark');
    expect(reset().disabled).toBe(false);

    reset().click();
    await settle();
    expect(service.pristine()).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
    expect(checked('Theme')).toBe('System');
    expect(announce).toHaveBeenLastCalledWith('Settings reset to defaults', 'polite');
  });

  it('puts its section headings at the level its place calls for', async () => {
    expect(Array.from(host.querySelectorAll('h3')).map(text)).toEqual([
      'Appearance',
      'Language',
      'Accessibility',
    ]);

    fixture.componentRef.setInput('headingLevel', 2);
    await settle();
    expect(host.querySelectorAll('h3').length).toBe(0);
    expect(host.querySelectorAll('h2').length).toBe(3);
  });
});

describe('SettingsPanelComponent in an app with one language', () => {
  afterEach(() => {
    const root = document.documentElement;
    root.className = '';
    for (const name of [...root.getAttributeNames()]) {
      if (name.startsWith('data-')) root.removeAttribute(name);
    }
  });

  it('offers no language to choose, and everything else', async () => {
    TestBed.configureTestingModule({
      imports: [SettingsPanelComponent],
      providers: [provideSettings({ storageKey: 'test.settings' })],
    });
    const fixture = TestBed.createComponent(SettingsPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const legends = Array.from(host.querySelectorAll('legend')).map((legend) =>
      (legend.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(legends).toEqual(['Theme', 'Text size', 'Density', 'Contrast']);
    expect(host.querySelectorAll('[role="switch"]').length).toBe(3);
  });
});
