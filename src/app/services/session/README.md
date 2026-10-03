# Session

The signed-in user as signals, the calls the auth pages make, route guards, and the bearer-token
interceptor.

```ts
// app.config.ts
provideHttpClient(withFetch(), withInterceptors([sessionInterceptor])),
provideSessionConfig(() => ({
  api: myAuthApi(inject(HttpClient)), // your backend, as a SessionApi
  tokenUrls: [environment.apiUrl], // only these requests get the token
  loginUrl: '/auth/login',
  homeUrl: '/modules',
})),
```

```ts
const session = inject(SessionService);
session.user(); // SessionUser | null
session.isAuthenticated();
session.hasPermission(['REPORTS_MODULE']); // any one of them
session.canAccess({ permissions, visibleFor }); // what LayoutConfig.canAccess calls
await session.login({ username, password }, remember);
await session.logout(); // clears, tells the API, goes to loginUrl
```

## The API

`SessionApi` is the only part an app writes. Each method may return a `Promise` or an `Observable`:

| Method | |
| --- | --- |
| `login({ username, password })` | Returns `{ user, tokens: { accessToken, refreshToken?, expiresAt? } }`. Throw a `SessionError` for messages meant for the user, such as wrong credentials. |
| `me?(tokens)` | Returns the user behind stored tokens. It runs in the background at start-up: a 401 or 403 ends the session, while being offline keeps it. |
| `register(value)` | Receives the sign-up form's value. |
| `forgotPassword({ email })` | May return `{ demoResetUrl }` (demos only). |
| `resetPassword({ token, password })` | |
| `logout?(session)` | Best effort; the local session is cleared regardless. |

`createFakeSessionApi()` runs entirely in the browser, for demos, tests and backends that don't
exist yet. The studio signs in for real against dummyjson.com
(`configs/dummyjson-session.api.ts`) and fakes the rest.

## Guards

| | |
| --- | --- |
| `authGuard` | Signed-in users only; everyone else goes to `loginUrl?returnUrl=…`. Use it as `canActivate` and `canActivateChild`. |
| `guestGuard` | Sign-in and sign-up pages: signed-in users go to `homeUrl`. |
| `permissionGuard` | The route's `data.permissions` / `data.visibleFor`. A refused user goes to `homeUrl` with a notice. Put it after `authGuard`. |

`safeReturnUrl(url)` lets only in-app paths through, so a crafted `?returnUrl=//evil.example`
goes nowhere.

## Storage

- **Where the session is kept:** in `localStorage` when the user asks to stay signed in, otherwise
  in `sessionStorage`. Tabs stay in step: signing out in one tab sends the others on protected pages
  to the sign-in page.
- **Expiry:** a stored session past `expiresAt` is dropped at start-up.
- **Not built yet:** refresh tokens. Add them in `SessionApi` / the interceptor when the backend
  issues them.
- **XSS exposure:** tokens in web storage can be read by any script that runs on the page, so an
  XSS bug exposes them. When the backend can set httpOnly cookies, prefer those: `login` then only
  returns the user, and `tokenUrls` stays empty.
