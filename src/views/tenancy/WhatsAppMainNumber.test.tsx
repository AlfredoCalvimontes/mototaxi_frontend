import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { useEffect } from 'react';
import { describe, expect, test } from 'vitest';

import type { UserProfile, WhatsAppConfig } from '@/api/types';
import { useAuth } from '@/auth/context';
import { AppRoutes } from '@/routes';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import WhatsAppRouting from '@/views/tenancy/WhatsAppRouting';

const BASE = '/api/v1';

function asUser(profile: UserProfile) {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(profile)));
}

function ActAs({ tenantId }: { tenantId: string }) {
  const { setActingAsTenant } = useAuth();
  useEffect(() => setActingAsTenant(tenantId), [setActingAsTenant, tenantId]);
  return null;
}

function renderPage(tenantId?: string) {
  return renderApp(
    <>
      {tenantId && <ActAs tenantId={tenantId} />}
      <WhatsAppRouting />
    </>,
    { route: '/rutas-whatsapp' },
  );
}

/** The main-number section (the first table on the page is the MAIN table). */
function mainSection() {
  return screen.findByRole('region', { name: 'Número principal' });
}

describe('número principal (MAIN) dentro de WhatsApp', () => {
  test('el superadmin ve el número principal de todas las empresas', async () => {
    asUser(fx.superadminProfile);
    renderPage();
    const section = await mainSection();
    const table = await within(section).findByRole('table', { name: 'Número principal' });
    expect(within(table).getByText(fx.tenant.name)).toBeInTheDocument();
    expect(within(table).getByText('+591 7000 0001')).toBeInTheDocument();
    expect(within(section).getByText(/Elige una empresa/)).toBeInTheDocument();
  });

  test('la empresa no ve la sección del número principal', async () => {
    asUser(fx.adminProfile);
    renderPage();
    await screen.findByRole('table', { name: 'Ciudades' });
    expect(screen.queryByRole('region', { name: 'Número principal' })).not.toBeInTheDocument();
  });

  test('/whatsapp redirige a la pantalla de rutas, que incluye el número principal', async () => {
    asUser(fx.superadminProfile);
    renderApp(<AppRoutes />, { route: '/whatsapp' });
    expect(await screen.findByRole('heading', { name: 'WhatsApp', level: 1 })).toBeInTheDocument();
    expect(await mainSection()).toBeInTheDocument();
    // One WhatsApp entry in the menu: the routing page, not a second one.
    expect(screen.getAllByRole('link', { name: 'WhatsApp' })).toHaveLength(1);
  });

  test('la configuración guardada se lee como activa o apagada en la tabla', async () => {
    asUser(fx.superadminProfile);
    const apagado: WhatsAppConfig = { ...fx.whatsappConfig, is_active: false };
    server.use(http.get(`${BASE}/admin/whatsapp-config`, () => HttpResponse.json([apagado])));
    renderPage();
    const section = await mainSection();
    const table = await within(section).findByRole('table', { name: 'Número principal' });
    expect(within(table).getByText('Inactivo')).toBeInTheDocument();
  });
});
