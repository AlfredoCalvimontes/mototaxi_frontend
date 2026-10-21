import { describe, expect, test } from 'vitest';

import { toLatLngs } from '@/lib/geo';

describe('toLatLngs', () => {
  test('invierte [lon, lat] a [lat, lon]', () => {
    expect(
      toLatLngs({
        type: 'Polygon',
        coordinates: [
          [
            [-63.5, -21.3],
            [-63.4, -21.2],
            [-63.4, -21.3],
          ],
        ],
      }),
    ).toEqual([
      [-21.3, -63.5],
      [-21.2, -63.4],
      [-21.3, -63.4],
    ]);
  });

  test('sin anillos devuelve una lista vacía', () => {
    expect(toLatLngs({ type: 'Polygon', coordinates: [] })).toEqual([]);
  });
});
