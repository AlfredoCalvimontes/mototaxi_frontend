import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';

import type { UserProfile } from '@/api/types';
import { useAuth } from '@/auth/context';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import CityAccessManager from '@/views/tenancy/CityAccessManager';
import Cities from '@/views/tenancy/Cities';
import CityDetail from '@/views/tenancy/CityDetail';
import TenantDetail from '@/views/tenancy/TenantDetail';
import Tenants from '@/views/tenancy/Tenants';

// Leaflet needs a layout engine; the polygon maths is covered where it lives.
vi.mock('@/components/GeofenceMap', () => ({
  GeofenceMap: () => <div data-testid="geofence-map" />,
}));

const BASE = '/api/v1';

function asUser(profile: UserProfile) {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(profile)));
}

function capture(method: 'patch' | 'post' | 'put', path: string, response: object, status = 200) {
  const bodies: unknown[] = [];
  server.use(
    http[method](`${BASE}${path}`, async ({ request }) => {
      bodies.push(await request.json().catch(() => null));
      return HttpResponse.json(response, { status });
    }),
  );
  return bodies;
}

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

describe('empresas (superadmin)', () => {
  test('lista las empresas y permite actuar como una', async () => {
    asUser(fx.superadminProfile);
    function Probe() {
      const { actingAsTenant } = useAuth();
      return <p>acting:{actingAsTenant ?? 'ninguna'}</p>;
    }
    const { user } = renderApp(
      <>
        <Probe />
        <Tenants />
      </>,
    );

    const row = await rowFor('Taxi Sur');
    await user.click(row.getByRole('button', { name: 'Actuar como' }));
    expect(await screen.findByText(`acting:${fx.otherTenant.tenant_id}`)).toBeInTheDocument();
  });

  test('una empresa nueva envía el identificador y los opcionales vacíos como null', async () => {
    asUser(fx.superadminProfile);
    const bodies = capture('post', '/admin/tenants', fx.tenant, 201);
    const { user } = renderApp(<Tenants />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Nueva empresa' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Taxi Norte');
    await user.type(dialog.getByLabelText(/Identificador/), 'taxi-norte');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      name: 'Taxi Norte',
      slug: 'taxi-norte',
      contact_email: null,
      contact_phone: null,
    });
  });

  test('un identificador inválido no llega al servidor', async () => {
    asUser(fx.superadminProfile);
    const bodies = capture('post', '/admin/tenants', fx.tenant, 201);
    const { user } = renderApp(<Tenants />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Nueva empresa' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Taxi Norte');
    await user.type(dialog.getByLabelText(/Identificador/), 'Taxi Norte!');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(
      await dialog.findByText(/Minúsculas, números y guiones/, { selector: 'p' }),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  test('desactivar pide confirmación y usa la ruta deactivate', async () => {
    asUser(fx.superadminProfile);
    const calls: string[] = [];
    server.use(
      http.post(`${BASE}/admin/tenants/:id/deactivate`, ({ params }) => {
        calls.push(String(params.id));
        return HttpResponse.json({ ...fx.tenant, is_active: false });
      }),
    );
    const { user } = renderApp(<Tenants />);

    await user.click((await rowFor('Mototaxi Seguro')).getByRole('button', { name: 'Desactivar' }));
    expect(calls).toHaveLength(0);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }),
    );

    await waitFor(() => expect(calls).toEqual([fx.tenant.tenant_id]));
  });
});

describe('mi empresa', () => {
  function mount() {
    return renderApp(
      <Routes>
        <Route path="/tenants/:tenantId" element={<TenantDetail />} />
      </Routes>,
      { route: `/tenants/${fx.tenant.tenant_id}` },
    );
  }

  test('envía solo los campos tocados', async () => {
    asUser(fx.adminProfile);
    const bodies = capture('patch', '/admin/tenants/:id', fx.tenant);
    const { user } = mount();

    const name = await screen.findByLabelText(/Nombre/);
    await user.clear(name);
    await user.type(name, 'Mototaxi Seguro SRL');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ name: 'Mototaxi Seguro SRL' });
  });

  test('el tenant admin no ve el interruptor de activación', async () => {
    asUser(fx.adminProfile);
    mount();
    await screen.findByLabelText(/Nombre/);
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });

  test('vaciar el correo avisa en vez de fingir que lo borra', async () => {
    asUser(fx.adminProfile);
    const bodies = capture('patch', '/admin/tenants/:id', fx.tenant);
    const { user } = mount();

    await user.clear(await screen.findByLabelText(/Correo de contacto/));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pueden borrar/);
    expect(bodies).toHaveLength(0);
  });
});

describe('ciudades', () => {
  test('lista las ciudades y un tenant admin puede crear una', async () => {
    asUser(fx.adminProfile);
    const bodies = capture('post', '/admin/tenants/:id/cities', fx.city, 201);
    const { user } = renderApp(
      <Routes>
        <Route path="/tenants/:tenantId/cities" element={<Cities />} />
      </Routes>,
      { route: `/tenants/${fx.tenant.tenant_id}/cities` },
    );

    await rowFor('Yacuiba');
    await user.click(screen.getByRole('button', { name: 'Nueva ciudad' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Tarija');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ name: 'Tarija', timezone: 'America/La_Paz' });
  });

  test('un city admin ve la lista pero no el botón de crear', async () => {
    asUser(fx.cityAdminProfile);
    renderApp(
      <Routes>
        <Route path="/tenants/:tenantId/cities" element={<Cities />} />
      </Routes>,
      { route: `/tenants/${fx.tenant.tenant_id}/cities` },
    );

    await rowFor('Yacuiba');
    expect(screen.queryByRole('button', { name: 'Nueva ciudad' })).not.toBeInTheDocument();
  });

  function mountDetail(cityId: string, city: object) {
    server.use(http.get(`${BASE}/admin/cities/:id`, () => HttpResponse.json(city)));
    return renderApp(
      <Routes>
        <Route path="/tenants/:tenantId/cities/:cityId" element={<CityDetail />} />
      </Routes>,
      { route: `/tenants/${fx.tenant.tenant_id}/cities/${cityId}` },
    );
  }

  test('con geocerca muestra el mapa; sin ella lo dice', async () => {
    asUser(fx.adminProfile);
    mountDetail(fx.city.city_id, fx.city);
    expect(await screen.findByTestId('geofence-map')).toBeInTheDocument();
  });

  test('sin geocerca no hay mapa', async () => {
    asUser(fx.adminProfile);
    mountDetail(fx.secondCity.city_id, fx.secondCity);
    expect(await screen.findByText('Sin geocerca dibujada')).toBeInTheDocument();
    expect(screen.queryByTestId('geofence-map')).not.toBeInTheDocument();
  });

  test('editar la geocerca envía solo el WKT', async () => {
    asUser(fx.adminProfile);
    const bodies = capture('patch', '/admin/cities/:id', fx.city);
    const { user } = mountDetail(fx.city.city_id, fx.city);

    const wkt = await screen.findByLabelText(/Geocerca/);
    await user.clear(wkt);
    await user.type(wkt, 'POLYGON((0 0, 1 0, 1 1, 0 0))');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ geofence_wkt: 'POLYGON((0 0, 1 0, 1 1, 0 0))' });
  });
});

describe('accesos a la ciudad', () => {
  function mount() {
    return renderApp(
      <Routes>
        <Route path="/tenants/:tenantId/cities/:cityId/access" element={<CityAccessManager />} />
      </Routes>,
      { route: `/tenants/${fx.tenant.tenant_id}/cities/${fx.city.city_id}/access` },
    );
  }

  test('un tenant admin otorga acceso pegando el ID del usuario', async () => {
    asUser(fx.adminProfile);
    const bodies = capture('post', '/admin/cities/:id/access', fx.cityGrant, 201);
    const { user } = mount();

    await user.type(await screen.findByLabelText('ID del usuario'), 'user-xyz');
    await user.click(screen.getByRole('button', { name: 'Otorgar acceso' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ user_id: 'user-xyz' });
  });

  test('un superadmin elige entre los usuarios elegibles de la empresa', async () => {
    asUser(fx.superadminProfile);
    server.use(
      http.get(`${BASE}/users/list_users`, () =>
        HttpResponse.json({
          items: [
            {
              ...fx.cityAdminProfile,
              user_uuid: 'u-eligible',
              name: 'Rosa',
              tenant_id: fx.tenant.tenant_id,
            },
            {
              ...fx.cityAdminProfile,
              user_uuid: 'u-other-tenant',
              name: 'Pedro',
              tenant_id: 'otra',
            },
            { ...fx.adminProfile, user_uuid: 'u-admin', name: 'Jefe' },
          ],
          total: 3,
          page: 1,
          page_size: 100,
          pages: 1,
        }),
      ),
    );
    const bodies = capture('post', '/admin/cities/:id/access', fx.cityGrant, 201);
    const { user } = mount();

    const select = await screen.findByLabelText('Elegir usuario');
    // Solo CITY_ADMIN/OPERATOR de esta empresa.
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    expect(within(select).queryByText(/Pedro/)).not.toBeInTheDocument();
    expect(within(select).queryByText(/Jefe/)).not.toBeInTheDocument();

    await user.selectOptions(select, 'u-eligible');
    await user.click(screen.getByRole('button', { name: 'Otorgar acceso' }));
    await waitFor(() => expect(bodies).toEqual([{ user_id: 'u-eligible' }]));
  });

  test('quitar el acceso pide confirmación', async () => {
    asUser(fx.adminProfile);
    const calls: string[] = [];
    server.use(
      http.delete(`${BASE}/admin/cities/:id/access/:userId`, ({ params }) => {
        calls.push(String(params.userId));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = mount();

    await user.click(await screen.findByRole('button', { name: 'Quitar acceso' }));
    expect(calls).toHaveLength(0);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar acceso' }),
    );

    await waitFor(() => expect(calls).toEqual([fx.cityGrant.user_id]));
  });
});
