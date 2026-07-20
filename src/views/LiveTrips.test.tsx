import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import LiveTrips from '@/views/LiveTrips';

const BASE = '/api/v1';

async function rowFor(text: string) {
  const table = within(await screen.findByRole('table'));
  const rows = await table.findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

describe('tablero en curso', () => {
  test('sin viajes activos lo dice en lugar de mostrar una tabla vacía', async () => {
    server.use(http.get(`${BASE}/admin/trips/active`, () => HttpResponse.json([])));
    renderApp(<LiveTrips />);

    expect(await screen.findByText('No hay viajes en curso')).toBeInTheDocument();
  });

  test('un tiempo de llegada calculado en línea recta se marca como estimado', async () => {
    renderApp(<LiveTrips />);

    const searching = await rowFor('Solicitado');
    expect(searching.getByText('(estimado)')).toBeInTheDocument();

    // El que sí vino del ruteo se muestra sin la marca.
    const enRoute = await rowFor('En camino');
    expect(enRoute.queryByText('(estimado)')).not.toBeInTheDocument();
    expect(enRoute.getByText('4 min')).toBeInTheDocument();
  });
});

describe('cancelación forzada', () => {
  test('la confirmación nombra el viaje concreto', async () => {
    const { user } = renderApp(<LiveTrips />);

    const row = await rowFor('En camino');
    await user.click(row.getByRole('button', { name: 'Cancelar viaje' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Av. Méndez Arcos 120/)).toBeInTheDocument();
    expect(dialog.getByText(/\+591····4567/)).toBeInTheDocument();
  });

  test('confirmar envía el motivo y refresca el tablero', async () => {
    let received: URL | null = null;
    server.use(
      http.post(`${BASE}/admin/trips/:uuid/cancel`, ({ request }) => {
        received = new URL(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp(<LiveTrips />);

    const row = await rowFor('En camino');
    await user.click(row.getByRole('button', { name: 'Cancelar viaje' }));
    await user.type(screen.getByLabelText('Motivo (opcional)'), 'cliente no apareció');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar viaje' }),
    );

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(received!.searchParams.get('reason')).toBe('cliente no apareció');
  });

  test('un 409 informa que el viaje ya terminó, no un error genérico', async () => {
    server.use(
      http.post(`${BASE}/admin/trips/:uuid/cancel`, () =>
        HttpResponse.json({ detail: 'Trip already terminated' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(<LiveTrips />);

    const row = await rowFor('En camino');
    await user.click(row.getByRole('button', { name: 'Cancelar viaje' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar viaje' }),
    );

    expect(await screen.findByRole('status')).toHaveTextContent('El viaje ya terminó');
    // El diálogo se cierra: no queda un error dentro de un cuadro que ya no aplica.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('un error real sí se muestra dentro del diálogo', async () => {
    server.use(
      http.post(`${BASE}/admin/trips/:uuid/cancel`, () =>
        HttpResponse.json({ detail: 'Falló el envío a WhatsApp' }, { status: 500 }),
      ),
    );
    const { user } = renderApp(<LiveTrips />);

    const row = await rowFor('En camino');
    await user.click(row.getByRole('button', { name: 'Cancelar viaje' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar viaje' }),
    );

    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Falló el envío a WhatsApp');
  });

  test('cerrar el diálogo no cancela nada', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/admin/trips/:uuid/cancel`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp(<LiveTrips />);

    const row = await rowFor('En camino');
    await user.click(row.getByRole('button', { name: 'Cancelar viaje' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });
});
