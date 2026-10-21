# Panel Mototaxis

Admin panel for the mototaxi dispatch system (spec §12). React + Vite SPA,
Spanish (es-BO), talking to the FastAPI backend in `Documentos/Projects/mototaxi`.

## Requirements

- Node 20.19+ (or 22.12+)
- The backend running on `http://localhost:8000` for anything past the login screen

## Getting started

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` to the backend, so development is same-origin like
production. That keeps the auth cookies first-party in every environment and
means CORS is never configured anywhere.

## Scripts

| Script               | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Dev server with the `/api` proxy              |
| `npm run build`      | Typecheck, then production build into `dist/` |
| `npm test`           | Vitest suite (MSW-backed; no backend needed)  |
| `npm run test:e2e`   | Playwright two-tenant smoke (API mocked)      |
| `npm run test:watch` | Same, in watch mode                           |
| `npm run typecheck`  | `tsc --noEmit`                                |
| `npm run lint`       | ESLint                                        |
| `npm run format`     | Prettier                                      |

## How it fits together

- **Auth is cookie-based.** The backend sets httpOnly `access_token` /
  `refresh_token` cookies, so no token is ever readable from JS. Session state
  comes from `GET /users/me` on mount — the server is the only thing that can
  answer whether the session is still valid.
- **One 401 → one refresh.** `api/client.ts` retries the original request once
  after a silent refresh. A failed refresh is terminal and ends the session;
  the refresh call is excluded from 401 handling, so no loop is reachable.
  Concurrent 401s share a single in-flight refresh.
- **Polling, not websockets.** The backend has no push channel. Live trips
  refresh every 10 s, vehicle positions 15 s, drivers 30 s, dashboard 60 s.
  Polling pauses while the tab is hidden.
- **Times render in `America/La_Paz`.** The API returns UTC; the browser's own
  zone would misreport when a trip happened. Date filters are converted to
  explicit UTC instants for the same reason.
- **Phones and CIs are masked** in tables with a per-row reveal (spec §12.1).
  The CSV export is the other sanctioned way to see full values, and it says so
  before you click it.

### Tenants, roles and cities

The backend is multi-tenant. The panel adapts to who signed in (`GET /users/me`
carries `role`, `tenant_id`, `city_uuids`):

| Role           | Reaches                                                           |
| -------------- | ----------------------------------------------------------------- |
| `SUPERADMIN`   | Everything, plus tenants, WhatsApp numbers, platform usage/audit. |
| `TENANT_ADMIN` | Their tenant: fleet, dispatch, settings, vehicle types, cities.   |
| `CITY_ADMIN`   | Their cities (list/edit); no settings, no access grants.          |
| `OPERATOR`     | The operational screens; no admin pages.                          |

- **Route gating** is `auth/RequireRole` with the sets in `auth/roles.ts`,
  mirroring the backend dependencies (`SuperUser`, `TenantAdminUser`,
  `AnyAdminUser`). The backend enforces; the panel only hides what would 403.
  `auth/role-matrix.test.tsx` pins route × role.
- **Act as (superadmin).** The header switcher sends `X-Tenant-Id` on every
  request (`api/client.ts` → `setActAsTenant`). A banner stays visible while
  acting. Without a tenant selected a superadmin sees read-only cross-tenant
  data; writes that need a tenant fail on the server. The choice lives in memory
  only, so a reload starts unscoped. Switching **resets the query cache**
  (`resetQueries`, not `clear`: mounted views must refetch) —
  `auth/tenant-switch.test.tsx` pins that no row of the previous tenant survives.
- **City scope.** The header city selector writes `?city=`, and the drivers,
  vehicles, customers, live-trips and trip-history views send it as the
  `city_uuid` query param (the server filters; query keys include the city).
  The map draws the selected city's geofence. Existing drivers/vehicles change
  city through _Mover de ciudad_, never the edit forms. Requires a backend with
  the `city_uuid` params (branch `feat/tenancy-p8-panel-gaps`).
- **Vehicle type on trips and the map.** Trip lists show the requested type
  (or "Cualquiera") and, when a different one arrived, "Pedido (llegó Asignado)".
  Fleet-map markers append the vehicle's type. Names come from
  `useVehicleTypeNames`.
- **Usage.** A tenant admin sees their company's 30-day usage on the dashboard
  (`GET /admin/usage` returns only their row); superadmins get the full table
  under _Plataforma_.
- **Routes.** The vehicles screens live at `/vehiculos`; `/mototaxis` redirects
  there, keeping the query string, for old bookmarks.
- **Dynamic vehicle forms.** `VehicleType.attribute_schema` drives the
  attribute inputs (`string|int|float|bool`). The server is the validator.
- **Settings** show where the effective value comes from (tenant / global /
  default) and "quitar el ajuste" calls `DELETE /admin/settings/{key}`.
- **Secrets are write-only.** The WhatsApp token is never read back or prefilled;
  a blank value on an update keeps the stored one.
- Every dynamic URL segment goes through `encodeURIComponent` (`api/admin.ts`
  `seg`): route params are decoded by the router.

### The one contract trap

`PATCH /admin/drivers/{uuid}` and `PATCH /admin/vehicles/{uuid}` disagree about
what `null` means (tenants and cities behave like drivers):

- **driver** — `null` is silently ignored; nothing can be cleared this way.
- **vehicle** — `null` clears the field, and `{device_id: null}` detaches
  the tracker and drops it from the GT06 allowlist (spec §7.2). `tracker_type`
  and `attributes` cannot be `null` (omit, or send `{}`).

`lib/dirty.ts` therefore has **two serialisers with no shared helper**, and
`lib/dirty.test.ts` pins both directions. If you add a form, do not unify them:
a helper emitting `null` for an untouched field is harmless on a driver and
destructive on a vehicle.

## Testing

MSW mocks the verified backend contract, so the suite runs without a backend.
Unhandled requests fail the suite deliberately — a view quietly calling an
endpoint the contract does not define should not fall through to the network.

Default fixtures and handlers live in `src/test/`; individual tests override
them with `server.use(...)`.

## Deployment

The API container serves the built SPA, so there is one origin, one deploy,
first-party cookies, and no CORS. CI builds this repo, then copies `dist/` into
the API image (multi-stage Dockerfile with a Node stage).

Backend-side requirements, if not already in place:

- Register `/api/*`, `/webhook/*`, `/internal/*` and the sqladmin mount **before**
  the SPA catch-all, or the catch-all swallows them.
- Unknown non-API paths return `index.html` so client-side routes survive a
  refresh; an unknown `/api` path must still 404 as JSON, never HTML.
- Hashed assets get a long `Cache-Control`; `index.html` must be `no-cache`, or
  browsers pin a stale build referencing deleted asset hashes.

### End-to-end smoke

`npm run test:e2e` drives the real SPA in Chromium (port 5199, not the shared 5173) with the API mocked at the network edge: a superadmin acts as one company,
then another, and the rows and banner follow. First run needs
`npx playwright install chromium`.
