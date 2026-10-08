# Settings

What a person sets for themselves, on this device: theme, language, text size, contrast, motion,
a more readable font, wider text spacing, density and keyboard shortcuts. Each change applies at
once and is saved; there is no Save button.

```ts
// app.config.ts
provideI18n({ languages: [...] }), // the languages the Language setting offers
provideSettings({ storageKey: 'my-app.settings' }),
```

```html
<settings-button />                       <!-- opens the panel as a sheet from the right edge -->
<settings-panel [headingLevel]="2" />     <!-- the same controls, inside a page -->
```

Twyla has the button in the app header, the public header and the Modules page
(`LayoutConfig.showSettings`, default true), and the panel as a page at `/account/preferences`.

## The settings

| Setting | Choices | Default |
| --- | --- | --- |
| `theme` | `system`, `light`, `dark` | `system` |
| `language` | `system`, or a code from `provideI18n` | `system` |
| `textSize` | `default`, `large`, `larger`, `largest` (100, 112.5, 125, 150%) | `default` |
| `contrast` | `system`, `standard`, `more` | `system` |
| `motion` | `system`, `reduced` | `system` |
| `font` | `default`, `readable` (Atkinson Hyperlegible Next) | `default` |
| `textSpacing` | `default`, `wide` (the WCAG 1.4.12 values) | `default` |
| `density` | `comfortable`, `compact` (Material density −2) | `comfortable` |
| `shortcuts` | `on`, `off` | `on` |

- **`system` stays live.** It follows the browser or operating system and changes when they do;
  the stored value stays `system`.
- **`shortcuts`** is the person's own switch for the app's keyboard shortcuts (WCAG 2.1.4). Off,
  no key is a shortcut. The panel shows it under "Keyboard", with a "View shortcuts" button that
  opens the list of every shortcut on the page; an app that has turned shortcuts off
  (`provideShortcuts({ enabled: false })`) shows neither.
- **Motion has no "full".** Where the operating system asks for less motion, the browser and
  Angular Material hold back on their own; nothing here can make them move again.
- **An app can change the defaults:** `provideSettings({ defaults: { theme: 'light' } })`.

```ts
const settings = inject(SettingsService);
settings.settings(); // what the person chose: AppSettings
settings.dark(); // resolved: system preference taken into account
settings.moreContrast();
settings.reducedMotion();
settings.language(); // the language code in use
settings.textScale(); // 1, 1.125, 1.25 or 1.5
settings.update({ theme: 'dark' }, { x, y }); // the reveal opens from that point
settings.reset(); // back to the defaults; the stored choice is forgotten
```

## From the keyboard

`provideSettings` also registers the app's own shortcuts (`settings.shortcuts.ts`), there on
every page: **A** six times in a quick run, then `D` dark theme, `L` the next language, `T` the
next text size, `C` compact density, `K` more contrast, `F` full screen, `S` this panel. Each
goes through `settings.update`, so it is saved like a change made in the panel, and said as it
is made. See the [shortcuts README](../shortcuts/README.md).

## How a setting reaches the page

The service writes each one on `<html>`; the stylesheets do the rest.

| On `<html>` | Styled in |
| --- | --- |
| class `dark` | `styles/_dark.scss` |
| `data-text-size`, `data-font`, `data-text-spacing`, `data-density`, `data-motion`, `data-contrast` | `styles/_preferences.scss` |
| `lang` | set by `I18nService.use()` |

- **Stored** in `localStorage` under `storageKey`. Other open tabs follow a change. A stored
  value that isn't one of the choices is dropped.
- **No light flash.** A short inline script in `index.html` adds `dark` before the first paint.
  It reads the same key and assumes the default theme is `system`: change it along with either.
  Under a strict content security policy, allow it by hash or move it to a file.
- **The readable font** is fetched (`readableFontUrl`, Google Fonts by default) the first time
  it is chosen. An app that serves the font itself sets `readableFontUrl: null` and the
  `--readable-font-family` custom property.
- **The theme reveal** (a circle opening from the control that was used) runs where the browser
  has view transitions and motion isn't reduced. Elsewhere the theme changes at once.

## Dark mode in your own code

`_dark.scss` flips Tailwind's colour scale under `html.dark`: 50 trades places with 950, white
becomes the surface and black the text. So ordinary classes need nothing extra:

```html
<div class="bg-white text-gray-700 border border-black/10">…</div>      <!-- already dark-ready -->
<p class="bg-red-50 text-red-800">…</p>                                 <!-- reads in both -->
```

- **Angular Material** follows `color-scheme`; its tokens are `light-dark()` values.
- **What must not flip** uses `always-white` / `always-black` (`tailwind.css`): a scrim, a
  video's backdrop, the "paper" a PDF or a spreadsheet is shown on. Use them for nothing else.
- **`dark:`** is bound to the class, for the rare case the flip isn't what you want.
- **Avoid** hard-coded hex colours and `opacity` below what keeps 4.5:1 on text: neither follows
  the theme or the contrast setting.

## Text that grows

Text size scales the root font size, so anything in `rem` grows together. Three things keep a
layout whole at 150%, wide spacing or a longer translation:

- **Sizes in `rem`,** not `px`. An icon given a text size needs its box in the same unit:
  `class="!size-6 !text-base"`, and a line height no taller than the box
  (`!size-4 !text-base !leading-4`). A `mat-icon` hides what overflows its box.
- **No fixed heights around text.** Material's text buttons grow with a wrapped label here
  (`_preferences.scss`); give your own containers `min-height`, not `height`.
- **Something scrolls.** A box that can't grow should scroll, not clip: the data grid scrolls as
  a whole when its pane is too short for its toolbar, rows and paginator.

Breakpoints are viewport widths and don't move with the text size. The layout's sidebar does turn
into a drawer earlier (`LayoutService` multiplies its breakpoint by `textScale()`). Browser zoom
remains the full-fidelity way to enlarge a page.

## Accessibility of the panel

- Each setting with choices is a radio group in a `<fieldset>`; each on/off setting is a switch.
  Every control has a visible label, and a hint tied to it.
- "View shortcuts" closes the sheet before it opens the list, so the list is of the page's
  shortcuts and not of what a dialog leaves in reach.
- The sheet is a dialog: focus moves in, Tab stays inside, Esc closes and focus returns to the
  button.
- A change is announced politely ("Theme: Dark").
