# Mototaxi Admin Panel — Frontend Implementation Plan

**Target:** React + Vite SPA implementing spec §12 (Admin Panel) of
`especification_mototaxis.md` v2.0.
**Repo:** `mototaxi_front` (currently empty).
**Backend:** `Documentos/Projects/mototaxi` — FastAPI. Admin API complete:
`controllers/dispatch_admin.py` (live board, history, KPIs, alerts, customers)
and `controllers/fleet.py` (driver + vehicle CRUD).
**Status:** backend verified 2026-07-20, suite green. Frontend not started —
next action is step 1, scaffold.

---

## 1. Verified backend contract

All routes are mounted under `settings.api_v1_str` (default `/api/v1`).

### Auth — `modules/users`

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/users/login` | **OAuth2 password form** (`application/x-www-form-urlencoded`, fields `username` = email, `password`). Returns `{access_token, refresh_token, token_type}` **and** sets httpOnly cookies `access_token` / `refresh_token`. Rate-limited. |
| POST | `/api/v1/users/refresh` | Body `{refresh_token}` optional — falls back to the cookie. |

`deps.py::_resolve_token` accepts a `Bearer` header **or** the `access_token`
cookie. Decision: **use the cookies** (`credentials: "include"`), do not persist
tokens in `localStorage`.

**Confirmed: frontend and backend ship on the same host.** Cookies are therefore
first-party (`SameSite=Lax`), and no CORS configuration is needed in production.
In development the Vite proxy forwards `/api` to `localhost:8000`, keeping the
browser on one origin there too — so the cross-site cookie path never exists in
any environment.

An admin account is confirmed seeded, so step 3 is unblocked.

### Admin — `/api/v1/admin/*` (all require an admin identity)

| Method | Path | Response |
|---|---|---|
| GET | `/mototaxis` | `MototaxiSummary[]` (list shape — detail is fuller, see fleet section) |
| GET | `/trips/active` | `TripSummary[]` |
| GET | `/trips/history?since&until&limit` | `TripSummary[]` (limit ≤ 1000, default 200) |
| GET | `/trips/history.csv?since&until&limit` | `text/csv` attachment |
| POST | `/trips/{trip_uuid}/cancel?reason` | 204; **409 if already terminated** |
| GET | `/kpis` | `KPIResponse` |
| GET | `/alerts` | `AlertsResponse` |
| GET | `/customers?include_blocked` | `CustomerSummary[]` |
| POST | `/customers/{customer_uuid}/block?reason` | 204 |
| POST | `/customers/{customer_uuid}/unblock` | 204 |

Payload shapes (from `schemas/dispatch.py` — mirror these exactly in TS):

```ts
type TripSummary = {
  trip_uuid: string; status: string;
  customer_phone: string | null; driver_name: string | null; plate_number: string | null;
  pickup_address: string | null; destination_address: string | null;
  reach_time_seconds: number | null; reach_time_source: string | null;
  completion_source: string | null; cancelled_by: string | null;
  rating: number | null; created_at: string; ended_at: string | null;
};
type MototaxiSummary = {
  mototaxi_uuid: string; plate_number: string; status: string;
  lat: number | null; lon: number | null; location_updated_at: string | null;
  is_tracker_stale: boolean; current_driver_uuid: string | null;
};
type CustomerSummary = {
  customer_uuid: string; phone_whatsapp: string; name: string | null;
  trip_count: number; cancel_count: number; average_rating_given: number | null;
  is_blocked: boolean; last_message_at: string | null;
};
type KPIs = {
  trips_today: number; trips_completed_today: number; trips_cancelled_today: number;
  trips_no_driver_today: number; average_reach_time_seconds: number | null;
  average_rating: number | null; drivers_available: number; drivers_without_checkin: number;
};
type Alerts = {
  failed_actions: number; stale_trackers: number; overdue_trips: number;
  auto_completed_trips: number; drivers_without_checkin: number;
};
```

### Fleet CRUD — complete and verified 2026-07-20

`controllers/fleet.py` + `schemas/fleet.py`, two routers under `/api/v1/admin`.
All use cases registered in `modules/fleet/infrastructure/ioc.py`. Full suite
**1909 passed, 19 skipped, 1 xfailed**; 120 fleet-module tests green.

| Method | Path | Returns | Errors |
|---|---|---|---|
| POST | `/admin/drivers` | 201 `Driver` | 409 duplicate, 404 unknown mototaxi |
| GET | `/admin/drivers?status=` | `Driver[]` | — |
| GET | `/admin/drivers/{uuid}` | `Driver` | 404 |
| PATCH | `/admin/drivers/{uuid}` | `Driver` | 404, 409 duplicate phone |
| PATCH | `/admin/drivers/{uuid}/status` | `Driver` | 404, 409 forbidden transition |
| PATCH | `/admin/drivers/{uuid}/mototaxi` | `Driver` | 404, 409 mid-trip / vehicle taken |
| DELETE | `/admin/drivers/{uuid}?reason=` | 204 (soft — disables) | 404, 409 mid-trip |
| POST | `/admin/mototaxis` | 201 `Mototaxi` | 409 duplicate plate/IMEI |
| GET | `/admin/mototaxis/{uuid}` | `Mototaxi` | 404 |
| PATCH | `/admin/mototaxis/{uuid}` | `Mototaxi` | 404, 409 duplicate plate/IMEI |
| PATCH | `/admin/mototaxis/{uuid}/status` | `Mototaxi` | 404, 409 driver mid-trip |

```ts
type Driver = {
  driver_uuid: string; name: string; ci: string; phone_whatsapp: string;
  license_number: string | null; status: DriverStatus;
  current_mototaxi_uuid: string | null;
  offer_accepted_count: number; offer_declined_count: number;
  offer_timeout_count: number; trips_completed: number;
  average_response_seconds: number | null; acceptance_rate: number | null;
  resting_until: string | null; last_checkin_at: string | null;
  has_checked_in_today: boolean; created_at: string;
};
type Mototaxi = {                    // detail shape; the list returns MototaxiSummary
  mototaxi_uuid: string; plate_number: string;
  brand: string | null; model: string | null; tracker_imei: string | null;
  status: MototaxiStatus; lat: number | null; lon: number | null;
  location_updated_at: string | null; location_source: string | null;
  current_driver_uuid: string | null; is_tracker_stale: boolean;
  notes: string | null; last_maintenance_at: string | null; created_at: string;
};
type DriverStatus = 'AVAILABLE' | 'IN_TRIP' | 'RESTING' | 'OFFLINE' | 'DISABLED';
type MototaxiStatus = 'AVAILABLE' | 'DISABLED' | 'OUT_OF_SERVICE';
```

**The two PATCH verbs do not mean the same thing.** This is the sharpest edge in
the whole contract:

- `PATCH /admin/drivers/{uuid}` — `UpdateDriverDTO` treats `None` as "leave
  unchanged". Sending `null` is **silently ignored**; nothing on a driver can be
  cleared this way.
- `PATCH /admin/mototaxis/{uuid}` — `UpdateMototaxiDTO` uses an `_UNSET`
  sentinel, so `null` **clears the field**. `{"tracker_imei": null}` detaches the
  tracker and drops that IMEI from the GT06 allowlist (§7.2).

Both controllers forward only keys present in the request body
(`model_fields_set`), so **send dirty fields only, never a full object**. Do not
share one form-serialisation helper between the driver and vehicle forms — the
same helper emitting `null` for an untouched field is harmless on a driver and
destructive on a vehicle.

**Other contract notes:**

- `GET /admin/drivers` moved from `dispatch_admin.py` to `fleet.py`;
  `DriverSummaryResponse` was deleted. There is now **one** driver shape.
- Mototaxis remain asymmetric by design: `GET /admin/mototaxis` (in
  `dispatch_admin.py`) returns `MototaxiSummary` for the live map, the detail
  route returns the fuller `Mototaxi` the edit form needs. Two types; do not try
  to unify them. The CRUD screen fetches detail per row on demand — ten rows, so
  the N+1 is irrelevant here.
- `PATCH /drivers/{uuid}/status` is the **only** route out of `DISABLED`
  (`entities.py:47` permits `DISABLED → AVAILABLE`). The delete endpoint retires,
  this restores. Both write a `driver_status_log` row in the same transaction.
- `resting_until` is rejected with 422 unless `status = RESTING` — deliberate, so
  a caller expecting an automatic return is never silently ignored. The rest form
  must only offer the expiry field for that status.
- `PATCH /drivers/{uuid}/mototaxi` takes `{mototaxi_uuid: string | null}`, field
  **required**: `null` detaches, `{}` is a 422. Detach is always explicit.
- `changed_by=ADMIN` is set server-side and is not a client field.

Because the driver list carries `ci` and unmasked phones on every poll, the
masking rule in §4 extends to `ci`.

**Not exposed, out of phase 1:** service-hours configuration (§13). Vehicle
status changes have no audit trail — accepted, since they only ever happen by
explicit admin action; an IMEI-change log line is a pending nice-to-have.

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Build | Vite + React 18 + TypeScript | Spec §12.1: React + Vite, no Next.js. |
| Styling | Tailwind CSS | Spec §12.1. |
| Server state | TanStack Query | Polling, cache invalidation, and retry are the whole app; hand-rolling them is the main source of bugs in a dashboard. |
| Routing | React Router | Five views + login. |
| Forms | Native + zod | Only two real forms (login, date range). |
| Map | Leaflet + react-leaflet, OSM tiles | Matches the project's OSM/OSRM stack, no API key, no billing. |
| Tests | Vitest + Testing Library + MSW | MSW mocks the contract above, so tests do not need the backend running. |
| Lint | ESLint + Prettier | Match the backend repo's pre-commit discipline. |

Deliberately excluded: Redux (TanStack Query covers it), a component library
(five tabular screens), i18n framework (single locale — es-BO strings live in
one `strings.ts`).

**UI language is Spanish (es-BO)**, consistent with the rest of the system.

---

## 3. Structure

```
src/
  main.tsx, App.tsx
  api/
    client.ts          # fetch wrapper: base URL, credentials:'include', error mapping
    auth.ts            # login (form-encoded), refresh, logout
    admin.ts           # one typed fn per admin endpoint
    types.ts           # the types above
  auth/
    AuthProvider.tsx   # session state, 401 → redirect to /login
    RequireAuth.tsx
  components/
    DataTable.tsx      # sortable/filterable table, used by 4 views
    StatusBadge.tsx    # trip/driver/mototaxi status → colour + label
    KpiCard.tsx, AlertBanner.tsx, ConfirmDialog.tsx, EmptyState.tsx, ErrorState.tsx
  views/
    Login.tsx
    Dashboard.tsx      # KPIs + alerts
    Mototaxis.tsx      # table + Leaflet map, stale-tracker badge
    Drivers.tsx        # metrics, "sin check-in hoy" badge
    LiveTrips.tsx      # 10s poll, force-cancel
    TripHistory.tsx    # date range, CSV export, AUTO-completion flag
    Customers.tsx      # block/unblock
  lib/
    format.ts          # dates in America/La_Paz, durations, phone masking
    strings.ts         # es-BO UI catalog
```

`format.ts` renders every timestamp in `America/La_Paz` via `Intl.DateTimeFormat`
with an explicit `timeZone`. The API returns UTC ISO strings; rendering in the
browser's local zone would silently mislead an operator abroad.

---

## 4. Cross-cutting decisions

**Polling, not websockets.** The backend has no push channel. Intervals via
TanStack Query `refetchInterval`: live trips 10 s, mototaxi positions 15 s,
KPIs/alerts 60 s, drivers 30 s, history/customers on demand. Polling pauses when
the tab is hidden (`refetchIntervalInBackground: false`) — ten motos do not need
a tab burning requests overnight.

**401 handling.** The API client attempts one silent `/users/refresh` on a 401,
retries the original request once, and on a second failure clears session state
and redirects to `/login`. No refresh loop: a failed refresh is terminal.

**409 on force-cancel** means the trip terminated between render and click.
Surface "El viaje ya terminó", refetch the live board — never a generic error toast.

**Privacy.** Spec §12.1: no bulk raw phone lists without an explicit export
action. Customer and trip tables mask the phone middle digits (`+591····5678`)
with a per-row reveal; CSV export (which contains full numbers) stays behind the
existing deliberate download action.

**Destructive actions** (force-cancel, block) go through `ConfirmDialog` naming
the specific trip or customer.

---

## 5. Work order

Each step ends runnable and reviewable.

0. ~~**Backend: fleet CRUD, driver status change, mototaxi assignment**~~ —
   **done and verified 2026-07-20. Nothing in the API now blocks the frontend.**
0b. **Backend: serve the SPA** — static mount + fallback per §6. Lands in
   parallel with frontend steps 1–3; needed before the first real deploy. ~2 h
1. **Scaffold** — Vite TS, Tailwind, ESLint/Prettier, Vitest, path aliases,
   `.env` (`VITE_API_BASE_URL`), Vite dev proxy `/api` → `localhost:8000` so dev
   is same-origin like production. ~2 h
2. **API layer + types** — `types.ts` transcribed from the schemas above,
   `client.ts` with credentials and error mapping, one typed function per
   endpoint, MSW handlers with fixtures. ~3 h
3. **Auth** — Login view (form-encoded POST), `AuthProvider`, `RequireAuth`,
   refresh-on-401, logout. Tests: happy path, bad credentials, expiry redirect. ~3 h
4. **Shell + Dashboard** — Layout, nav, `DataTable`, `StatusBadge`, KPI cards,
   alerts banner (each non-zero alert links to its filtered view). ~4 h
5. **Fleet views** — Mototaxis (table + map, stale-tracker badge) and Drivers
   (metrics, check-in badge, filter "sin check-in"). ~5 h
6. **Live Trips** — 10 s poll, status column, reach-time with `STRAIGHT_LINE`
   marked as an estimate, force-cancel with confirm + 409 handling. ~4 h
7. **History + export** — Date range (default today, La Paz), pagination against
   the 1000 cap, CSV download, `completion_source='AUTO'` flagged for review. ~4 h
8. **Customers** — Table, masked phones, block/unblock with reason. ~3 h
9. **Fleet CRUD screens** — Driver register/edit forms, status change, mototaxi
   assignment, mototaxi register/edit. Consumes step 0. ~6 h
10. **Polish + build** — Loading skeletons, error/empty states, responsive check
    (the owner will use a phone), README, `npm run build` verified. ~4 h

**Total ≈ 38 h frontend + 6 h backend.** Spec §22 budgeted ~24 h for week 5, but
that line also covered the DeepSeek layer and feedback flow (backend, already
built) and did not separately price fleet CRUD.

---

## 6. Deployment — single host

Spec §12.3: `https://admin.<domain>`, HTTPS + HSTS. **The API container serves
the built SPA**, so there is one origin, one deploy, first-party cookies, and no
CORS anywhere.

Backend changes required (small, but they are real work — fold into step 0):

- Mount the build in `src/main.py`. Route order matters: `/api/*`, `/webhook/*`,
  `/internal/*`, and the sqladmin mount must all be registered **before** the
  SPA catch-all, or the catch-all swallows them.
- SPA fallback: unknown non-API paths return `index.html` so client-side routes
  survive a page refresh. A genuinely unknown `/api` path must still 404 as JSON
  — never return HTML to a fetch caller.
- Hashed assets get long `Cache-Control`; `index.html` must be `no-cache`, or
  browsers pin a stale build that references deleted asset hashes.
- Add HSTS and the security headers (§16.1) at the app or load-balancer layer.

Build wiring: the two repos stay separate, so CI builds `mototaxi_front`, then
copies `dist/` into the API image at build time (multi-stage Dockerfile with a
Node stage). Version the frontend by the same commit that produced it.

CI (§17.3): on PR run lint + `tsc --noEmit` + tests; on merge build the SPA,
bake it into the API image, deploy by digest.

---

## 7. Resolved

1. **Hosting** — same host, API container serves the SPA. No CORS anywhere.
2. **Admin account** — seeded, confirmed.
3. **Fleet CRUD** — backend done first, verified. All routes in §1.
4. **`tracker_imei` editable?** — yes, via `PATCH /admin/mototaxis/{uuid}`, with
   uniqueness re-checked on edit. The UI must treat it as a deliberate action:
   its own confirm step, never a field the operator tabs through, and `null`
   (detach) spelled out rather than reachable by clearing an input.
5. **Vehicle audit log** — not built. Vehicle status only changes by explicit
   admin action and the current state is self-evident, so a table is not worth
   it. Accepted.

## 8. Still open

- **IMEI change log line** (backend, ~15 min): `UpdateMototaxiUseCase` emits
  nothing when an IMEI is repointed, so there is no record that the GT06
  allowlist changed. Structured log via the existing logfire wiring — old IMEI,
  new IMEI, vehicle uuid — is enough; a table only if it is ever queried.
- **Missing test** (backend): nothing walks `DISABLED → AVAILABLE` end to end.
  The transition table permits it and the route maps it, but that round-trip is
  what spec §10.4 requires and it is the one path with no test pinning it.
- **Flaky test** (backend, pre-existing, unrelated):
  `test_dispatch_flow.py::TestSchedulerTick::test_an_offer_timeout_ends_the_search_when_nobody_is_left`
  fails under `-x`, passes isolated and in a full run. Order-dependent shared DB
  state.
- **Service-hours configuration** (§13) — no API, no UI. Out of phase 1.
