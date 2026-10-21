import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import { getCity, revokeCityAccess } from '@/api/admin';
import { server } from '@/test/server';

describe('segmentos de ruta', () => {
  test('un parámetro con ../ no sale de su segmento', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/admin/cities/*', ({ request }) => {
        seen.push(new URL(request.url).pathname);
        return HttpResponse.json({});
      }),
      http.delete('*/admin/cities/*', ({ request }) => {
        seen.push(new URL(request.url).pathname);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await getCity('../../users/me');
    await revokeCityAccess('abc', '../x');

    expect(seen[0]).toBe('/api/v1/admin/cities/..%2F..%2Fusers%2Fme');
    expect(seen[1]).toBe('/api/v1/admin/cities/abc/access/..%2Fx');
  });
});
