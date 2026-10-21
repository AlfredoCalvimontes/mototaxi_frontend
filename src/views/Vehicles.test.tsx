import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { daysAgoInLaPaz } from '@/lib/format';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Vehicles from '@/views/Vehicles';

// Stubbed to keep these tests about the table and the filter, and to assert
// which units the view hands the map. The real component renders fine under
// jsdom and is covered directly in FleetMap.test.tsx.
vi.mock('@/components/FleetMap', () => ({
  FleetMap: ({ units }: { units: { vehicle_uuid: string }[] }) => (
    <div data-testid="mapa">{units.length}</div>
  ),
}));

const BASE = '/api/v1';

async function table() {
  return within(await screen.findByRole('table'));
}

describe('listado de mototaxis', () => {
  test('resuelve el nombre del conductor a partir de su uuid', async () => {
    renderApp(<Vehicles />);
    expect(await (await table()).findByText('Marco Peña')).toBeInTheDocument();
  });

  test('marca las unidades con GPS sin señal', async () => {
    renderApp(<Vehicles />);
    const rows = await (await table()).findAllByRole('row');
    const stale = rows.find((row) => within(row).queryByText('XYZ789'));
    expect(within(stale!).getByText('GPS sin señal')).toBeInTheDocument();
  });

  test('una unidad sin posición lo dice en lugar de mostrar un guion', async () => {
    server.use(
      http.get(`${BASE}/admin/vehicles`, () =>
        HttpResponse.json([
          { ...fx.vehicleSummary, lat: null, lon: null, location_updated_at: null },
        ]),
      ),
    );
    renderApp(<Vehicles />);
    expect(await screen.findByText('Sin posición registrada')).toBeInTheDocument();
  });
});

describe('filtro de GPS sin señal', () => {
  test('la URL del enlace del resumen deja el filtro ya aplicado', async () => {
    renderApp(<Vehicles />, { route: '/mototaxis?gps=sin-senal' });

    const rows = await (await table()).findAllByRole('row');
    // Cabecera + la única unidad sin señal.
    expect(rows).toHaveLength(2);
    expect(within(rows[1]!).getByText('XYZ789')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /GPS sin señal/ })).toBeChecked();
  });

  test('el mapa refleja el filtro, no la lista completa', async () => {
    renderApp(<Vehicles />, { route: '/mototaxis?gps=sin-senal' });
    expect(await screen.findByTestId('mapa')).toHaveTextContent('1');
  });

  test('se puede quitar el filtro desde la vista', async () => {
    const { user } = renderApp(<Vehicles />, { route: '/mototaxis?gps=sin-senal' });

    await user.click(await screen.findByRole('checkbox', { name: /GPS sin señal/ }));

    expect(await (await table()).findByText('ABC123')).toBeInTheDocument();
  });
});

describe('recarga de la SIM del GPS', () => {
  // Fechas relativas a hoy en La Paz, para que la prueba no caduque.
  const inDays = (days: number) => daysAgoInLaPaz(-days);

  function withSim(nextInDays: number, extra: object = {}) {
    server.use(
      http.get(`${BASE}/admin/vehicles`, () =>
        HttpResponse.json([
          {
            ...fx.vehicleSummary,
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
    renderApp(<Vehicles />);

    const row = await simCells();
    expect(row.getByText('01/10/2026')).toBeInTheDocument();
    expect(row.getByText('10')).toBeInTheDocument();
    expect(row.getByText('En 20 días')).toBeInTheDocument();
  });

  test('con margen de sobra no avisa', async () => {
    withSim(20);
    renderApp(<Vehicles />);

    const badge = (await simCells()).getByText('En 20 días');
    expect(badge.className).toMatch(/emerald/);
  });

  test('a una semana de la próxima recarga se ve amarillo', async () => {
    withSim(6);
    renderApp(<Vehicles />);

    const badge = (await simCells()).getByText('En 6 días');
    expect(badge.className).toMatch(/amber/);
  });

  test('a tres días de la próxima recarga se ve rojo', async () => {
    withSim(3);
    renderApp(<Vehicles />);

    const badge = (await simCells()).getByText('En 3 días');
    expect(badge.className).toMatch(/red/);
  });

  test('el mismo día dice «Hoy» y sigue en rojo', async () => {
    withSim(0);
    renderApp(<Vehicles />);

    const badge = (await simCells()).getByText('Hoy');
    expect(badge.className).toMatch(/red/);
  });

  test('una recarga vencida sigue en rojo y dice hace cuánto', async () => {
    withSim(-2);
    renderApp(<Vehicles />);

    const badge = (await simCells()).getByText('Vencida hace 2 días');
    expect(badge.className).toMatch(/red/);
  });

  test('sin GPS esas celdas quedan vacías, aunque haya datos viejos', async () => {
    withSim(2, { has_tracker: false });
    renderApp(<Vehicles />);

    const row = await simCells();
    expect(row.queryByText('01/10/2026')).not.toBeInTheDocument();
    expect(row.queryByText(/En \d+ días?|Hoy|Vencida/)).not.toBeInTheDocument();
  });

  test('con GPS pero sin ninguna recarga registrada tampoco inventa una fecha', async () => {
    renderApp(<Vehicles />);

    const row = await simCells();
    expect(row.queryByText(/En \d+ días?|Hoy|Vencida/)).not.toBeInTheDocument();
  });
});

describe('ocultar las columnas de la SIM', () => {
  const SIM_HEADERS = ['Última recarga SIM', 'Crédito cargado', 'Próxima recarga'];

  beforeEach(() => window.localStorage.clear());

  test('por defecto las columnas de la SIM se ven', async () => {
    renderApp(<Vehicles />);
    const t = await table();

    for (const header of SIM_HEADERS) {
      expect(t.getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Ocultar SIM' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('el botón oculta las tres columnas y deja las demás', async () => {
    const { user } = renderApp(<Vehicles />);
    await table();

    await user.click(screen.getByRole('button', { name: 'Ocultar SIM' }));

    const t = await table();
    for (const header of SIM_HEADERS) {
      expect(t.queryByRole('columnheader', { name: new RegExp(header) })).not.toBeInTheDocument();
    }
    expect(t.getByRole('columnheader', { name: /Placa/ })).toBeInTheDocument();
    expect(t.getByRole('columnheader', { name: /Última señal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar SIM' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('volver a pulsar las muestra', async () => {
    const { user } = renderApp(<Vehicles />);
    await table();

    await user.click(screen.getByRole('button', { name: 'Ocultar SIM' }));
    await user.click(screen.getByRole('button', { name: 'Mostrar SIM' }));

    expect(
      (await table()).getByRole('columnheader', { name: /Próxima recarga/ }),
    ).toBeInTheDocument();
  });

  test('recuerda la elección la próxima vez que se abre la pantalla', async () => {
    const first = renderApp(<Vehicles />);
    await table();
    await first.user.click(screen.getByRole('button', { name: 'Ocultar SIM' }));
    first.unmount();

    renderApp(<Vehicles />);

    const t = await table();
    expect(t.queryByRole('columnheader', { name: /Próxima recarga/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mostrar SIM' })).toBeVisible());
  });

  test('si el almacenamiento falla, el botón sigue funcionando durante la sesión', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { user } = renderApp(<Vehicles />);
    await table();

    await user.click(screen.getByRole('button', { name: 'Ocultar SIM' }));

    expect(
      (await table()).queryByRole('columnheader', { name: /Próxima recarga/ }),
    ).not.toBeInTheDocument();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
