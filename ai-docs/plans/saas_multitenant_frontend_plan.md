# SaaS Multi-Tenant Port Plan (frontend)

Status: **F1–F7 implemented** (2026-10-21, branch `feat/tenancy-f2-vehicle-rename`; needs backend branch `feat/tenancy-p8-panel-gaps` for city filters, trip/vehicle type and tenant-admin usage). Plan was draft rev 2 (post-review) — 2026-10-19. `feat/driver-usage-credit` is already merged into `main` (PR #15); branch each phase from `main`. Companion to `mototaxi/ai-docs/plans/saas_multitenant_plan.md`
(decisions D1–D13 there). Base = **this repo (`mototaxi_front`)**; source of tenancy views =
`~/Documentos/Projects/taxi_management_front` (has uncommitted edits — commit/copy first).

Rule inherited from the old plan: a frontend phase starts only when its backend phase API is stable and tested.

## 0. Baseline differences (why this is a port, not a copy)

Current front has features the old front never saw: `Settings.tsx` (runtime settings), `PhoneKeyDialog`,
`PositionCheckDialog`, `UsageCreditDialog`, `lib/usageCredit.ts`, `lib/sim.ts`, `lib/tracking.ts`, `InfoTip`,
map vehicle labels, drivers-list UX, alerts/filters for credit. Old front has: `auth/RequireRole`, `views/tenancy/*`
(Tenants, TenantDetail, Cities, CityDetail, CityAccessManager, VehicleTypes, WhatsAppConfig), `CitySelector`,
`CityField`, `AttributeSchemaForm`, `MoveDriver/VehicleToCityDialog`, `lib/geo.ts`.
Overlapping edited files to hand-merge: `api/{admin,auth,queries,types}.ts`, `Layout.tsx`, `routes.tsx`, `FleetMap.tsx`,
`StatusBadge.tsx`, `strings.ts`, `Drivers.tsx`, `lib/dirty.ts`, `test/{fixtures,handlers}.ts`, Mototaxi* files.

## 1. Cross-cutting

| Area | Decision |
|---|---|
| Superadmin | Tenant switcher **built** this time (old plan was blocked): sends `X-Tenant-Id`; banner "Actuando como <tenant>" always visible; clears on logout. Needs backend P1 act-as. |
| City scope | `CitySelector` in header: fixed for CITY_ADMIN/OPERATOR, dropdown for TENANT_ADMIN/SUPERADMIN. City now a real filter param (backend P4 adds `city_uuid` query on lists, so no client-side filtering hack). Query keys include `tenantId` + `cityId`. |
| Role routing | `RequireRole` + route table `roles[]`, mirrors backend deps; table-driven route×role test (port `role-matrix.test.tsx`). Nav hides links the role can't use. |
| Rename | `Mototaxi→Vehicle` as its **own PR**, mechanical. UI copy says "vehículo" generically; tenant's type `display_name` ("Mototaxi", "Taxi") appears where a specific type is shown. |
| Dynamic forms | `AttributeSchemaForm` renders `VehicleType.attribute_schema`; server validates. |
| Vehicle types | Superadmin manages global types; **tenant admin manages own custom types** (new vs old). Global types read-only to tenants. |
| Geofence | Raw WKT textarea + polygon on map via `lib/geo.ts` (or `geofence_geojson` from backend P7). Draw tool = deferred. |
| Secrets | WhatsApp config: tokens write-only, never round-tripped. Superadmin-only (platform-managed numbers). |
| Timezone | `lib/format.ts` stays Bolivia (-04:00); Bolivia-only decision (D8). |
| i18n | `strings.ts` es only; new keys appended. |

## 2. Phases

### F1 — Auth, roles, tenant/city shell (after backend P1) ≈ 1.5 days
- Port `UserRole` union, `UserProfile.tenant_id/city_uuids`, `RequireRole`, `CitySelector` shell, `TenantSwitcher`.
- Merge `AuthProvider`/`routes.tsx`/`Layout.tsx` (keep Settings route; Settings gated to TENANT_ADMIN+).
- Views: `Tenants`, `TenantDetail` ("Mi empresa" for tenant admin), `Cities`, `CityDetail` (WKT), `CityAccessManager`.
- Tests: role matrix, tenancy list→detail.

### F2 — Rename PR (after backend P3a) ≈ ½ day
Mechanical `Mototaxi*→Vehicle*` incl. current-only `PhoneKeyDialog`, `PositionCheckDialog` references, `lib/sim.ts`, alias field, MSW handlers/fixtures. No behavior change.

### F3 — Vehicle types + attributes (after backend P3b) ≈ 1.5 days
- `VehicleTypes.tsx` (superadmin global + tenant admin custom), `AttributeSchemaForm` in `VehicleForm`.
- `device_id/tracker_type`; keep the "deliberate action" device-change UX; location source labels (reconcile with current phone/hand-shared/tracker labels).

### F4 — Cities in fleet screens (after backend P4) ≈ 1.5 days
- `CityField` in Driver/Vehicle forms, `MoveDriverToCityDialog` / `MoveVehicleToCityDialog` (disabled while IN_TRIP).
- City filter on Drivers/Vehicles/Trips/Customers via server param; geofence polygon in `FleetMap`.
- `Settings.tsx`: edits current tenant's values, shows "heredado del valor global" vs override with reset button (backend D10).

### F5 — WhatsApp config + tenant ops (after backend P5/P7) ≈ 1.5 days
- `WhatsAppConfig.tsx` (superadmin): number, display name, active toggle, rotate secrets, webhook health badge once backend exposes last-inbound-at.
- Superadmin: cross-tenant KPI table, usage rollup table (no charts), audit log table.
- Tenant admin dashboard shows own usage numbers.

### F6 — Vehicle type in requests/KPIs (after backend P6) ≈ 1 day
- Trip lists show requested/assigned type; KPI split by type; `LiveTrips` map markers show type label.

### F7 — Polish ≈ 1 day
Role matrix pass, responsive check, README, e2e smoke with two tenants (Playwright skill), update `CLAUDE.md`/ai-docs.

Total ≈ 8–9 days.

## 3. Risks
- Merge conflicts in `types.ts`/`admin.ts`/`queries.ts` — do per-phase, never all at once.
- Stale cache across tenant switch → include tenant in every query key; `queryClient.clear()` on switch.
- Frontend port 5173/other: check `~/.dev-ports.yaml` before any vite port change.

## 4. Deferred
Polygon drawing UI, per-tenant branding/logo, WhatsApp template editor, charts for usage, i18n.

## 5. Review additions (rev 2)

- **Lockstep with backend rename (F2 ↔ backend P3a):** the SPA calls `/admin/mototaxis`; backend serves both route names for one release. Ship F2 right after backend P3a to dev, verify, then retire the alias. The SPA deploys via its own CI → `repository_dispatch` into the backend repo's `deploy.yml` (dev automatic; prod manual `workflow_dispatch`).
- **Act-as contract (backend §11):** `TenantSwitcher` sends `X-Tenant-Id` on every request while active; a superadmin with *no* tenant selected sees read-only cross-tenant lists and every write button that needs a tenant is disabled with a hint ("Elige una empresa"). Banner is persistent and non-dismissable.
- **Cache hygiene:** `queryClient.clear()` on tenant switch and logout; every query key starts with `[tenantId, cityId, …]`. Test: switching tenants never shows the previous tenant's rows (MSW with two datasets).
- **Settings page:** shows effective value, source badge (tenant / global default), and "restablecer" to drop the override; validates min/max returned by the API (do not hardcode ranges).
- **Vehicle-type UX:** tenant admins can edit only their own types; global ones render read-only with a lock icon. Editing `attribute_schema` shows a warning when vehicles already use the type (backend allows additive changes only).
- **Customer type request (backend P6):** no customer UI here; panel shows `requested type` on trips and KPI by type.
- **Naming:** UI copy uses the type's `display_name`; generic words are "vehículo"/"conductor". Update `strings.ts` once, not per view.
- **Tests:** keep Vitest + MSW; add the route×role matrix (port `role-matrix.test.tsx`), tenant-switch cache test, and a Playwright two-tenant smoke (F7) run against the dev VM only.
- **Ports:** vite dev port unchanged (registry notes a 5173 conflict between this repo and `taxi_management_front`; do not run both at once).

## 6. Delivery notes (2026-10-21)

- Delivered: F1–F7. F2 + F3 must ship together (the SPA calls the renamed routes and `device_id`/`tracker_type`).
- Backend gaps found while building, closed in `mototaxi` `feat/tenancy-p8-panel-gaps`: `city_uuid` filter on drivers/vehicles/customers/trips; city + type on vehicle, trip and customer summaries; `/admin/usage` open to tenant admins (own row only).
- `queryClient.resetQueries()` is used on tenant switch (not `clear()`): mounted views must refetch.
- Playwright smoke is mocked at the network edge (`e2e/two-tenants.e2e.ts`); a run against the dev VM still needs real credentials and is left to the deploy check.
- SPA route `/mototaxis` → `/vehiculos` (redirect kept); UI copy says "vehículo", types show their `display_name`.
