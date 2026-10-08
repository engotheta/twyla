import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CONTENTS_EN } from './components/contents-view/contents.messages';
import { CONTENTS_SCOPE, contentsShortcuts } from './components/contents-view/contents.shortcuts';
import { GRID_EN } from './components/data-grid/grid.messages';
import {
  GRID_SCOPE,
  gridShortcuts,
  GridShortcutTarget,
} from './components/data-grid/grid.shortcuts';
import { DETAILS_EN } from './components/details/details.messages';
import { DETAILS_SCOPE, detailsShortcuts } from './components/details/details.shortcuts';
import { FILE_VIEWER_EN } from './components/file-viewer/file-viewer.messages';
import {
  FILE_VIEWER_SCOPE,
  fileViewerShortcuts,
} from './components/file-viewer/file-viewer.shortcuts';
import { FORM_EN } from './components/generic-form/form.messages';
import { FORM_SCOPE, formShortcuts } from './components/generic-form/form.shortcuts';
import { TAB_NAV_EN } from './components/tab-nav/tab-nav.messages';
import { TAB_NAV_SCOPE, tabNavShortcuts } from './components/tab-nav/tab-nav.shortcuts';
import { LAYOUT_EN } from './layout/layout.messages';
import { LAYOUT_SCOPE, layoutShortcuts } from './layout/layout.shortcuts';
import { provideI18n } from './services/i18n/i18n-config.token';
import { provideSettings } from './services/settings/provide-settings';
import { APP_SCOPE } from './services/settings/settings.shortcuts';
import { HELP_KEY } from './services/shortcuts/shortcuts.helpers';
import { Shortcut, ShortcutScope } from './services/shortcuts/shortcuts.interface';
import { ShortcutsService } from './services/shortcuts/shortcuts.service';

/**
 * A stand-in for whatever a feature's shortcuts act on: every member is a function that answers
 * nothing. Building a list only reads the target's members; none is called until a shortcut is
 * shown or run.
 */
function anything<T>(): T {
  return new Proxy({}, { get: () => () => undefined }) as T;
}

/** every feature's shortcuts — a new `*.shortcuts.ts` belongs in this list */
const FEATURES: { scope: ShortcutScope; shortcuts: Shortcut[] }[] = [
  { scope: LAYOUT_SCOPE, shortcuts: layoutShortcuts(anything(), signal(LAYOUT_EN)) },
  {
    scope: GRID_SCOPE,
    shortcuts: gridShortcuts(anything<GridShortcutTarget>(), signal(GRID_EN)),
  },
  { scope: DETAILS_SCOPE, shortcuts: detailsShortcuts(anything(), signal(DETAILS_EN)) },
  { scope: FORM_SCOPE, shortcuts: formShortcuts(anything(), signal(FORM_EN)) },
  { scope: CONTENTS_SCOPE, shortcuts: contentsShortcuts(anything(), signal(CONTENTS_EN)) },
  { scope: FILE_VIEWER_SCOPE, shortcuts: fileViewerShortcuts(anything(), signal(FILE_VIEWER_EN)) },
  { scope: TAB_NAV_SCOPE, shortcuts: tabNavShortcuts(anything(), signal(TAB_NAV_EN)) },
];

const SCOPES = [APP_SCOPE, ...FEATURES.map((feature) => feature.scope)];

const duplicates = (values: string[]): string[] =>
  values.filter((value, index) => values.indexOf(value) !== index);

describe('shortcuts', () => {
  it('gives every scope an id and a key of its own', () => {
    expect(duplicates(SCOPES.map((scope) => scope.id))).toEqual([]);
    expect(duplicates(SCOPES.map((scope) => scope.key))).toEqual([]);
  });

  it('keys every scope with one lower-case character — and none with the key for help', () => {
    for (const scope of SCOPES) {
      expect(scope.key, scope.id).toMatch(/^[a-z0-9]$/);
      expect(scope.key, scope.id).not.toBe(HELP_KEY);
    }
  });

  for (const { scope, shortcuts } of FEATURES) {
    describe(scope.id, () => {
      it('has shortcuts, each with an id and a key of its own', () => {
        expect(shortcuts.length).toBeGreaterThan(0);
        expect(duplicates(shortcuts.map((shortcut) => shortcut.id))).toEqual([]);
        expect(duplicates(shortcuts.map((shortcut) => shortcut.key))).toEqual([]);
      });

      it('keys each with one character that is not its scope’s own, nor the key for help', () => {
        for (const shortcut of shortcuts) {
          const name = `${scope.id}.${shortcut.id}`;
          expect(shortcut.key, name).toHaveLength(1);
          expect(shortcut.key, name).toBe(shortcut.key.toLowerCase());
          expect(shortcut.key, name).not.toBe(scope.key);
          expect(shortcut.key, name).not.toBe(HELP_KEY);
        }
      });

      it('names each in words', () => {
        for (const shortcut of shortcuts) {
          expect(shortcut.label(), `${scope.id}.${shortcut.id}`).toMatch(/\S/);
        }
      });
    });
  }

  describe(APP_SCOPE.id, () => {
    it('offers its shortcuts on every page, each on a key of its own', () => {
      TestBed.configureTestingModule({
        providers: [
          provideI18n({
            languages: [
              { code: 'en', name: 'English' },
              { code: 'sw', name: 'Kiswahili' },
            ],
          }),
          provideSettings({ storageKey: 'test.settings' }),
        ],
      });
      const service = TestBed.inject(ShortcutsService);
      for (let i = 0; i < service.presses; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: APP_SCOPE.key, bubbles: true }));
      }
      const rows = service.hint()?.shortcuts ?? [];
      service.close();

      expect(rows.map((row) => row.id)).toEqual([
        'dark',
        'language',
        'textSize',
        'compact',
        'contrast',
        'settings',
      ]);
      expect(duplicates(rows.map((row) => row.key))).toEqual([]);
      expect(rows.map((row) => row.key)).not.toContain(APP_SCOPE.key);
    });
  });
});
