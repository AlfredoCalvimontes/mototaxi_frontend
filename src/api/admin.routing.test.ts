import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import {
  delegateCity,
  deleteRoutingNumber,
  listCityRouting,
  listPlatformRoutingNumbers,
  listRoutingNumbers,
  previewCityServing,
  saveCityNumber,
  savePlatformNumber,
  undelegateCity,
} from '@/api/admin';
import { ApiError } from '@/api/client';
import type { SaveNumberPayload, SavePlatformNumberPayload } from '@/api/types';
import * as fx from '@/test/fixtures';
import { server } from '@/test/server';

const ROUTING = '*/admin/whatsapp-routing';
const CITY = fx.city.city_id;
const NUMBER = fx.ownCityNumber.number_uuid;

const cityPayload: SaveNumberPayload = {
  phone_number_id: '3000',
  access_token: 'tok-secreto',
  waba_id: null,
  display_phone_number: null,
  is_active: true,
};

type Seen = { method: string; path: string; body: unknown };

/** Records every routing request; `respond` decides the reply. */
function record(respond: () => Response | ReturnType<typeof HttpResponse.json>) {
  const seen: Seen[] = [];
  server.use(
    http.all(`${ROUTING}/*`, async ({ request }) => {
      const text =
        request.method === 'GET' || request.method === 'DELETE' ? '' : await request.text();
      seen.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: text ? JSON.parse(text) : undefined,
      });
      return respond();
    }),
  );
  return seen;
}

describe('lecturas de rutas', () => {
  test('listRoutingNumbers pide los números de la empresa', async () => {
    const seen = record(() => HttpResponse.json(fx.tenantRoutingNumbers));
    await expect(listRoutingNumbers()).resolves.toEqual(fx.tenantRoutingNumbers);
    expect(seen).toEqual([
      { method: 'GET', path: '/api/v1/admin/whatsapp-routing/numbers', body: undefined },
    ]);
  });

  test('listPlatformRoutingNumbers pide los números de la plataforma', async () => {
    const seen = record(() => HttpResponse.json(fx.platformRoutingNumbers));
    await expect(listPlatformRoutingNumbers()).resolves.toEqual(fx.platformRoutingNumbers);
    expect(seen[0]?.path).toBe('/api/v1/admin/whatsapp-routing/platform-numbers');
  });

  test('listCityRouting pide cada ciudad con su ruta', async () => {
    const seen = record(() => HttpResponse.json(fx.cityRoutingRows));
    await expect(listCityRouting()).resolves.toEqual(fx.cityRoutingRows);
    expect(seen[0]?.path).toBe('/api/v1/admin/whatsapp-routing/cities');
  });

  test('previewCityServing pide quién atiende una ciudad', async () => {
    const seen = record(() => HttpResponse.json({ number: null, deny_reason: 'no_coverage' }));
    await expect(previewCityServing(CITY)).resolves.toEqual({
      number: null,
      deny_reason: 'no_coverage',
    });
    expect(seen[0]?.path).toBe(`/api/v1/admin/whatsapp-routing/cities/${CITY}/serving`);
  });
});

describe('escrituras de rutas', () => {
  test('saveCityNumber hace PUT del número de la ciudad con el token', async () => {
    const seen = record(() => HttpResponse.json(fx.ownCityNumber));
    await expect(saveCityNumber(CITY, cityPayload)).resolves.toEqual(fx.ownCityNumber);
    expect(seen).toEqual([
      {
        method: 'PUT',
        path: `/api/v1/admin/whatsapp-routing/cities/${CITY}/number`,
        body: cityPayload,
      },
    ]);
  });

  test('savePlatformNumber hace PUT de un número MAIN sin ciudad', async () => {
    const payload: SavePlatformNumberPayload = {
      ...cityPayload,
      role: 'MAIN',
      city_uuid: null,
    };
    const seen = record(() => HttpResponse.json(fx.platformMainNumber));
    await expect(savePlatformNumber(payload)).resolves.toEqual(fx.platformMainNumber);
    expect(seen[0]).toMatchObject({
      method: 'PUT',
      path: '/api/v1/admin/whatsapp-routing/platform-numbers',
      body: { role: 'MAIN', city_uuid: null, access_token: 'tok-secreto' },
    });
  });

  test('savePlatformNumber envía la ciudad cuando el número es de ciudad', async () => {
    const payload: SavePlatformNumberPayload = { ...cityPayload, role: 'CITY', city_uuid: CITY };
    const seen = record(() => HttpResponse.json(fx.platformMainNumber));
    await savePlatformNumber(payload);
    expect(seen[0]?.body).toMatchObject({ role: 'CITY', city_uuid: CITY });
  });

  test('deleteRoutingNumber hace DELETE del número y no devuelve cuerpo', async () => {
    const seen = record(() => new HttpResponse(null, { status: 204 }));
    await deleteRoutingNumber(NUMBER);
    expect(seen).toEqual([
      {
        method: 'DELETE',
        path: `/api/v1/admin/whatsapp-routing/numbers/${NUMBER}`,
        body: undefined,
      },
    ]);
  });

  test('delegateCity hace PUT de la delegación', async () => {
    const seen = record(() => new HttpResponse(null, { status: 204 }));
    await delegateCity(CITY);
    expect(seen[0]).toMatchObject({
      method: 'PUT',
      path: `/api/v1/admin/whatsapp-routing/cities/${CITY}/delegation`,
    });
  });

  test('undelegateCity hace DELETE de la delegación', async () => {
    const seen = record(() => new HttpResponse(null, { status: 204 }));
    await undelegateCity(CITY);
    expect(seen[0]).toMatchObject({
      method: 'DELETE',
      path: `/api/v1/admin/whatsapp-routing/cities/${CITY}/delegation`,
    });
  });

  test('delegateCity rechaza con 422 cuando la empresa tiene número propio', async () => {
    record(() =>
      HttpResponse.json(
        { detail: 'la empresa tiene número propio para esta ciudad' },
        { status: 422 },
      ),
    );
    const error = await delegateCity(CITY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).detail).toBe('la empresa tiene número propio para esta ciudad');
  });

  test('saveCityNumber rechaza con 503 cuando falta la clave de cifrado', async () => {
    record(() => HttpResponse.json({ detail: 'cifrado no disponible' }, { status: 503 }));
    const error = await saveCityNumber(CITY, cityPayload).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
  });

  test('un id con ../ no sale de su segmento en ninguna ruta de ciudad', async () => {
    const seen = record(() => new HttpResponse(null, { status: 204 }));
    await delegateCity('../x');
    await undelegateCity('../x');
    await previewCityServing('../x').catch(() => undefined);
    expect(seen.map((s) => s.path)).toEqual([
      '/api/v1/admin/whatsapp-routing/cities/..%2Fx/delegation',
      '/api/v1/admin/whatsapp-routing/cities/..%2Fx/delegation',
      '/api/v1/admin/whatsapp-routing/cities/..%2Fx/serving',
    ]);
  });
});
