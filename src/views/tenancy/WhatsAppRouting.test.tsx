import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { useEffect } from 'react';
import { describe, expect, test, vi } from 'vitest';

import type { UserProfile } from '@/api/types';
import { useAuth } from '@/auth/context';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import WhatsAppRouting from '@/views/tenancy/WhatsAppRouting';

const BASE = '/api/v1';

function asUser(profile: UserProfile) {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(profile)));
}

/** Selects a tenant the way the header does for a superadmin. */
function ActAs({ tenantId }: { tenantId: string }) {
  const { setActingAsTenant } = useAuth();
  useEffect(() => setActingAsTenant(tenantId), [setActingAsTenant, tenantId]);
  return null;
}

function renderRouting(tenantId?: string) {
  return renderApp(
    <>
      {tenantId && <ActAs tenantId={tenantId} />}
      <WhatsAppRouting />
    </>,
    { route: '/rutas-whatsapp' },
  );
}

async function cityRow(name: string) {
  const table = await screen.findByRole('table', { name: 'Ciudades' });
  const rows = await within(table).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(name))!);
}

describe('rutas WhatsApp por ciudad', () => {
  test('la empresa ve su ruta por ciudad y no tiene controles de escritura', async () => {
    asUser(fx.adminProfile);
    renderRouting();

    const villa = await cityRow(fx.city.name);
    expect(villa.getAllByText('+591 7000 0001').length).toBeGreaterThan(0);
    const sec = await cityRow(fx.secondCity.name);
    expect(sec.getByText('Sí')).toBeInTheDocument();
    expect(sec.getByText('+591 7000 9999')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar número' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delegar a la plataforma' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Agregar número de plataforma' }),
    ).not.toBeInTheDocument();
  });

  test('muestra el motivo cuando ningún número atiende la ciudad', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () =>
        HttpResponse.json([
          {
            ...fx.cityRoutingRows[0],
            own_city_number: null,
            serving: { number: null, deny_reason: 'number_unavailable' },
          },
        ]),
      ),
    );
    renderRouting();

    const villa = await cityRow(fx.city.name);
    expect(villa.getByText('El número de esta ciudad está apagado.')).toBeInTheDocument();
  });

  test('el superadmin sin empresa elegida ve la indicación y no consulta las ciudades', async () => {
    asUser(fx.superadminProfile);
    const citiesSpy = vi.fn();
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () => {
        citiesSpy();
        return HttpResponse.json([]);
      }),
    );
    renderRouting();

    expect(
      await screen.findByText('Elige una empresa (arriba) para ver y configurar sus ciudades.'),
    ).toBeInTheDocument();
    expect(citiesSpy).not.toHaveBeenCalled();
  });

  test('el superadmin delega una ciudad sin número propio', async () => {
    asUser(fx.superadminProfile);
    const delegated = vi.fn();
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () =>
        HttpResponse.json([{ ...fx.cityRoutingRows[0], own_city_number: null }]),
      ),
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/delegation`, ({ params }) => {
        delegated(params.uuid);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Delegar a la plataforma' }));
    await waitFor(() => expect(delegated).toHaveBeenCalledWith(fx.city.city_id));
  });

  test('no se puede delegar una ciudad con número propio', async () => {
    asUser(fx.superadminProfile);
    renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    expect(villa.getByRole('button', { name: 'Delegar a la plataforma' })).toBeDisabled();
  });

  test('muestra el rechazo del servidor al delegar', async () => {
    asUser(fx.superadminProfile);
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/delegation`, () =>
        HttpResponse.json(
          { detail: 'la empresa tiene número propio para esta ciudad' },
          { status: 422 },
        ),
      ),
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () =>
        HttpResponse.json([{ ...fx.cityRoutingRows[0], own_city_number: null }]),
      ),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Delegar a la plataforma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'la empresa tiene número propio para esta ciudad',
    );
  });

  test('guardar un número exige el token y lo envía en el PUT', async () => {
    asUser(fx.superadminProfile);
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/number`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.ownCityNumber);
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const sec = await cityRow(fx.secondCity.name);
    await user.click(sec.getByRole('button', { name: 'Asignar número' }));
    const form = screen.getByRole('form', { name: /Asignar número/ });

    await user.type(within(form).getByLabelText(/ID del número/), '3000');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(bodies).toHaveLength(0);
    expect(within(form).getAllByText(/obligatorio/i).length).toBeGreaterThan(0);

    await user.type(within(form).getByLabelText(/Token de acceso/), 'tok-secreto');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ phone_number_id: '3000', access_token: 'tok-secreto' });
  });

  test('quitar el número propio pide confirmación antes del DELETE', async () => {
    asUser(fx.superadminProfile);
    const removed = vi.fn();
    server.use(
      http.delete(`${BASE}/admin/whatsapp-routing/numbers/:uuid`, ({ params }) => {
        removed(params.uuid);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Quitar número propio' }));
    const dialog = await screen.findByRole('dialog');
    expect(removed).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(removed).toHaveBeenCalledWith(fx.ownCityNumber.number_uuid));
  });
});
