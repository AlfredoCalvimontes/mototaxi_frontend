import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError, request, resetAuthRefreshState, setSessionExpiredHandler } from '@/api/client';
import { server } from '@/test/server';

const BASE = '/api/v1';

beforeEach(() => resetAuthRefreshState());
afterEach(() => setSessionExpiredHandler(null));

describe('errores', () => {
  test('mapea el detail de FastAPI', async () => {
    server.use(
      http.get(`${BASE}/admin/kpis`, () =>
        HttpResponse.json({ detail: 'No autorizado' }, { status: 403 }),
      ),
    );

    const error = await request('/admin/kpis').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).detail).toBe('No autorizado');
  });

  test('aplana los errores de validación 422', async () => {
    server.use(
      http.post(`${BASE}/admin/drivers`, () =>
        HttpResponse.json(
          { detail: [{ msg: 'campo requerido' }, { msg: 'teléfono inválido' }] },
          { status: 422 },
        ),
      ),
    );

    const error = (await request('/admin/drivers', { method: 'POST', json: {} }).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(error.isValidation).toBe(true);
    expect(error.detail).toBe('campo requerido; teléfono inválido');
  });

  test('204 devuelve null en lugar de fallar al parsear', async () => {
    await expect(request(`/admin/customers/abc/unblock`, { method: 'POST' })).resolves.toBeNull();
  });
});

describe('401 y refresh', () => {
  test('refresca una vez y reintenta la petición original', async () => {
    let kpiCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/admin/kpis`, () => {
        kpiCalls += 1;
        return kpiCalls === 1
          ? HttpResponse.json({ detail: 'expirado' }, { status: 401 })
          : HttpResponse.json({ trips_today: 7 });
      }),
      http.post(`${BASE}/users/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access_token: 'a', refresh_token: 'b', token_type: 'bearer' });
      }),
    );

    await expect(request('/admin/kpis')).resolves.toEqual({ trips_today: 7 });
    expect(refreshCalls).toBe(1);
    expect(kpiCalls).toBe(2);
  });

  test('un refresh fallido es terminal: no reintenta y avisa a la sesión', async () => {
    let kpiCalls = 0;
    let refreshCalls = 0;
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    server.use(
      http.get(`${BASE}/admin/kpis`, () => {
        kpiCalls += 1;
        return HttpResponse.json({ detail: 'expirado' }, { status: 401 });
      }),
      http.post(`${BASE}/users/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ detail: 'inválido' }, { status: 401 });
      }),
    );

    const error = (await request('/admin/kpis').catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(401);
    expect(onExpired).toHaveBeenCalledTimes(1);
    // No bucle: una petición original, un refresh, y nada más.
    expect(kpiCalls).toBe(1);
    expect(refreshCalls).toBe(1);
  });

  test('un 401 tras un refresh exitoso no dispara un segundo refresh', async () => {
    let refreshCalls = 0;
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    server.use(
      http.get(`${BASE}/admin/kpis`, () =>
        HttpResponse.json({ detail: 'expirado' }, { status: 401 }),
      ),
      http.post(`${BASE}/users/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access_token: 'a', refresh_token: 'b', token_type: 'bearer' });
      }),
    );

    await expect(request('/admin/kpis')).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls).toBe(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  test('varios 401 simultáneos comparten un único refresh', async () => {
    let refreshCalls = 0;
    const seen = new Set<string>();
    server.use(
      http.get(`${BASE}/admin/kpis`, () => {
        const first = !seen.has('kpis');
        seen.add('kpis');
        return first
          ? HttpResponse.json({ detail: 'expirado' }, { status: 401 })
          : HttpResponse.json({ ok: true });
      }),
      http.get(`${BASE}/admin/alerts`, () => {
        const first = !seen.has('alerts');
        seen.add('alerts');
        return first
          ? HttpResponse.json({ detail: 'expirado' }, { status: 401 })
          : HttpResponse.json({ ok: true });
      }),
      http.post(`${BASE}/users/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access_token: 'a', refresh_token: 'b', token_type: 'bearer' });
      }),
    );

    await Promise.all([request('/admin/kpis'), request('/admin/alerts')]);
    expect(refreshCalls).toBe(1);
  });

  test('el propio login no intenta refrescar', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/users/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ access_token: 'a', refresh_token: 'b', token_type: 'bearer' });
      }),
    );

    await expect(
      request('/users/login', {
        method: 'POST',
        form: { username: 'a@b.c', password: 'mala' },
        skipAuthRefresh: true,
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls).toBe(0);
  });
});

describe('construcción de la URL', () => {
  test('omite los parámetros vacíos y serializa el resto', async () => {
    let received = '';
    server.use(
      http.get(`${BASE}/admin/trips/history`, ({ request: req }) => {
        received = new URL(req.url).search;
        return HttpResponse.json([]);
      }),
    );

    await request('/admin/trips/history', {
      query: { since: '2026-07-20', until: undefined, limit: 200, reason: '' },
    });
    expect(received).toBe('?since=2026-07-20&limit=200');
  });
});
