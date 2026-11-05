import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import AllCities from '@/views/tenancy/AllCities';

const BASE = '/api/v1';

function superadmin() {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.superadminProfile)));
  server.use(
    http.get(`${BASE}/admin/tenants`, () =>
      HttpResponse.json({
        items: [fx.tenant, fx.otherTenant],
        total: 2,
        page: 1,
        page_size: 100,
        pages: 1,
      }),
    ),
  );
}

function catalog(seen: URLSearchParams[]) {
  const other = {
    ...fx.city,
    city_id: '66666666-6666-4666-8666-666666666666',
    tenant_id: fx.otherTenant.tenant_id,
    name: 'Taxi Norte',
  };
  server.use(
    http.get(`${BASE}/admin/cities`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      seen.push(params);
      const tenant = params.get('tenant_id');
      const items = [fx.city, other].filter((c) => !tenant || c.tenant_id === tenant);
      return HttpResponse.json({ items, total: items.length, page: 1, page_size: 25, pages: 1 });
    }),
  );
}

describe('ciudades (catálogo global)', () => {
  test('lista las ciudades de todas las empresas con el nombre de la empresa', async () => {
    superadmin();
    catalog([]);
    renderApp(<AllCities />);

    const table = within(await screen.findByRole('table', { name: 'Catálogo de ciudades' }));

    expect(await table.findByText('Villa Montes')).toBeInTheDocument();
    expect(table.getByText('Taxi Norte')).toBeInTheDocument();
    expect(table.getByText('Taxi Sur')).toBeInTheDocument();
  });

  test('filtrar por empresa manda tenant_id y muestra solo sus ciudades', async () => {
    superadmin();
    const seen: URLSearchParams[] = [];
    catalog(seen);
    const { user } = renderApp(<AllCities />);
    await screen.findByText('Taxi Norte');

    await user.selectOptions(screen.getByLabelText('Empresa'), fx.otherTenant.tenant_id);

    await waitFor(() =>
      expect(seen.some((p) => p.get('tenant_id') === fx.otherTenant.tenant_id)).toBe(true),
    );
    const table = within(screen.getByRole('table', { name: 'Catálogo de ciudades' }));
    await waitFor(() => expect(table.queryByText('Villa Montes')).not.toBeInTheDocument());
    expect(table.getByText('Taxi Norte')).toBeInTheDocument();
  });

  test('el filtro de estado manda active y la búsqueda manda q', async () => {
    superadmin();
    const seen: URLSearchParams[] = [];
    catalog(seen);
    const { user } = renderApp(<AllCities />);
    await screen.findByText('Taxi Norte');

    await user.selectOptions(screen.getByLabelText('Estado'), 'inactive');
    await waitFor(() => expect(seen.some((p) => p.get('active') === 'false')).toBe(true));

    await user.type(screen.getByLabelText('Buscar ciudad'), 'norte');
    await waitFor(() => expect(seen.some((p) => p.get('q') === 'norte')).toBe(true));
  });

  test('el nombre de una empresa de la segunda página también se muestra', async () => {
    superadmin();
    const far = {
      ...fx.otherTenant,
      tenant_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      name: 'Lejana',
    };
    const filler = Array.from({ length: 100 }, (_, i) => ({
      ...fx.otherTenant,
      tenant_id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      name: `Relleno ${i}`,
    }));
    server.use(
      http.get(`${BASE}/admin/tenants`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        const items = page === 1 ? filler : [far];
        return HttpResponse.json({ items, total: 101, page, page_size: 100, pages: 2 });
      }),
      http.get(`${BASE}/admin/cities`, () =>
        HttpResponse.json({
          items: [{ ...fx.city, tenant_id: far.tenant_id, name: 'Ciudad Lejana' }],
          total: 1,
          page: 1,
          page_size: 25,
          pages: 1,
        }),
      ),
    );
    renderApp(<AllCities />);

    const table = within(await screen.findByRole('table', { name: 'Catálogo de ciudades' }));

    expect(await table.findByText('Lejana')).toBeInTheDocument();
    expect(table.queryByText(far.tenant_id)).not.toBeInTheDocument();
  });
});
