/**
 * Default MSW handlers: the happy path for every endpoint the panel calls.
 * Individual tests override what they need via `server.use(...)`.
 */

import { HttpResponse, http } from 'msw';

import * as fx from '@/test/fixtures';

const BASE = '/api/v1';

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 100, pages: 1 };
}

export const handlers = [
  // auth
  http.post(`${BASE}/users/login`, async ({ request }) => {
    const body = new URLSearchParams(await request.text());
    if (body.get('password') === 'correcta') {
      return HttpResponse.json({
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'bearer',
      });
    }
    return HttpResponse.json({ detail: 'Credenciales inválidas' }, { status: 401 });
  }),
  http.post(`${BASE}/users/refresh`, () =>
    HttpResponse.json({ detail: 'Token inválido' }, { status: 401 }),
  ),
  http.post(`${BASE}/users/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.adminProfile)),

  // dashboard
  http.get(`${BASE}/admin/kpis`, () => HttpResponse.json(fx.kpis)),
  http.get(`${BASE}/admin/alerts`, () => HttpResponse.json(fx.alerts)),

  // fleet
  http.get(`${BASE}/admin/vehicles`, () =>
    HttpResponse.json([fx.vehicleSummary, fx.staleVehicleSummary]),
  ),
  http.get(`${BASE}/admin/vehicles/:uuid`, () => HttpResponse.json(fx.vehicleDetail)),
  http.post(`${BASE}/admin/vehicles`, () => HttpResponse.json(fx.vehicleDetail, { status: 201 })),
  http.patch(`${BASE}/admin/vehicles/:uuid`, () => HttpResponse.json(fx.vehicleDetail)),
  http.patch(`${BASE}/admin/vehicles/:uuid/status`, () => HttpResponse.json(fx.vehicleDetail)),

  // tenancy
  http.get(`${BASE}/admin/tenants`, () => HttpResponse.json(page([fx.tenant, fx.otherTenant]))),
  http.get(`${BASE}/admin/tenants/:id`, () => HttpResponse.json(fx.tenant)),
  http.get(`${BASE}/admin/tenants/:id/cities`, () =>
    HttpResponse.json(page([fx.city, fx.secondCity])),
  ),
  http.get(`${BASE}/admin/cities/:id`, () => HttpResponse.json(fx.city)),
  http.get(`${BASE}/admin/cities/:id/access`, () => HttpResponse.json([fx.cityGrant])),

  http.get(`${BASE}/admin/whatsapp-config`, () => HttpResponse.json([fx.whatsappConfig])),
  http.get(`${BASE}/admin/usage`, () => HttpResponse.json(fx.usageRows)),
  http.get(`${BASE}/admin/kpis/by-tenant`, () => HttpResponse.json(fx.kpiGroups)),
  http.get(`${BASE}/admin/kpis/by-vehicle-type`, () =>
    HttpResponse.json([
      { ...fx.kpiGroups[0], group_uuid: fx.globalMotoType.vehicle_type_uuid },
      { ...fx.kpiGroups[1], group_uuid: null },
    ]),
  ),
  http.get(`${BASE}/admin/audit-logs`, () => HttpResponse.json(page([fx.auditEntry]))),

  http.get(`${BASE}/admin/vehicle-types`, () =>
    HttpResponse.json([fx.globalMotoType, fx.ownVanType]),
  ),

  http.get(`${BASE}/admin/usage-plans`, () => HttpResponse.json([fx.freePlan, fx.rentalPlan])),

  http.get(`${BASE}/admin/drivers`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    const all = [fx.driver, fx.driverWithoutCheckin];
    return HttpResponse.json(status ? all.filter((d) => d.status === status) : all);
  }),
  http.post(`${BASE}/admin/drivers/:uuid/phone-key`, () =>
    HttpResponse.json({ phone_key: 'test-phone-key-0123456789abcdefghij' }),
  ),
  http.delete(
    `${BASE}/admin/drivers/:uuid/phone-key`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post(`${BASE}/admin/drivers/:uuid/usage-credit`, () =>
    HttpResponse.json(fx.driverWithCredit),
  ),
  http.get(`${BASE}/admin/drivers/:uuid/usage-credit/transactions`, () =>
    HttpResponse.json(fx.driverCreditLedger),
  ),
  http.get(`${BASE}/admin/drivers/usage-credit/transactions`, () =>
    HttpResponse.json(page(fx.creditLedgerRows)),
  ),
  http.get(`${BASE}/admin/drivers/:uuid/position-check`, () => HttpResponse.json(fx.positionCheck)),
  http.get(`${BASE}/admin/drivers/:uuid`, () => HttpResponse.json(fx.driver)),
  http.post(`${BASE}/admin/drivers`, () => HttpResponse.json(fx.driver, { status: 201 })),
  http.patch(`${BASE}/admin/drivers/:uuid`, () => HttpResponse.json(fx.driver)),
  http.patch(`${BASE}/admin/drivers/:uuid/status`, () => HttpResponse.json(fx.driver)),
  http.patch(`${BASE}/admin/drivers/:uuid/vehicle`, () => HttpResponse.json(fx.driver)),
  http.delete(`${BASE}/admin/drivers/:uuid`, () => new HttpResponse(null, { status: 204 })),

  // settings
  http.get(`${BASE}/admin/settings`, () => HttpResponse.json([fx.sharedLocationSetting])),
  http.put(`${BASE}/admin/settings/:key`, async ({ request }) => {
    const { value } = (await request.json()) as { value: number };
    return HttpResponse.json({
      ...fx.sharedLocationSetting,
      value,
      updated_at: '2026-09-24T18:00:00Z',
    });
  }),

  // trips
  http.get(`${BASE}/admin/trips/active`, () =>
    HttpResponse.json([fx.activeTrip, fx.searchingTrip]),
  ),
  http.get(`${BASE}/admin/trips/history`, () => HttpResponse.json([fx.autoCompletedTrip])),
  http.get(`${BASE}/admin/trips/history.csv`, () =>
    HttpResponse.text('trip_uuid,status\n', {
      headers: { 'Content-Type': 'text/csv' },
    }),
  ),
  http.post(`${BASE}/admin/trips/:uuid/cancel`, () => new HttpResponse(null, { status: 204 })),

  // customers
  http.get(`${BASE}/admin/customers`, ({ request }) => {
    const includeBlocked = new URL(request.url).searchParams.get('include_blocked') === 'true';
    return HttpResponse.json(includeBlocked ? [fx.customer, fx.blockedCustomer] : [fx.customer]);
  }),
  http.post(`${BASE}/admin/customers/:uuid/block`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${BASE}/admin/customers/:uuid/unblock`, () => new HttpResponse(null, { status: 204 })),
];
