import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import type { Driver } from '@/api/types';
import { filterParams } from '@/lib/cityScope';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Customers from '@/views/Customers';
import Drivers from '@/views/Drivers';
import LiveTrips from '@/views/LiveTrips';
import Vehicles from '@/views/Vehicles';

vi.mock('@/components/FleetMap', () => ({
  FleetMap: ({ geofences }: { geofences?: unknown[] }) => (
    <div data-testid="fleet-map" data-geofences={geofences?.length ?? 0} />
  ),
}));

const BASE = '/api/v1';

const inVilla: Driver = { ...fx.driver, city_uuid: fx.city.city_id };
const inYacuiba: Driver = {
  ...fx.driverWithoutCheckin,
  name: 'Rosa Yacuiba',
  city_uuid: fx.secondCity.city_id,
};

function drivers(list: Driver[]) {
  server.use(http.get(`${BASE}/admin/drivers`, () => HttpResponse.json(list)));
}

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

describe('ciudad en conductores', () => {
  test('muestra la ciudad de cada conductor', async () => {
    drivers([inVilla, inYacuiba]);
    renderApp(<Drivers />);

    expect((await rowFor('Marco Peña')).getByText('Villa Montes')).toBeInTheDocument();
    expect((await rowFor('Rosa Yacuiba')).getByText('Yacuiba')).toBeInTheDocument();
  });

  test('la ciudad elegida en la cabecera se pide al servidor, no se filtra aquí', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/admin/drivers`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('city_uuid'));
        return HttpResponse.json([inYacuiba]);
      }),
    );
    renderApp(<Drivers />, { route: `/?city=${fx.secondCity.city_id}` });

    await rowFor('Rosa Yacuiba');
    expect(seen).toContain(fx.secondCity.city_id);
  });

  test.each([
    ['vehicles', Vehicles],
    ['customers', Customers],
    ['trips/active', LiveTrips],
  ])('%s también manda la ciudad elegida', async (path, View) => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/admin/${path}`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get('city_uuid'));
        return HttpResponse.json([]);
      }),
    );
    renderApp(<View />, { route: `/?city=${fx.secondCity.city_id}` });

    await waitFor(() => expect(seen).toContain(fx.secondCity.city_id));
  });

  test('un filtro de la vista no borra la ciudad elegida', () => {
    const next = filterParams(
      new URLSearchParams(`city=abc&checkin=pendiente`),
      'credito',
      'agotado',
    );
    expect(next.get('city')).toBe('abc');
    expect(next.get('credito')).toBe('agotado');
    expect(next.has('checkin')).toBe(false);
    expect(filterParams(next, 'credito', null).toString()).toBe('city=abc');
  });

  test('un conductor nuevo envía la ciudad elegida', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${BASE}/admin/drivers`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(inVilla, { status: 201 });
      }),
    );
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar conductor' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Luis');
    await user.type(dialog.getByLabelText(/CI/), '123 LP');
    await user.type(dialog.getByLabelText(/WhatsApp/), '+59170000000');
    await user.selectOptions(await dialog.findByLabelText('Ciudad'), fx.secondCity.city_id);
    await user.selectOptions(await dialog.findByLabelText(/Plan de uso/), 'Alquiler de moto');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ name: 'Luis', city_uuid: fx.secondCity.city_id });
  });
});

describe('mover de ciudad', () => {
  test('mueve al conductor con PATCH /city', async () => {
    drivers([inVilla]);
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${BASE}/admin/drivers/:uuid/city`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ...inVilla, city_uuid: fx.secondCity.city_id });
      }),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Mover de ciudad' }));
    const dialog = within(screen.getByRole('dialog'));
    // La ciudad actual no se ofrece como destino.
    const select = await dialog.findByLabelText('Ciudad');
    await waitFor(() => expect(within(select).queryByText('Villa Montes')).not.toBeInTheDocument());
    await user.selectOptions(select, fx.secondCity.city_id);
    await user.click(dialog.getByRole('button', { name: 'Mover de ciudad' }));

    await waitFor(() => expect(bodies).toEqual([{ city_uuid: fx.secondCity.city_id }]));
  });

  test('con el conductor en viaje el botón está deshabilitado', async () => {
    drivers([{ ...inVilla, status: 'IN_TRIP' }]);
    renderApp(<Drivers />);

    const button = (await rowFor('Marco Peña')).getByRole('button', { name: 'Mover de ciudad' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'No se puede mover mientras está en viaje.');
  });

  test('el rechazo del servidor se muestra en el diálogo', async () => {
    drivers([inVilla]);
    server.use(
      http.patch(`${BASE}/admin/drivers/:uuid/city`, () =>
        HttpResponse.json({ detail: 'driver is in a trip' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Mover de ciudad' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(await dialog.findByLabelText('Ciudad'), fx.secondCity.city_id);
    await user.click(dialog.getByRole('button', { name: 'Mover de ciudad' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('driver is in a trip');
  });

  test('un vehículo también se mueve con PATCH /city', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${BASE}/admin/vehicles/:uuid/city`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.vehicleDetail);
      }),
    );
    const { user } = renderApp(<Vehicles />);

    const rows = await within(await screen.findByRole('table')).findAllByRole('row');
    const row = within(rows.find((r) => within(r).queryByText('ABC123'))!);
    await user.click(row.getByRole('button', { name: 'Mover de ciudad' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(await dialog.findByLabelText('Ciudad'), fx.city.city_id);
    await user.click(dialog.getByRole('button', { name: 'Mover de ciudad' }));

    await waitFor(() => expect(bodies).toEqual([{ city_uuid: fx.city.city_id }]));
  });
});

describe('geocerca en el mapa', () => {
  test('dibuja solo las ciudades con geocerca', async () => {
    renderApp(<Vehicles />);
    const map = await screen.findByTestId('fleet-map');
    await waitFor(() => expect(map).toHaveAttribute('data-geofences', '1'));
  });

  test('la ciudad elegida sin geocerca no dibuja ninguna', async () => {
    renderApp(<Vehicles />, { route: `/?city=${fx.secondCity.city_id}` });
    const map = await screen.findByTestId('fleet-map');
    await waitFor(() => expect(map).toHaveAttribute('data-geofences', '0'));
  });
});
