import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import type { UserProfile } from '@/api/types';
import { useAuth } from '@/auth/context';
import { AppRoutes } from '@/routes';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const BASE = '/api/v1';

function asUser(profile: UserProfile) {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(profile)));
}

const profiles = {
  SUPERADMIN: fx.superadminProfile,
  TENANT_ADMIN: fx.adminProfile,
  CITY_ADMIN: fx.cityAdminProfile,
  OPERATOR: fx.operatorProfile,
};

const T = fx.tenant.tenant_id;
const C = fx.city.city_id;

/** Route × role, mirroring the backend dependencies (`SuperUser`, `TenantAdminUser`, `AnyAdminUser`). */
const matrix: [path: string, allowed: Record<keyof typeof profiles, boolean>][] = [
  ['/', { SUPERADMIN: true, TENANT_ADMIN: true, CITY_ADMIN: true, OPERATOR: true }],
  ['/configuracion', { SUPERADMIN: true, TENANT_ADMIN: true, CITY_ADMIN: false, OPERATOR: false }],
  [
    '/mototaxis/tipos',
    { SUPERADMIN: true, TENANT_ADMIN: true, CITY_ADMIN: false, OPERATOR: false },
  ],
  ['/tenants', { SUPERADMIN: true, TENANT_ADMIN: false, CITY_ADMIN: false, OPERATOR: false }],
  ['/whatsapp', { SUPERADMIN: true, TENANT_ADMIN: false, CITY_ADMIN: false, OPERATOR: false }],
  ['/plataforma', { SUPERADMIN: true, TENANT_ADMIN: false, CITY_ADMIN: false, OPERATOR: false }],
  [`/tenants/${T}`, { SUPERADMIN: true, TENANT_ADMIN: true, CITY_ADMIN: false, OPERATOR: false }],
  [
    `/tenants/${T}/cities`,
    { SUPERADMIN: true, TENANT_ADMIN: true, CITY_ADMIN: true, OPERATOR: false },
  ],
  [
    `/tenants/${T}/cities/${C}`,
    { SUPERADMIN: true, TENANT_ADMIN: true, CITY_ADMIN: true, OPERATOR: false },
  ],
  [
    `/tenants/${T}/cities/${C}/access`,
    { SUPERADMIN: true, TENANT_ADMIN: true, CITY_ADMIN: false, OPERATOR: false },
  ],
];

describe('matriz ruta × rol', () => {
  describe.each(matrix)('%s', (path, allowed) => {
    test.each(Object.entries(allowed))('%s → %s', async (role, canOpen) => {
      asUser(profiles[role as keyof typeof profiles]);
      renderApp(<AppRoutes />, { route: path });

      await screen.findByRole('navigation', { name: 'Secciones' });
      // A denied role is bounced to the dashboard; an allowed one never reaches
      // it (except on `/`, where the dashboard is the page).
      if (path === '/') return;
      if (canOpen) {
        expect(
          screen.queryByRole('heading', { name: /Resumen/, level: 1 }),
        ).not.toBeInTheDocument();
      } else {
        expect(
          await screen.findByRole('heading', { name: /Resumen/, level: 1 }),
        ).toBeInTheDocument();
      }
    });
  });
});

describe('navegación por rol', () => {
  test.each([
    ['SUPERADMIN', ['Empresas', 'WhatsApp', 'Plataforma', 'Tipos de vehículo', 'Configuración']],
    ['TENANT_ADMIN', ['Mi empresa', 'Ciudades', 'Tipos de vehículo', 'Configuración']],
    ['CITY_ADMIN', ['Ciudades']],
    ['OPERATOR', []],
  ] as const)('%s ve sus enlaces', async (role, links) => {
    asUser(profiles[role]);
    renderApp(<AppRoutes />);

    const nav = await screen.findByRole('navigation', { name: 'Secciones' });
    const names = [
      'Empresas',
      'WhatsApp',
      'Plataforma',
      'Mi empresa',
      'Ciudades',
      'Tipos de vehículo',
      'Configuración',
    ];
    for (const name of names) {
      const present = !!within(nav).queryByRole('link', { name });
      expect(present, `${role} / ${name}`).toBe(links.includes(name as never));
    }
  });
});

describe('actuar como empresa', () => {
  test('envía X-Tenant-Id, muestra el banner, vacía la caché y se limpia al salir', async () => {
    asUser(fx.superadminProfile);
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/admin/kpis`, ({ request }) => {
        seen.push(request.headers.get('X-Tenant-Id'));
        return HttpResponse.json({});
      }),
    );

    function Probe() {
      const { setActingAsTenant } = useAuth();
      return (
        <button type="button" onClick={() => setActingAsTenant('tenant-b')}>
          actuar
        </button>
      );
    }
    const { user, queryClient } = renderApp(
      <>
        <Probe />
        <AppRoutes />
      </>,
    );
    await screen.findByRole('navigation', { name: 'Secciones' });
    queryClient.setQueryData(['stale'], 'tenant-a-row');

    await user.click(screen.getByRole('button', { name: 'actuar' }));
    expect(await screen.findByText('Actuando como tenant-b')).toBeInTheDocument();
    expect(queryClient.getQueryData(['stale'])).toBeUndefined();
    await waitFor(() => expect(seen).toContain('tenant-b'));

    await user.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.queryByText(/Actuando como/)).not.toBeInTheDocument());
    await waitFor(() => expect(seen.at(-1)).toBeNull());
  });
});
