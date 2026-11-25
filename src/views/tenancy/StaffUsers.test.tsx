import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import type { StaffUser } from '@/api/types';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import StaffUsers from '@/views/tenancy/StaffUsers';

const BASE = '/api/v1';

const operator: StaffUser = {
  user_uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  email: 'omar@example.com',
  name: 'Omar',
  first_lastname: 'Operador',
  second_lastname: null,
  role: 'OPERATOR',
  tenant_id: fx.adminProfile.tenant_id ?? null,
  is_active: true,
  phone_number: null,
  city_uuids: ['30c0e377-1415-469f-b0b7-ad32666227f0'],
  created_at: '2026-05-01T10:00:00Z',
};

describe('usuarios', () => {
  test('una empresa ve sus usuarios con rol y ciudades, sin columna de empresa', async () => {
    server.use(http.get(`${BASE}/admin/staff-users`, () => HttpResponse.json([operator])));
    renderApp(<StaffUsers />, { route: '/usuarios' });

    expect(await screen.findByText('omar@example.com')).toBeInTheDocument();
    expect(screen.getByText('Operador')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Empresa' })).not.toBeInTheDocument();
  });

  test('el superadmin sin empresa ve la columna de empresa', async () => {
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.superadminProfile)),
      http.get(`${BASE}/admin/staff-users`, () =>
        HttpResponse.json([{ ...operator, tenant_id: null, role: 'TENANT_ADMIN', city_uuids: [] }]),
      ),
    );
    renderApp(<StaffUsers />, { route: '/usuarios' });

    expect(await screen.findByRole('columnheader', { name: 'Empresa' })).toBeInTheDocument();
  });

  test('el formulario de empresa no ofrece administrador de empresa', async () => {
    server.use(http.get(`${BASE}/admin/staff-users`, () => HttpResponse.json([])));
    renderApp(<StaffUsers />, { route: '/usuarios' });

    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const role = await screen.findByRole('combobox', { name: /Rol/ });
    expect(role.querySelector('option[value="TENANT_ADMIN"]')).toBeNull();
    await waitFor(() => expect(role.querySelector('option[value="CITY_ADMIN"]')).not.toBeNull());
  });

  test('editar un operador: cambiar de ciudad y desactivar envía el PATCH', async () => {
    let body: unknown = null;
    server.use(
      http.get(`${BASE}/admin/staff-users`, () => HttpResponse.json([operator])),
      http.get(`${BASE}/admin/cities`, () =>
        HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100, pages: 1 }),
      ),
      http.get(`${BASE}/admin/tenants/:id/cities`, () =>
        HttpResponse.json({
          items: [
            {
              city_id: '30c0e377-1415-469f-b0b7-ad32666227f0',
              tenant_id: operator.tenant_id,
              name: 'Villa Montes',
              timezone: 'America/La_Paz',
              geofence_wkt: null,
              geofence_geojson: null,
              is_active: true,
              created_at: '2026-05-01T10:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          page_size: 100,
          pages: 1,
        }),
      ),
      http.patch(`${BASE}/admin/staff-users/${operator.user_uuid}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...operator, is_active: false });
      }),
    );
    renderApp(<StaffUsers />, { route: '/usuarios' });

    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Activo/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({
      is_active: false,
      city_uuids: ['30c0e377-1415-469f-b0b7-ad32666227f0'],
    });
  });
  test('editar datos personales y teléfono envía solo lo cambiado', async () => {
    let body: unknown = null;
    server.use(
      http.get(`${BASE}/admin/staff-users`, () => HttpResponse.json([operator])),
      http.get(`${BASE}/admin/tenants/:id/cities`, () =>
        HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100, pages: 1 }),
      ),
      http.patch(`${BASE}/admin/staff-users/${operator.user_uuid}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(operator);
      }),
    );
    renderApp(<StaffUsers />, { route: '/usuarios' });

    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const name = await screen.findByLabelText(/Nombre/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Omar Luis');
    await userEvent.type(screen.getByLabelText(/Teléfono/), '+59176543210');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ name: 'Omar Luis', phone_number: '+59176543210' });
    expect(body).not.toHaveProperty('email');
  });

  test('un teléfono sin formato internacional no se envía', async () => {
    let called = false;
    server.use(
      http.get(`${BASE}/admin/staff-users`, () => HttpResponse.json([operator])),
      http.get(`${BASE}/admin/tenants/:id/cities`, () =>
        HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100, pages: 1 }),
      ),
      http.patch(`${BASE}/admin/staff-users/${operator.user_uuid}`, () => {
        called = true;
        return HttpResponse.json(operator);
      }),
    );
    renderApp(<StaffUsers />, { route: '/usuarios' });

    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    await userEvent.type(screen.getByLabelText(/Teléfono/), '76543210');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/Teléfono no válido/)).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
