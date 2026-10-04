import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { I18nService } from '@services/i18n/i18n.service';
import { injectMessages } from '@services/i18n/message-bundle';
import { AppSettings, RevealOrigin } from '../settings.interface';
import { SETTINGS_MESSAGES } from '../settings.messages';
import { SettingsService } from '../settings.service';

/** one of a setting's choices, as its radio button shows it */
interface Choice {
  value: string;
  label: string;
  icon?: string;
  /** the language the label is written in, when it isn't the page's (a language's own name) */
  lang?: string;
}

/** the settings picked from a few choices */
type ChoiceKey = 'theme' | 'textSize' | 'density' | 'language' | 'contrast';
/** the settings that are on or off, and the value each holds either way */
const SWITCHES = {
  motion: { on: 'reduced', off: 'system' },
  font: { on: 'readable', off: 'default' },
  textSpacing: { on: 'wide', off: 'default' },
} as const;
type SwitchKey = keyof typeof SWITCHES;

let nextId = 0;

/**
 * The controls for `SettingsService`: every change applies and is saved as it's made. Shown in
 * the sheet `<settings-button>` opens, and as a page (`/account/preferences`).
 *
 * Each choice setting is a radio group in a `<fieldset>` named by its `<legend>`, with native
 * radio inputs — arrow keys move between the choices — and each on/off setting is a switch. Both
 * carry their hint as a description, and a change is announced.
 */
@Component({
  selector: 'settings-panel',
  imports: [NgTemplateOutlet, MatButton, MatIcon, MatSlideToggle],
  templateUrl: './settings-panel.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPanelComponent {
  private readonly service = inject(SettingsService);
  private readonly i18n = inject(I18nService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  /** the level of the section headings: 3 under a dialog's title, 2 under a page's */
  readonly headingLevel = input<2 | 3>(3);

  protected readonly t = injectMessages(SETTINGS_MESSAGES);
  protected readonly settings = this.service.settings;
  protected readonly pristine = this.service.pristine;
  /** keeps this panel's radio groups and ids apart from another panel's on the same page */
  protected readonly id = `settings-${nextId++}`;
  /** an app in one language has no language to choose */
  protected readonly languageChoice = this.i18n.languages.length > 1;

  protected readonly choices = computed<Record<ChoiceKey, Choice[]>>(() => {
    const t = this.t();
    return {
      theme: [
        { value: 'system', label: t.system, icon: 'brightness_auto' },
        { value: 'light', label: t.theme.light, icon: 'light_mode' },
        { value: 'dark', label: t.theme.dark, icon: 'dark_mode' },
      ],
      textSize: [
        { value: 'default', label: t.textSize.default },
        { value: 'large', label: t.textSize.large },
        { value: 'larger', label: t.textSize.larger },
        { value: 'largest', label: t.textSize.largest },
      ],
      density: [
        { value: 'comfortable', label: t.density.comfortable },
        { value: 'compact', label: t.density.compact },
      ],
      language: [
        { value: 'system', label: t.system },
        // a language is listed under its own name, whatever language the page is in
        ...this.i18n.languages.map(({ code, name }) => ({ value: code, label: name, lang: code })),
      ],
      contrast: [
        { value: 'system', label: t.system },
        { value: 'standard', label: t.contrast.standard },
        { value: 'more', label: t.contrast.more },
      ],
    };
  });

  protected isOn(key: SwitchKey): boolean {
    return this.settings()[key] === SWITCHES[key].on;
  }

  protected choose(key: ChoiceKey, value: string, event: Event): void {
    const origin = key === 'theme' ? this.originOf(event) : undefined;
    this.service.update({ [key]: value } as Partial<AppSettings>, origin);

    // after the change: a new language announces itself in that language
    const choice = this.choices()[key].find((option) => option.value === value);
    this.announce(this.t()[key].label, choice?.label ?? value);
  }

  protected toggle(key: SwitchKey, on: boolean): void {
    const value = on ? SWITCHES[key].on : SWITCHES[key].off;
    this.service.update({ [key]: value } as Partial<AppSettings>);
    this.announce(this.t()[key].label, on ? this.t().on : this.t().off);
  }

  protected reset(): void {
    this.service.reset();
    void this.announcer.announce(this.t().resetDone, 'polite');
  }

  private announce(setting: string, value: string): void {
    void this.announcer.announce(this.t().changed(setting, value), 'polite');
  }

  /** the middle of the choice that was picked — its visible chip, the input itself being hidden */
  private originOf(event: Event): RevealOrigin | undefined {
    const input = event.target instanceof HTMLElement ? event.target : null;
    const chip = input?.closest('label') ?? input;
    if (!chip || !this.host.contains(chip)) return undefined;
    const box = chip.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
}
