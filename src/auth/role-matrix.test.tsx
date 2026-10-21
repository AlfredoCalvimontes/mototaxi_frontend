import { screen, waitFor } from '@testing-library/react';
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

/** Route × role: who may open a gated route, mirroring the backend dependencies. */
const settingsAllowed = {
  SUPERADMIN: true,
  TENANT_ADMIN: true,
  CITY_ADMIN: false,
  OPERATOR: false,
};

describe('matriz ruta × rol', () => {
  test.each(Object.entries(settingsAllowed))(
    '/configuracion para %s → %s',
    async (role, allowed) => {
      asUser(profiles[role as keyof typeof profiles]);
      renderApp(<AppRoutes />, { route: '/configuracion' });

      const nav = await screen.findByRole('navigation', { name: 'Secciones' });
      expect(!!nav.querySelector('a[href="/configuracion"]')).toBe(allowed);
      // Denied roles land on the dashboard instead of the settings view.
      if (!allowed) {
        expect(
          await screen.findByRole('heading', { name: /Resumen/, level: 1 }),
        ).toBeInTheDocument();
      }
    },
  );
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
