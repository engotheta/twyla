# Studio

An Angular 21 starter built from reusable parts: an app layout with route-driven menus, session
pages and guards, and config-driven components (data grid, generic form, details, contents view,
file viewer, action buttons). Tailwind v4 and Angular Material for styling; Vitest for unit tests.

```bash
npm start        # ng serve, http://localhost:4200
npm test         # ng test (Vitest)
npm run build    # production build into dist/
```

Sign in with the demo account `emilys` / `emilyspass` (dummyjson.com).

## Project structure

```
src/
├─ index.html  main.ts  styles.scss  tailwind.css
├─ styles/                  global Sass partials (design tokens)
└─ app/
   ├─ app.ts  app.config.ts  app.routes.ts
   ├─ configs/              app wiring that app.config.ts reads (today: the demo's)
   ├─ utils/                helpers and pipes that several features share
   ├─ services/             app-wide features: fetch, loading, notification, session, view
   ├─ components/           reusable UI, one folder each
   ├─ layout/               the app frame: layout, header, sidebar, menu, page-header, auth-layout
   └─ routes/               pages, grouped into modules
```

Each folder under `components/` and `services/` is a **feature**. Its `index.ts` lists what it
offers, and its `README.md` or `SPEC.md`, where it has one, explains how to use it:

- [`layout/README.md`](src/app/layout/README.md): adding a module, menu entries, layout config.
- [`services/session/README.md`](src/app/services/session/README.md): the session API, guards and
  token storage.
- [`components/generic-form/README.md`](src/app/components/generic-form/README.md) and
  [`SPEC.md`](src/app/components/generic-form/SPEC.md).
- [`components/data-grid/SPEC.md`](src/app/components/data-grid/SPEC.md).
- [`components/file-viewer/README.md`](src/app/components/file-viewer/README.md).

## Rules

1. **Layers, one direction only.** A folder imports from the ones before it in this list, never
   from the ones after: `utils`, `services`, `components`, `layout`, `configs`, `routes`,
   `app.*.ts`. Type-only imports are exempt.
2. **Part folders.** Inside a feature, a sub-component gets its own folder once it has two or more
   source files (class plus template, styles, or helpers of its own). One-file parts sit flat.
3. **Kind folders.** A feature with three or more interface files, or three or more helper and
   constant files, keeps them in `interfaces/` and `helpers/`. Fewer stay at the feature's root.
4. **Specs** sit beside their source as `<source>.spec.ts` and don't count towards rules 2 and 3.
   A spec that covers a group of files is named for the group (`auth-pages.spec.ts`).
5. **File suffixes** say what a file holds:

   | Suffix | Holds |
   | --- | --- |
   | `.component.ts` (+ `.html`, `.scss`) | a component |
   | `.page.ts` | a routed page |
   | `.module.ts` | a route module's shell: it sets the side menu and renders the layout |
   | `.routes.ts` | a route list |
   | `.service.ts` `.directive.ts` `.pipe.ts` `.token.ts` | one of each |
   | `.interface.ts` | types |
   | `.helpers.ts` `.constants.ts` | pure functions, constants |
   | `.guards.ts` `.interceptor.ts` `.api.ts` `.forms.ts` | route guards, an HTTP interceptor, a backend adapter, form configs |
   | `.demo.ts` | the config a demo page feeds its component |

   A file that is one named thing may go without a suffix (`validators.ts`,
   `viewer-controller.ts`).

6. **Selectors and classes.** No prefix; the selector matches the file name
   (`data-grid.component.ts` is `<data-grid>`). Pages end in `-page` / `Page`, shells in `-shell` /
   `Shell`. Two exceptions: `<all-details>` (a bare `<details>` is a native element) and the root
   `app.ts`, which keeps the CLI's name.
7. **Imports.** Relative inside a unit, an alias across units. The units are each
   `components/<name>`, each `services/<name>`, and `layout`, `utils`, `configs`, `routes`. The
   aliases are `@components/*`, `@services/*`, `@layout`, `@utils` and `@configs/*`.
   - Pages import a feature through its barrel: `@components/data-grid`.
   - Features import each other file by file where the barrel would close an import cycle or load
     code the importer doesn't use. data-grid, for one, takes details' helpers from
     `@components/details/helpers/…`.
   - `app.config.ts` and `app.routes.ts` import files, never barrels, so lazy code stays out of
     the initial bundle.

`ng generate` follows rules 5 and 6: the schematics defaults are set in `angular.json`.

## Starting an app from this

- **Brand, user menu, footer:** `provideLayoutConfig` in `app.config.ts`.
- **Backend sign-in:** write a `SessionApi` and pass it to `provideSessionConfig`.
- **Modules:** add `routes/<module>/` and its entry in `app.routes.ts`; see the layout README.
- **Remove the demos:** delete `routes/components-demo/`, `routes/layout-demo/`,
  `routes/shared/demo-log.component.ts`, `routes/shared/applog.ts` and the files in `configs/`,
  then drop their entries from `app.routes.ts` and `app.config.ts`.
