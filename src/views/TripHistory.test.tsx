import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import TripHistory from '@/views/TripHistory';

const BASE = '/api/v1';

/** Pinned so "hoy" is deterministic: 22:00 in La Paz, already the 21st in UTC. */
const NOW = new Date('2026-07-21T02:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
  return () => vi.useRealTimers();
});

function captureQuery() {
  const seen: URL[] = [];
  server.use(
    http.get(`${BASE}/admin/trips/history`, ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json([fx.autoCompletedTrip]);
    }),
  );
  return seen;
}

describe('rango de fechas', () => {
  test('el rango por defecto es el día en curso en La Paz, no en UTC', async () => {
    const seen = captureQuery();
    renderApp(<TripHistory />);

    await waitFor(() => expect(seen).toHaveLength(1));
    // 22:00 del 20 en La Paz sigue siendo el día 20, aunque en UTC ya sea 21.
    expect(seen[0]!.searchParams.get('since')).toBe('2026-07-20T04:00:00.000Z');
    // Cota superior exclusiva: el inicio del día siguiente.
    expect(seen[0]!.searchParams.get('until')).toBe('2026-07-21T04:00:00.000Z');
  });

  test('cambiar la fecha vuelve a consultar con el nuevo rango', async () => {
    const seen = captureQuery();
    const { user } = renderApp(<TripHistory />);
    await waitFor(() => expect(seen).toHaveLength(1));

    await user.clear(screen.getByLabelText('Desde'));
    await user.type(screen.getByLabelText('Desde'), '2026-07-18');

    await waitFor(() => expect(seen.length).toBeGreaterThan(1));
    expect(seen.at(-1)!.searchParams.get('since')).toBe('2026-07-18T04:00:00.000Z');
  });
});

describe('resultados', () => {
  test('marca los viajes cerrados automáticamente para revisión', async () => {
    renderApp(<TripHistory />);
    const table = within(await screen.findByRole('table'));

    expect(await table.findByText('Cierre automático')).toBeInTheDocument();
  });

  test('avisa cuando el resultado llegó al tope y quedaron viajes fuera', async () => {
    server.use(
      http.get(`${BASE}/admin/trips/history`, () =>
        HttpResponse.json(
          Array.from({ length: 200 }, (_, index) => ({
            ...fx.autoCompletedTrip,
            trip_uuid: `trip-${index}`,
          })),
        ),
      ),
    );
    renderApp(<TripHistory />);

    expect(await screen.findByText(/Se muestran los primeros 200 viajes/)).toBeInTheDocument();
  });

  test('un rango vacío lo dice en lugar de mostrar una tabla vacía', async () => {
    server.use(http.get(`${BASE}/admin/trips/history`, () => HttpResponse.json([])));
    renderApp(<TripHistory />);

    expect(await screen.findByText('No hay viajes en este rango')).toBeInTheDocument();
  });

  test('el filtro de cierre automático llega aplicado desde el resumen', async () => {
    server.use(
      http.get(`${BASE}/admin/trips/history`, () =>
        HttpResponse.json([fx.autoCompletedTrip, { ...fx.activeTrip, status: 'COMPLETED' }]),
      ),
    );
    renderApp(<TripHistory />, { route: '/historial?cierre=automatico' });

    const rows = await within(await screen.findByRole('table')).findAllByRole('row');
    expect(rows).toHaveLength(2); // cabecera + el viaje cerrado automáticamente
  });
});

describe('exportación CSV', () => {
  test('descarga con el mismo rango consultado y advierte del contenido', async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${BASE}/admin/trips/history.csv`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.text('trip_uuid\n', { headers: { 'Content-Type': 'text/csv' } });
      }),
    );
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    // jsdom cannot follow a download link and logs "Not implemented" for the
    // attempt. The click is what matters here, not the navigation.
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { user } = renderApp(<TripHistory />);
    // El CSV lleva los teléfonos completos: eso se advierte antes de descargar.
    expect(screen.getByText('El CSV incluye los teléfonos completos.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.searchParams.get('since')).toBe('2026-07-20T04:00:00.000Z');
    expect(createObjectURL).toHaveBeenCalled();
    // El archivo se ofrece con un nombre que refleja el rango exportado.
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('viajes_2026-07-20_2026-07-20.csv');
    expect(revokeObjectURL).toHaveBeenCalled();

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  test('un fallo al exportar se informa sin romper la tabla', async () => {
    server.use(
      http.get(`${BASE}/admin/trips/history.csv`, () =>
        HttpResponse.json({ detail: 'No se pudo generar el CSV' }, { status: 500 }),
      ),
    );
    const { user } = renderApp(<TripHistory />);

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el CSV');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
