import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Customers from '@/views/Customers';

const BASE = '/api/v1';

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

describe('listado de clientes', () => {
  test('los teléfonos llegan enmascarados con revelado por fila', async () => {
    const { user } = renderApp(<Customers />);

    const row = await rowFor('Rosa Flores');
    expect(row.getByText('+591····2222')).toBeInTheDocument();

    await user.click(row.getByRole('button', { name: /Mostrar/ }));
    expect(row.getByText('+59171112222')).toBeInTheDocument();
  });

  test('los bloqueados quedan fuera salvo que se pidan', async () => {
    const { user } = renderApp(<Customers />);
    await screen.findByRole('table');

    expect(screen.queryByText('+591····4444')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Incluir bloqueados' }));

    expect(await screen.findByText('+591····4444')).toBeInTheDocument();
  });

  test('un cliente bloqueado ofrece desbloquear, no bloquear', async () => {
    const { user } = renderApp(<Customers />);
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Incluir bloqueados' }));

    const row = await rowFor('+591····4444');
    expect(row.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument();
  });
});

describe('bloqueo', () => {
  test('la confirmación nombra al cliente y envía el motivo', async () => {
    let received: URL | null = null;
    server.use(
      http.post(`${BASE}/admin/customers/:uuid/block`, ({ request }) => {
        received = new URL(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp(<Customers />);

    const row = await rowFor('Rosa Flores');
    await user.click(row.getByRole('button', { name: 'Bloquear' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Rosa Flores/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Motivo (opcional)'), 'no se presenta');
    await user.click(dialog.getByRole('button', { name: 'Bloquear' }));

    await waitFor(() => expect(received).not.toBeNull());
    expect(received!.searchParams.get('reason')).toBe('no se presenta');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('desbloquear no pide motivo: no es una acción destructiva', async () => {
    const { user } = renderApp(<Customers />);
    await screen.findByRole('table');
    await user.click(screen.getByRole('checkbox', { name: 'Incluir bloqueados' }));

    const row = await rowFor('+591····4444');
    await user.click(row.getByRole('button', { name: 'Desbloquear' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByLabelText('Motivo (opcional)')).not.toBeInTheDocument();
  });

  test('cerrar la confirmación no bloquea a nadie', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/admin/customers/:uuid/block`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp(<Customers />);

    const row = await rowFor('Rosa Flores');
    await user.click(row.getByRole('button', { name: 'Bloquear' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });

  test('un error deja el diálogo abierto con el mensaje del servidor', async () => {
    server.use(
      http.post(`${BASE}/admin/customers/:uuid/block`, () =>
        HttpResponse.json({ detail: 'El cliente tiene un viaje en curso' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(<Customers />);

    const row = await rowFor('Rosa Flores');
    await user.click(row.getByRole('button', { name: 'Bloquear' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Bloquear' }));

    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'El cliente tiene un viaje en curso',
    );
  });
});
