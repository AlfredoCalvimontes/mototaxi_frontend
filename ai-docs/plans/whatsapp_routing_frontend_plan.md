# Frontend sync with backend `develop` (last 5 merged PRs)

Base: `origin/main` (= PR #20 merged). Backend reference: `mototaxi_sever` `develop`.

## Audit of the last 5 backend PRs to `develop`

| PR | Backend change | Frontend status |
|---|---|---|
| #95 | CI: drop duplicate `TEST_PG_DATABASE_URL` | none |
| #94 | Per-city WhatsApp routing: `/admin/whatsapp-routing/*` (numbers, platform numbers, city numbers, delegation, `serving` preview), `GET /admin/cities` (catalog), MAIN-only `/admin/whatsapp-config` | **gap**: no routing screen. `WhatsAppConfig` copy still says "número de cada empresa" (it is now the MAIN number only). Catalog (`/admin/cities`) already done. |
| #91 | Hourly usage credit (`usage_credit_expires_at`), usage plans (`/admin/usage-plans`), credit ledger (`/admin/drivers/usage-credit/transactions`, `/admin/drivers/{id}/usage-credit/transactions`), 409 + `X-Affected-Drivers` on reprice | aligned (types, admin.ts, UsagePlans, CreditHistory, DriverCreditHistoryDialog verified field by field) |
| #84 | `seed_tenant` CLI, docs | none (no HTTP surface) |
| #82 | `city_uuid` filters on drivers/vehicles/customers/trips; `city_uuid`, `vehicle_type_uuid`, `requested_vehicle_type_uuid` on summaries; `/admin/usage` open to tenant admin | aligned (types + query params verified) |

Only real gap: WhatsApp routing screens (PR #94, plan R6 "no screen yet").

## Scope

1. **API layer** (`src/api/types.ts`, `src/api/admin.ts`, `src/api/queries.ts`)
   - Types: `RoutingNumber` (`number_uuid, scope, owner_tenant, role, city_uuid, phone_number_id, waba_id, display_phone_number, is_active, updated_at`), `CityRouting` (`city_uuid, city_name, delegated, own_city_number, serving`), `Serving` (`number, deny_reason`), `DenyReason` = `not_operating | no_coverage | number_unavailable`, `NumberRole` = `MAIN | CITY`, payloads `SaveCityNumberPayload`, `SavePlatformNumberPayload`.
   - Functions: `listRoutingNumbers()`, `listPlatformRoutingNumbers()`, `saveCityNumber(city, p)` PUT, `savePlatformNumber(p)` PUT, `deleteRoutingNumber(uuid)` DELETE, `listCityRouting()`, `setDelegation(city)` PUT, `clearDelegation(city)` DELETE, `previewCityServing(city)` GET (used by the detail panel).
   - Query keys: `whatsappRouting` prefix, **always including `actingAsTenant`** for city-scoped reads (same pattern as `WhatsAppConfig.tsx`).
   - Node/git hygiene: `node_modules` in the worktree is a symlink to the main checkout; confirm it is gitignored and never stage it.
2. **Screen** `src/views/tenancy/WhatsAppRouting.tsx`, route `/rutas-whatsapp`, roles `ADMIN` (backend reads: `TenantAdminUser`; writes: `SuperUser`).
   - Cities table (acted-as tenant): city, own number, delegated, who serves (number or deny reason).
   - Per-city actions (SUPERADMIN + acting as tenant): assign/replace own number, delegate to platform / clear delegation (disabled when own number exists — backend refuses), remove own number.
   - Tenant numbers list (`/numbers`), platform numbers list (`/platform-numbers`) — read for everyone in ADMIN; add/edit/remove only SUPERADMIN.
   - "¿Quién atiende una ciudad?" preview panel: city select → `GET /cities/{id}/serving`, shows the number or the deny reason (`not_operating` / `no_coverage` / `number_unavailable`, Spanish copy per reason).
   - Forms: token is **required on every save** (backend `min_length=1`, no keep-existing). Hint says so. This differs from the legacy `/admin/whatsapp-config` page, which keeps its optional token.
   - Gating: write controls render only for `user.role === 'SUPERADMIN'`. City-scoped writes (own number, delegation) are also disabled when no tenant is acting.
   - Errors: delegation 422 and encryption 503 are shown through `errorText`, no retry.
   - Delete confirm dialog states the fallback (city falls back to MAIN/platform).
   - Without acting-as tenant the city table shows "pick a tenant" hint; platform section still works.
3. **Nav + routes**: `/rutas-whatsapp` in `routes.tsx` (ADMIN group), nav item in `Layout.tsx` with `roles: ADMIN`.
4. **Existing `WhatsAppConfig` view**: copy only — "número principal (MAIN)", link to the routing screen. No behaviour change (`/admin/whatsapp-config` still MAIN-only and keeps token-optional update).
5. **Tests**
   - msw handlers + fixtures for the new endpoints.
   - `WhatsAppRouting.test.tsx`: renders serving/deny reasons; tenant admin sees no write controls; superadmin without tenant sees pick-tenant hint; delegate → PUT sent; delegate disabled when own number; save number sends token and shows API error; delete asks confirm then DELETE.
   - `role-matrix.test.tsx`: add `/rutas-whatsapp` row (SUPERADMIN, TENANT_ADMIN true; CITY_ADMIN, OPERATOR false).
   - Nav test if one exists for role-based links.
6. **Verify**: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` (baseline 392 passing).

## Out of scope

- Backend changes (none needed).
- Playwright e2e for the new screen (follow-up).
- Changing the legacy `/admin/whatsapp-config` behaviour (only its copy changes).

## Commits

One commit per logical step on branch `feat/sync-backend-develop`:
1. `docs(plans): frontend sync audit against backend develop`
2. `feat(api): whatsapp routing admin endpoints and types`
3. `feat(whatsapp): routing screen per city and number`
4. `feat(whatsapp): nav, route and role matrix for routing`
5. `docs/copy: MAIN number wording on the WhatsApp page`
