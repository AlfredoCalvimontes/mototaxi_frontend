import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import { daysAgoInLaPaz } from '@/lib/format';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Mototaxis from '@/views/Mototaxis';

// Stubbed to keep these tests about the table and the filter, and to assert
// which units the view hands the map. The real component renders fine under
// jsdom and is covered directly in FleetMap.test.tsx.
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

describe('recarga de la SIM del GPS', () => {
  // Fechas relativas a hoy en La Paz, para que la prueba no caduque.
  const inDays = (days: number) => daysAgoInLaPaz(-days);

  function withSim(nextInDays: number, extra: object = {}) {
    server.use(
      http.get(`${BASE}/admin/mototaxis`, () =>
        HttpResponse.json([
          {
            ...fx.mototaxiSummary,
            sim_last_recharge_at: '2026-10-01',
            sim_last_recharge_amount: 10,
            sim_next_recharge_at: inDays(nextInDays),
            ...extra,
          },
        ]),
      ),
    );
  }

  async function simCells() {
    const row = (await (await table()).findAllByRole('row')).find((r) =>
      within(r).queryByText('ABC123'),
    )!;
    return within(row);
  }

  test('muestra la última recarga, el crédito y la próxima fecha', async () => {
    withSim(20);
    renderApp(<Mototaxis />);

    const row = await simCells();
    expect(row.getByText('01/10/2026')).toBeInTheDocument();
    expect(row.getByText('10')).toBeInTheDocument();
    expect(row.getByText('En 20 días')).toBeInTheDocument();
  });

  test('con margen de sobra no avisa', async () => {
    withSim(20);
    renderApp(<Mototaxis />);

    const badge = (await simCells()).getByText('En 20 días');
    expect(badge.className).toMatch(/emerald/);
  });

  test('a una semana de la próxima recarga se ve amarillo', async () => {
    withSim(6);
    renderApp(<Mototaxis />);

    const badge = (await simCells()).getByText('En 6 días');
    expect(badge.className).toMatch(/amber/);
  });

  test('a tres días de la próxima recarga se ve rojo', async () => {
    withSim(3);
    renderApp(<Mototaxis />);

    const badge = (await simCells()).getByText('En 3 días');
    expect(badge.className).toMatch(/red/);
  });

  test('el mismo día dice «Hoy» y sigue en rojo', async () => {
    withSim(0);
    renderApp(<Mototaxis />);

    const badge = (await simCells()).getByText('Hoy');
    expect(badge.className).toMatch(/red/);
  });

  test('una recarga vencida sigue en rojo y dice hace cuánto', async () => {
    withSim(-2);
    renderApp(<Mototaxis />);

    const badge = (await simCells()).getByText('Vencida hace 2 días');
    expect(badge.className).toMatch(/red/);
  });

  test('sin GPS esas celdas quedan vacías, aunque haya datos viejos', async () => {
    withSim(2, { has_tracker: false });
    renderApp(<Mototaxis />);

    const row = await simCells();
    expect(row.queryByText('01/10/2026')).not.toBeInTheDocument();
    expect(row.queryByText(/En \d+ días?|Hoy|Vencida/)).not.toBeInTheDocument();
  });

  test('con GPS pero sin ninguna recarga registrada tampoco inventa una fecha', async () => {
    renderApp(<Mototaxis />);

    const row = await simCells();
    expect(row.queryByText(/En \d+ días?|Hoy|Vencida/)).not.toBeInTheDocument();
  });
});
