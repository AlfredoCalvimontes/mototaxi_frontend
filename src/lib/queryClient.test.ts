import { describe, expect, test } from 'vitest';

import { ApiError, NetworkError } from '@/api/client';
import { createQueryClient } from '@/lib/queryClient';

/** The retry predicate off the client's defaults. */
function retryOf(client: ReturnType<typeof createQueryClient>) {
  const retry = client.getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') throw new Error('retry debería ser una función');
  return retry as (failureCount: number, error: unknown) => boolean;
}

describe('política de reintentos', () => {
  const retry = retryOf(createQueryClient());

  test.each([400, 401, 403, 404, 409, 422])('no reintenta un %i', (status) => {
    // El servidor ya juzgó la petición; repetirla solo repite la respuesta.
    // El 401 además ya lo resolvió (o no) el refresh del cliente.
    expect(retry(0, new ApiError(status, 'no', null))).toBe(false);
  });

  test('reintenta un 500, que sí puede ser transitorio', () => {
    expect(retry(0, new ApiError(500, 'boom', null))).toBe(true);
    expect(retry(1, new ApiError(500, 'boom', null))).toBe(true);
  });

  test('deja de reintentar tras dos intentos fallidos', () => {
    expect(retry(2, new ApiError(500, 'boom', null))).toBe(false);
  });

  test('reintenta un fallo de red: no hubo respuesta que juzgar', () => {
    expect(retry(0, new NetworkError(new Error('offline')))).toBe(true);
  });
});
