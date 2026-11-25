import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import WhatsApp from '@/views/tenancy/WhatsApp';

const BASE = '/api/v1';

function asUser(profile: object) {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(profile)));
}

async function rowFor(text: string, table: string) {
  const rows = await within(await screen.findByRole('table', { name: table })).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

describe('WhatsApp: una sola pantalla para números y rutas', () => {
  test('la empresa ve su ciudad, quién la atiende y no puede crear números de plataforma', async () => {
    asUser(fx.adminProfile);
    renderApp(<WhatsApp />, { route: '/whatsapp' });

    const villa = await rowFor(fx.city.name, 'Ciudades');
    expect(villa.getAllByText('+591 7000 0001').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Nuevo número' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Agregar número de plataforma' }),
    ).not.toBeInTheDocument();
  });

  test('asignar número ofrece los números de la empresa y manda el cambio de ciudad', async () => {
    asUser(fx.adminProfile);
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/numbers/:uuid/city`, async ({ request, params }) => {
        bodies.push({ uuid: params.uuid, body: await request.json() });
        return HttpResponse.json(fx.ownCityNumber);
      }),
    );
    const { user } = renderApp(<WhatsApp />, { route: '/whatsapp' });

    const sec = await rowFor(fx.secondCity.name, 'Ciudades');
    await user.click(sec.getByRole('button', { name: 'Asignar número' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Asignar número a/)).toBeInTheDocument();
    // The number already on Villa Montes is not offered for Yacuiba's pick.
    await user.selectOptions(dialog.getByRole('combobox'), fx.ownCityNumber.number_uuid);
    await user.click(dialog.getByRole('button', { name: 'Asignar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      uuid: fx.ownCityNumber.number_uuid,
      body: { city_uuid: fx.secondCity.city_id },
    });
  });

  test('un número nuevo se crea sin ciudad: queda sin asignar', async () => {
    asUser(fx.adminProfile);
    const bodies: unknown[] = [];
    server.use(
      http.post(`${BASE}/admin/whatsapp-routing/numbers`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.ownCityNumber, { status: 201 });
      }),
    );
    const { user } = renderApp(<WhatsApp />, { route: '/whatsapp' });

    await user.click(await screen.findByRole('button', { name: 'Nuevo número' }));
    const form = within(screen.getByRole('form', { name: 'Nuevo número' }));
    // No main number in the fixtures, so the kind offers both; a spare is picked explicitly.
    await user.selectOptions(form.getByLabelText('Tipo'), 'CITY');
    await user.type(form.getByLabelText(/ID del número/), '1090000000000042');
    await user.type(form.getByLabelText(/Token de acceso/), 'secreto');
    await user.click(form.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      role: 'CITY',
      phone_number_id: '1090000000000042',
      access_token: 'secreto',
    });
  });

  test('el Super Admin sin empresa filtra por ciudad y ve la ciudad, no una tabla vacía', async () => {
    asUser(fx.superadminProfile);
    renderApp(<WhatsApp />, { route: '/whatsapp' });

    const filter = await screen.findByLabelText('Ciudad');
    await userEvent.selectOptions(filter, fx.secondCity.city_id);

    const table = await screen.findByRole('table', { name: 'Ciudades' });
    expect(within(table).getByText(fx.secondCity.name)).toBeInTheDocument();
    expect(within(table).queryByText(fx.city.name)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Empresa')).toBeInTheDocument();
  });

  test('encender o apagar un número usa el cambio de estado', async () => {
    asUser(fx.adminProfile);
    const patched: unknown[] = [];
    server.use(
      http.patch(`${BASE}/admin/whatsapp-routing/numbers/:uuid/active`, async ({ request }) => {
        patched.push(await request.json());
        return HttpResponse.json({ ...fx.ownCityNumber, is_active: false });
      }),
    );
    const { user } = renderApp(<WhatsApp />, { route: '/whatsapp' });

    const row = await rowFor('+591 7000 0001', 'Números');
    await user.click(row.getByRole('button', { name: /Activo · Apagar/ }));

    await waitFor(() => expect(patched).toEqual([{ is_active: false }]));
    expect(await screen.findByText('Guardado.')).toBeInTheDocument();
  });

  test('editar un número de la empresa permite cambiar su rol y su ciudad', async () => {
    asUser(fx.adminProfile);
    const patches: unknown[] = [];
    const assigns: unknown[] = [];
    server.use(
      http.patch(`${BASE}/admin/whatsapp-routing/numbers/:id`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json(fx.ownCityNumber);
      }),
      http.put(`${BASE}/admin/whatsapp-routing/numbers/:id/city`, async ({ request }) => {
        assigns.push(await request.json());
        return HttpResponse.json(fx.ownCityNumber);
      }),
    );
    const { user } = renderApp(<WhatsApp />, { route: '/whatsapp' });

    const row = await rowFor(fx.ownCityNumber.phone_number_id, 'Números');
    await user.click(row.getByRole('button', { name: 'Editar número' }));
    const form = within(screen.getByRole('form', { name: 'Editar número' }));
    await user.selectOptions(form.getByLabelText('Rol'), 'MAIN');
    await user.click(form.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ role: 'MAIN' });
    expect(assigns).toHaveLength(0);
  });
});
