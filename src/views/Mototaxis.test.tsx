import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Mototaxis from '@/views/Mototaxis';

// Leaflet needs real layout and canvas APIs jsdom does not provide. The map is
// covered by hand; these tests are about the table and the filter.
vi.mock('@/components/FleetMap', () => ({
  FleetMap: ({ units }: { units: { mototaxi_uuid: string }[] }) => (
    <div data-testid="mapa">{units.length}</div>
  ),
}));

const BASE = '/api/v1';

async function table() {
  return within(await screen.findByRole('table'));
}

describe('listado de mototaxis', () => {
  test('resuelve el nombre del conductor a partir de su uuid', async () => {
    renderApp(<Mototaxis />);
    expect(await (await table()).findByText('Marco Peña')).toBeInTheDocument();
  });

  test('marca las unidades con GPS sin señal', async () => {
    renderApp(<Mototaxis />);
    const rows = await (await table()).findAllByRole('row');
    const stale = rows.find((row) => within(row).queryByText('XYZ789'));
    expect(within(stale!).getByText('GPS sin señal')).toBeInTheDocument();
  });

  test('una unidad sin posición lo dice en lugar de mostrar un guion', async () => {
    server.use(
      http.get(`${BASE}/admin/mototaxis`, () =>
        HttpResponse.json([
          { ...fx.mototaxiSummary, lat: null, lon: null, location_updated_at: null },
        ]),
      ),
    );
    renderApp(<Mototaxis />);
    expect(await screen.findByText('Sin posición registrada')).toBeInTheDocument();
  });
});

describe('filtro de GPS sin señal', () => {
  test('la URL del enlace del resumen deja el filtro ya aplicado', async () => {
    renderApp(<Mototaxis />, { route: '/mototaxis?gps=sin-senal' });

    const rows = await (await table()).findAllByRole('row');
    // Cabecera + la única unidad sin señal.
    expect(rows).toHaveLength(2);
    expect(within(rows[1]!).getByText('XYZ789')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /GPS sin señal/ })).toBeChecked();
  });

  test('el mapa refleja el filtro, no la lista completa', async () => {
    renderApp(<Mototaxis />, { route: '/mototaxis?gps=sin-senal' });
    expect(await screen.findByTestId('mapa')).toHaveTextContent('1');
  });

  test('se puede quitar el filtro desde la vista', async () => {
    const { user } = renderApp(<Mototaxis />, { route: '/mototaxis?gps=sin-senal' });

    await user.click(await screen.findByRole('checkbox', { name: /GPS sin señal/ }));

    expect(await (await table()).findByText('ABC123')).toBeInTheDocument();
  });
});
