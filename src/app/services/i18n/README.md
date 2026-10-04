# i18n

The language the app is showing, and every feature's built-in text in it. Typed message objects,
no dependency, and switching is live: text is read through signals.

```ts
// app.config.ts
provideHttpClient(withFetch(), withInterceptors([sessionInterceptor, languageInterceptor])),
provideI18n({
  languages: [
    { code: 'en', name: 'English', locale: 'en-GB' },
    { code: 'sw', name: 'Kiswahili', locale: 'sw-TZ' },
  ],
}),
```

```ts
const i18n = inject(I18nService);
i18n.language(); // 'sw'
i18n.locale(); // 'sw-TZ': what dates and numbers are formatted with
i18n.use('en'); // switches, and sets <html lang>; false for a language the app doesn't offer
```

The user's choice of language is one of the [settings](../settings/README.md), which call
`use()`. Without `provideI18n` the app is English only.

## A feature's text

Each feature keeps its text in `<feature>.messages.ts`, English first, and each other language
in `<feature>.messages.<code>.ts`:

```ts
// grid.messages.ts
export const GRID_EN = {
  clearSearch: 'Clear search',
  remove: (name: string) => `Remove ${name}`, // text built from a value is a function
  toolbar: { export: 'Export', columns: 'Column settings' },
};
export type GridMessages = typeof GRID_EN;
export const GRID_MESSAGES = defineMessages('data-grid', GRID_EN, { sw: GRID_SW });

// grid.messages.sw.ts
export const GRID_SW: GridMessages = {
  clearSearch: 'Futa utafutaji',
  remove: (name) => `Ondoa ${name}`,
  toolbar: { export: 'Hamisha', columns: 'Mipangilio ya safu wima' },
};
```

```ts
// a component
protected readonly t = injectMessages(GRID_MESSAGES);
```

```html
<button [attr.aria-label]="t().clearSearch">…</button>
<span>{{ t().remove(name()) }}</span>
```

- **A missing key fails the build.** The translation is typed as the English shape.
- **Counts and values are functions,** so each language words its own plurals and order.
- **A function that returns only literals needs `: string`** (`(many: boolean): string => …`).
  Otherwise its return type is the English literals and no translation fits it.
- **Outside a component:** `inject(I18nService).messages(BUNDLE)()` in a service or a helper
  that has an injector. A pure helper takes the text as an argument, defaulting to the English
  (`formatCellValue(value, type, locale, text = GRID_EN.format)`).
- **What stays on screen follows the language.** Keep what was said as a pick from the
  messages, not as a string: the file viewer keeps a failure as `(text) => text.pdf.damaged`,
  the session pages keep the error and word it in a `computed`.

`app.messages.spec.ts` checks every bundle: each language has every message, and none is left
identical to the English. A new `*.messages.ts` goes in its list.

## An app's own wording

```ts
provideMessages(GRID_MESSAGES, {
  sw: { clearSearch: 'Ondoa utafutaji' }, // other wording
  fr: { clearSearch: 'Effacer la recherche' }, // a language the feature doesn't ship
  en: { toolbar: { export: 'Download' } }, // rewording the English
}),
```

Whatever is left out keeps the feature's own text; a language with gaps shows English there.

## Names written where they are used

Route titles, menu names, module descriptions and the layout config's text are written once, in
English, in the routes and in `app.config.ts`. Their other languages live in one file:

```ts
// configs/route-names.ts
export const ROUTE_NAMES: Phrases = {
  sw: { 'Data grid': 'Jedwali la data', Profile: 'Wasifu' },
};

// app.config.ts → provideLayoutConfig
translate: injectPhrases(ROUTE_NAMES),
```

The layout passes every such name through `translate` before showing it, so menus, breadcrumbs,
the module rail and the document title follow the language. A name with no entry is shown as
written. `app.messages.spec.ts` checks that every route and menu name has an entry, and that no
entry is left over.

## Dates, numbers and the backend

- **Formatting** uses `i18n.locale()`: grid cells, details values, the date field, the paginator.
- **Angular Material's own labels** (paginator, date picker, stepper) are `provideMaterialIntl()`,
  in the `providers` of the component that renders one. The data grid and the generic form
  already have it.
- **`languageInterceptor`** sends `Accept-Language: <locale>` so a backend can answer in the
  user's language. A header the request already set is left alone.

## Adding a language

1. Add it to `provideI18n({ languages })`.
2. Add `<feature>.messages.<code>.ts` beside each `*.messages.ts` and list it in that file's
   `defineMessages(…, { sw: …, fr: … })` — or ship the lot from the app with `provideMessages`.
3. Add its block to `configs/route-names.ts`, and its code to `LANGUAGES` in
   `app.messages.spec.ts`.

Right-to-left languages are not supported yet: the layout uses logical properties in most
places, but nothing sets `dir`.
