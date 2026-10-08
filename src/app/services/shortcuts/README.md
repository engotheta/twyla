# Shortcuts

Keyboard shortcuts for whatever is on the page, a **scope** at a time. A scope is a kind of
component — the data grid, the form — or a part of the app, and has one key. That key pressed six
times in a quick run arms the scope and shows a hint listing what its keys do; one more key then
runs a shortcut.

```
g g g g g g      arms the data grid: the hint opens, the grid gets a ring
p                hides its paginator; the hint stays, and says "Paginator: off"
s  t  …          more, at one key each
g                moves to the next grid on the page
?                opens the full list, each shortcut a button
Esc              closes (so do 8 idle seconds)
```

`?` six times opens the full list from anywhere.

```ts
// app.config.ts — optional: without it the defaults apply
provideShortcuts({ presses: 6, window: 500, idle: 8000, keys: {} }),
```

## The scopes

| Scope | Key | Id | Its shortcuts |
| --- | --- | --- | --- |
| App | `A` | `app` | `D` dark theme, `L` language, `T` text size, `C` compact, `K` more contrast, `F` full screen, `S` open Settings. Each is a setting, saved like any other. |
| Layout | `L` | `layout` | `S` navigation, `M` go to main content, `H` all modules |
| Data grid | `G` | `data-grid` | toolbar, search, filters, paginator, columns, selection, view, export and more: [data-grid SPEC §14](../../components/data-grid/SPEC.md) |
| Details | `D` | `details` | `1` list, `2` inline, `3` table, `4` cards; `E` lists expanded, `T` groups in tabs, `U` fields with no value, `A` empty lists, `I` background icons; `0` back to how it was set up |
| Form | `F` | `generic-form` | appearance, hints, steps: [generic-form SPEC §18](../../components/generic-form/SPEC.md) |
| Contents view | `C` | `contents-view` | `T` contents in tabs, `O` tabs down the side, `R` resizable panes, `X` collapse buttons, `F` full-screen buttons, `W` fit to the window, `=` even pane sizes; `0` back to how it was set up. One target per level: `C` again moves to the next level. |
| File viewer | `V` | `file-viewer` | `+` `-` `0` zoom, `R` rotate, `N` `P` next and previous file, `F` find, `H` thumbnails, `S` full screen, `D` download, `T` title bar |
| Tabs | `T` | `tab-nav` | `N` next, `P` previous, `F` first, `L` last. Every row of tabs is a target: a contents view's, a details', a page's own. |

A shortcut is offered only while it has something to act on: no "next step" on a form without
steps, no "filters" on a grid without filters.

**Switched, not saved.** A component's shortcuts lay an override over its params for as long as
it is on screen; the app's config object is never written to, and `0` goes back to it. The app
and layout scopes are the exception: their keys do what the Settings panel and the header's own
buttons do — change a setting, dock the sidebar — and are remembered as those are.

**None of these submits a form, empties one or signs out.** A key pressed in passing must not do
what cannot be taken back.

## What makes a key a shortcut

- **Six presses of one key, each within 500 ms of the one before.** Another key, or a pause,
  starts the count again. Five do nothing.
- **Never from a field.** A key pressed in an input, a textarea, a select, anything editable, or
  a widget with type-ahead of its own (a menu, a list box, a tree) is not counted.
  `data-shortcuts="off"` on an element opts it and what it holds out the same way.
- **Never a held key,** which is one press however long, and never a key pressed with Ctrl, Alt
  or Meta: those are the browser's and the system's.
- **While a scope is armed** its own keys, the scope's key, `?` and Esc are taken before the page
  sees them. Tab, the arrows and every other key do what they always do.
- **Letters ignore Caps Lock.** A shortcut's key is one character as `KeyboardEvent.key` gives
  it, a letter in lower case.

## Which one is meant

With several of a kind on the page — three grids, nested contents views — the scope arms the
likeliest: the one holding focus (the innermost, where they nest), else the one last clicked or
focused, else the first in the document. Its key again moves to the next; the hint says which
("2 of 3") and the ring follows.

What cannot be reached is left out: an instance in a hidden tab, and, while a dialog is open,
anything outside it. A target is named by its scope and, where it has one, its own name:
"Data grid: Employees".

## Turning them off

| Who | How |
| --- | --- |
| A person | Settings → Keyboard → "Keyboard shortcuts" (the `shortcuts` setting). Off, no key is a shortcut. |
| An app | `provideShortcuts({ enabled: false })`: nothing listens, and Settings shows no switch. |
| One component on a page | `shortcuts: false` in its params (`GridParameter`, `FormParameter`, `DetailsParameter`, `ContentsLayout`, `FileViewerParameter`). |
| One shortcut, or one scope, everywhere | `provideShortcuts({ keys: { 'data-grid.export': false, details: false } })` |
| A different key | `provideShortcuts({ keys: { 'data-grid': 'q', 'data-grid.paginator': 'n' } })` |

Shortcuts can switch on what a page left off — a grid's export, say. A page that must stay
exactly as configured sets `shortcuts: false`, or the app removes that shortcut by id.

## Adding shortcuts to a feature

1. **`<feature>.shortcuts.ts`** holds the scope and a function that builds the list. It takes
   what it acts on as a small interface, not the component, so it can be tested without one.

   ```ts
   export const CHART_SCOPE: ShortcutScope = { id: 'chart', key: 'h' };

   export interface ChartShortcutTarget {
     legendShown: () => boolean;
     showLegend: (shown: boolean) => void;
     kinds: () => readonly ChartKind[];
     kind: () => ChartKind;
     setKind: (kind: ChartKind) => void;
     redraw: () => void;
   }

   export function chartShortcuts(chart: ChartShortcutTarget, t: Signal<ChartMessages>): Shortcut[] {
     const text = () => t().shortcuts;
     return [
       toggleShortcut('legend', 'l', () => text().legend, chart.legendShown, chart.showLegend),
       cycleShortcut('kind', 'k', () => text().kind, chart.kinds, chart.kind, chart.setKind,
         (kind) => t().kinds[kind]),
       actionShortcut('redraw', 'r', () => text().redraw, chart.redraw),
     ];
   }
   ```

   | Builder | For | Shown and said as |
   | --- | --- | --- |
   | `toggleShortcut` | something on or off | "Legend: on" |
   | `cycleShortcut` | stepping through values, round and round | "Kind: Bar" |
   | `actionShortcut` | doing something | "Redraw" |

   Each takes `available` (not offered while false) and `dismiss` (it opens something of its own
   — a dialog, a panel — so the hint closes as it runs).

2. **The text** — the scope's name and each label — goes in the feature's own messages file
   under `shortcuts`, with its Swahili beside it.

3. **Register** in the component's constructor. The list is read each time it is shown or a key
   is pressed, never before the component has its inputs, so it can read signals freely.

   ```ts
   constructor() {
     registerShortcuts(
       CHART_SCOPE,
       () => chartShortcuts({ legendShown: this.legendShown, … }, this.t),
       {
         label: () => this.t().shortcuts.scope,
         name: () => this.params().title, // tells this one from another on the page
         enabled: () => this.params().shortcuts !== false,
       },
     );
   }
   ```

   The component's own element is the target: it decides whether the target can be reached,
   which of several is meant, and where the ring is drawn. `host: null` registers a target with
   no element, which is always there (the app scope). It unregisters with the component.

4. **Switch through an override,** not by writing to the params the component was given: a
   signal of what was switched, laid over the input in a `computed` that everything reads. The
   form and the contents view keep their input as `paramsInput` (`alias: 'params'`) and expose
   the result as `params`, so every existing read follows.

5. **Add the scope to `app.shortcuts.spec.ts`,** which holds every scope to an id and a key of
   its own, and every shortcut to one key that is neither its scope's nor `?`. Two scopes on one
   key, or two shortcuts in a scope, also warn in the console in dev mode.

**A button that has a key.** `ActionButton.shortcut: 'n'` needs none of the above: the button
joins the shortcuts of the component it sits in — a grid's toolbar, a details header, the layout's
header — and its key clicks it, so its confirmation, its menu or its file picker open as they do
for a click. A key the component already uses wins. Not for row buttons, where one key would mean
a button in every row.

## The service

```ts
const shortcuts = inject(ShortcutsService);
shortcuts.available;   // the app has shortcuts at all
shortcuts.enabled();   // …and the person has not turned them off
shortcuts.presses;     // how many presses arm a scope
shortcuts.openPanel(); // the full list, as a dialog
shortcuts.close();     // lets go of the armed scope
shortcuts.hint();      // what the hint shows while a scope is armed, else null
```

`SettingsService` owns the person's switch and passes it on with `setEnabled`. The hint and the
panel are loaded the first time each is shown.

## Accessibility

- **A way off** (WCAG 2.1.4, character key shortcuts): the Settings switch; and a single key
  press is never a shortcut on its own.
- **Another way to everything.** The panel lists every shortcut that can be reached as a button
  named in full ("Paginator: on, key P"), under a heading per target. It is a dialog: focus
  moves in and stays in, Esc closes, focus returns.
- **Said, not only shown.** Arming a scope, moving to the next target, what a shortcut did
  ("Paginator: off") and closing are announced politely. What a shortcut did is read off where
  it stands afterwards, so a change that lands a moment later is still told as it turned out.
- **The hint takes no focus** and is hidden from assistive technology: it repeats what is
  announced. Focus stays where it was, so Tab goes on from there.
- **The ring** around the armed target is drawn above the page in the primary colour, and
  follows the target as it scrolls or changes shape.
- **Text** is `SHORTCUTS_MESSAGES`, Swahili beside it; each feature's labels are in its own
  messages.
