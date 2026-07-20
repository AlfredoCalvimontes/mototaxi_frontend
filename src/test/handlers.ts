/**
 * Default MSW handlers: the happy path for every endpoint the panel calls.
 * Individual tests override what they need via `server.use(...)`.
 */

import { HttpResponse, http } from 'msw';

import * as fx from '@/test/fixtures';

const BASE = '/api/v1';

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
  http.get(`${BASE}/admin/mototaxis`, () =>
    HttpResponse.json([fx.mototaxiSummary, fx.staleMototaxiSummary]),
  ),
  http.get(`${BASE}/admin/mototaxis/:uuid`, () => HttpResponse.json(fx.mototaxiDetail)),
  http.post(`${BASE}/admin/mototaxis`, () => HttpResponse.json(fx.mototaxiDetail, { status: 201 })),
  http.patch(`${BASE}/admin/mototaxis/:uuid`, () => HttpResponse.json(fx.mototaxiDetail)),
  http.patch(`${BASE}/admin/mototaxis/:uuid/status`, () => HttpResponse.json(fx.mototaxiDetail)),

  http.get(`${BASE}/admin/drivers`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    const all = [fx.driver, fx.driverWithoutCheckin];
    return HttpResponse.json(status ? all.filter((d) => d.status === status) : all);
  }),
  http.get(`${BASE}/admin/drivers/:uuid`, () => HttpResponse.json(fx.driver)),
  http.post(`${BASE}/admin/drivers`, () => HttpResponse.json(fx.driver, { status: 201 })),
  http.patch(`${BASE}/admin/drivers/:uuid`, () => HttpResponse.json(fx.driver)),
  http.patch(`${BASE}/admin/drivers/:uuid/status`, () => HttpResponse.json(fx.driver)),
  http.patch(`${BASE}/admin/drivers/:uuid/mototaxi`, () => HttpResponse.json(fx.driver)),
  http.delete(`${BASE}/admin/drivers/:uuid`, () => new HttpResponse(null, { status: 204 })),

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
