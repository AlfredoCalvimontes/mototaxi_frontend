# mototaxi_front

React + Vite SPA (Spanish, es-BO) for the multi-tenant mototaxi dispatch panel. Backend: `~/Documentos/Projects/mototaxi` (FastAPI). Plan: `ai-docs/plans/saas_multitenant_frontend_plan.md`. See `README.md` for roles, cities and testing.

## Commands
`npm test` (Vitest + MSW, no backend) · `npm run test:e2e` (Playwright, API mocked, port 5199) · `npm run typecheck` · `npm run lint` · `npm run build`

Gate commits on the test exit status; do not chain `test; git commit`.

## Conventions that are easy to break
- **URL segments:** every dynamic path segment in `src/api/admin.ts` goes through `seg()` (`encodeURIComponent`); router params arrive decoded.
- **Tenant switch:** `setActingAsTenant` calls `queryClient.resetQueries()`, never `clear()` (mounted views must refetch). `X-Tenant-Id` is set in `api/client.ts`.
- **City scope:** the header selector writes `?city=`; views read `useCityScope()` and send `city_uuid` to the API. Query keys include the city. `queryFn` must be wrapped (`() => listVehicles(city)`), never passed bare, or the query context lands in the city argument.
- **Query-key prefixes:** invalidate with `queryKeys.vehicles` / `['drivers']` / `queryKeys.activeTrips` (prefixes); read with `vehiclesIn(city)`, `drivers(status, city)`, `activeTripsIn(city)`.
- **PATCH serializers (`lib/dirty.ts`):** the driver route ignores `null` (nothing can be cleared); the vehicle route clears on `null`, but `tracker_type` and `attributes` are never `null`.
- **Roles:** route gating is `auth/RequireRole` with the sets in `auth/roles.ts`, mirroring the backend dependencies. `auth/role-matrix.test.tsx` pins route × role and the nav; update it with any new route.
- **Copy:** `src/lib/strings.ts` only. Generic words are "vehículo" and "conductor"; a vehicle type's `display_name` is shown where a specific type matters. Routes live at `/vehiculos` (`/mototaxis` redirects; remove it once the backend drops its alias).
- **Secrets:** the WhatsApp token is write-only; never prefill or log it.
- **Ports:** `~/.dev-ports.yaml` notes 5173 is shared with `taxi_management_front`; Playwright uses 5199.

## Deploy
Merging to `main` dispatches a deploy to the dev VM through the backend repo's `deploy.yml`. Deploy the backend first when a frontend change needs new API fields. Push to dev only unless told otherwise.
