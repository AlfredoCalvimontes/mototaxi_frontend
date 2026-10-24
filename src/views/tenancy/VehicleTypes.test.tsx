import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import type { UserProfile } from '@/api/types';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import VehicleTypes from '@/views/tenancy/VehicleTypes';

const BASE = '/api/v1';

function asUser(profile: UserProfile) {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(profile)));
}

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

describe('tipos de vehículo', () => {
  test('un tenant admin ve el tipo global bloqueado y sin acciones', async () => {
    asUser(fx.adminProfile);
    renderApp(<VehicleTypes />);

    const globalRow = await rowFor('Mototaxi');
    expect(globalRow.getByRole('img', { name: /solo lo edita la plataforma/ })).toBeInTheDocument();
    expect(globalRow.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();

    const ownRow = await rowFor('Minivan');
    expect(ownRow.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  test('un superadmin puede editar un tipo global', async () => {
    asUser(fx.superadminProfile);
    renderApp(<VehicleTypes />);

    const globalRow = await rowFor('Mototaxi');
    expect(globalRow.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  test('crea un tipo propio con un atributo del esquema', async () => {
    asUser(fx.adminProfile);
    const bodies: unknown[] = [];
    server.use(
      http.post(`${BASE}/admin/vehicle-types`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.ownVanType, { status: 201 });
      }),
    );
    const { user } = renderApp(<VehicleTypes />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Nuevo tipo' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Código/), 'truck');
    await user.type(dialog.getByLabelText(/^Nombre/), 'Camión');
    await user.click(dialog.getByRole('button', { name: 'Agregar dato' }));
    await user.type(dialog.getByLabelText('Clave'), 'capacity');
    await user.type(dialog.getByLabelText('Etiqueta'), 'Capacidad');
    await user.selectOptions(dialog.getByLabelText('Tipo de dato'), 'float');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      code: 'truck',
      display_name: 'Camión',
      attribute_schema: [{ key: 'capacity', type: 'float', required: false, label: 'Capacidad' }],
    });
  });

  test('el aviso del esquema solo sale si hay vehículos de ese tipo', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/vehicles`, () =>
        HttpResponse.json([
          { ...fx.vehicleSummary, vehicle_type_uuid: fx.ownVanType.vehicle_type_uuid },
          { ...fx.staleVehicleSummary, vehicle_type_uuid: fx.ownVanType.vehicle_type_uuid },
        ]),
      ),
    );
    const { user } = renderApp(<VehicleTypes />);

    await user.click((await rowFor('Minivan')).getByRole('button', { name: 'Editar' }));
    expect(await screen.findByText(/Hay 2 vehículos de este tipo/)).toBeInTheDocument();
  });

  test('sin vehículos de ese tipo no hay aviso', async () => {
    asUser(fx.adminProfile);
    const { user } = renderApp(<VehicleTypes />);

    await user.click((await rowFor('Minivan')).getByRole('button', { name: 'Editar' }));
    await screen.findByRole('dialog');
    expect(screen.queryByText(/de este tipo: solo se pueden/)).not.toBeInTheDocument();
  });

  test('el rechazo del servidor por un esquema no aditivo se muestra', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.patch(`${BASE}/admin/vehicle-types/:uuid`, () =>
        HttpResponse.json(
          { detail: "cannot remove 'x' while vehicles use this type" },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp(<VehicleTypes />);

    await user.click((await rowFor('Minivan')).getByRole('button', { name: 'Editar' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(/cannot remove/);
  });
});
