import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import CreditHistory from '@/views/CreditHistory';
import Drivers from '@/views/Drivers';

vi.mock('@/components/FleetMap', () => ({ FleetMap: () => <div /> }));

const BASE = '/api/v1';

function withDrivers(...drivers: object[]) {
  server.use(http.get(`${BASE}/admin/drivers`, () => HttpResponse.json(drivers)));
}

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

/** Records the query string of every ledger request, for asserting filters. */
function captureLedgerQueries(path: string, response: object) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get(`${BASE}${path}`, ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return HttpResponse.json(response);
    }),
  );
  return queries;
}

describe('historial de crédito de un conductor', () => {
  test('muestra el saldo, el resumen y cada movimiento con su motivo', async () => {
    withDrivers(fx.driverWithCredit);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Rafael Soria')).getByRole('button', { name: 'Historial' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText('Historial de crédito de Rafael Soria')).toBeInTheDocument();
    expect(dialog.getByText('Saldo ahora').nextElementSibling).toHaveTextContent('30');
    expect(dialog.getByText('Total recargado').nextElementSibling).toHaveTextContent('120');
    expect(dialog.getByText('Pago en efectivo, recibo 0042')).toBeInTheDocument();
    expect(dialog.getByText('+120')).toBeInTheDocument();
    expect(dialog.getByText('−60')).toHaveClass('text-red-700');
    expect(dialog.getByRole('table')).toHaveTextContent('Saldo inicial');
  });

  test('un filtro por tipo viaja al servidor y vuelve a la primera página', async () => {
    withDrivers(fx.driverWithCredit);
    const queries = captureLedgerQueries(
      `/admin/drivers/${fx.driverWithCredit.driver_uuid}/usage-credit/transactions`,
      fx.driverCreditLedger,
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Rafael Soria')).getByRole('button', { name: 'Historial' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText('Tipo'), 'DRAIN');

    await waitFor(() => expect(queries.at(-1)?.get('kind')).toBe('DRAIN'));
    expect(queries.at(-1)?.get('page')).toBe('1');
  });

  test('un conductor sin crédito no ofrece el historial', async () => {
    withDrivers(fx.driver);
    renderApp(<Drivers />);

    const row = await rowFor('Marco Peña');

    expect(row.queryByRole('button', { name: 'Historial' })).not.toBeInTheDocument();
  });

  test('sin movimientos lo dice', async () => {
    withDrivers(fx.driverWithCredit);
    server.use(
      http.get(`${BASE}/admin/drivers/:uuid/usage-credit/transactions`, () =>
        HttpResponse.json({ ...fx.driverCreditLedger, items: [], total: 0, pages: 1 }),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Rafael Soria')).getByRole('button', { name: 'Historial' }));

    expect(
      within(screen.getByRole('dialog')).getByText('No hay movimientos con estos filtros.'),
    ).toBeInTheDocument();
  });
});

describe('historial de crédito de la empresa', () => {
  test('lista los movimientos de todos los conductores con su nombre', async () => {
    withDrivers(fx.driverWithCredit);
    renderApp(<CreditHistory />);

    const table = await screen.findByRole('table');

    expect(within(table).getAllByText('Rafael Soria')[0]).toBeInTheDocument();
    expect(within(table).getByText('Pago en efectivo, recibo 0042')).toBeInTheDocument();
  });

  test('el filtro de conductor viaja como driver_uuid', async () => {
    withDrivers(fx.driverWithCredit);
    const queries = captureLedgerQueries('/admin/drivers/usage-credit/transactions', {
      items: fx.creditLedgerRows,
      total: fx.creditLedgerRows.length,
      page: 1,
      page_size: 20,
      pages: 1,
    });
    const { user } = renderApp(<CreditHistory />);

    await screen.findByRole('table');
    await user.selectOptions(screen.getByLabelText('Conductor'), fx.driverWithCredit.driver_uuid);

    await waitFor(() =>
      expect(queries.at(-1)?.get('driver_uuid')).toBe(fx.driverWithCredit.driver_uuid),
    );
  });

  test('un rango de fechas envía límites inclusivos en hora de La Paz', async () => {
    withDrivers(fx.driverWithCredit);
    const queries = captureLedgerQueries('/admin/drivers/usage-credit/transactions', {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      pages: 1,
    });
    const { user } = renderApp(<CreditHistory />);

    await screen.findByRole('table');
    await user.type(screen.getByLabelText('Desde'), '2026-10-20');
    await user.type(screen.getByLabelText('Hasta'), '2026-10-20');

    await waitFor(() => expect(queries.at(-1)?.get('created_to')).toBeTruthy());
    // Midnight La Paz is 04:00 UTC: the day runs from 04:00 to 03:59:59.999 UTC next day.
    expect(queries.at(-1)?.get('created_from')).toBe('2026-10-20T04:00:00.000Z');
    expect(queries.at(-1)?.get('created_to')).toBe('2026-10-21T03:59:59.999Z');
  });
});
