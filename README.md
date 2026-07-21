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

### The one contract trap

`PATCH /admin/drivers/{uuid}` and `PATCH /admin/mototaxis/{uuid}` disagree about
what `null` means:

- **driver** — `null` is silently ignored; nothing can be cleared this way.
- **mototaxi** — `null` clears the field, and `{tracker_imei: null}` detaches
  the tracker and drops it from the GT06 allowlist (spec §7.2).

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
