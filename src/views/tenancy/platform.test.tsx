import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import { setActAsTenant } from '@/api/client';
import { useAuth } from '@/auth/context';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Platform from '@/views/tenancy/Platform';
import WhatsAppConfig from '@/views/tenancy/WhatsAppConfig';

const BASE = '/api/v1';

function superadmin() {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.superadminProfile)));
}

/** Acts as the first tenant for the test, through the real provider. */
function ActAs() {
  const { setActingAsTenant, actingAsTenant } = useAuth();
  return actingAsTenant ? null : (
    <button type="button" onClick={() => setActingAsTenant(fx.tenant.tenant_id)}>
      actuar
    </button>
  );
}

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

describe('WhatsApp', () => {
  test('lista el número de cada empresa con su nombre', async () => {
    superadmin();
    renderApp(<WhatsAppConfig />);

    const row = await rowFor('Mototaxi Seguro');
    expect(row.getByText('+591 7000 0001')).toBeInTheDocument();
    expect(screen.getByText(/Elige una empresa/)).toBeInTheDocument();
  });

  test('el token nunca llega relleno y en una edición en blanco no se envía', async () => {
    superadmin();
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-config`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.whatsappConfig);
      }),
    );
    const { user } = renderApp(
      <>
        <ActAs />
        <WhatsAppConfig />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'actuar' }));

    const token = await screen.findByLabelText(/Token de acceso/);
    expect(token).toHaveValue('');
    expect(token).toHaveAttribute('type', 'password');

    const display = screen.getByLabelText('Número visible');
    await user.clear(display);
    await user.type(display, '+591 7000 0002');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      phone_number_id: fx.whatsappConfig.phone_number_id,
      waba_id: fx.whatsappConfig.waba_id,
      display_phone_number: '+591 7000 0002',
      is_active: true,
    });
    expect(await screen.findByText('Número guardado.')).toBeInTheDocument();
  });

  test('configurar un número nuevo exige el token', async () => {
    superadmin();
    server.use(http.get(`${BASE}/admin/whatsapp-config`, () => HttpResponse.json([])));
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-config`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.whatsappConfig);
      }),
    );
    const { user } = renderApp(
      <>
        <ActAs />
        <WhatsAppConfig />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'actuar' }));

    await user.type(await screen.findByLabelText(/ID del número/), '1090000000000009');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('El token es obligatorio al configurar un número nuevo'),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await user.type(screen.getByLabelText(/Token de acceso/), 'EAAB-secret');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ access_token: 'EAAB-secret' });
  });

  test('el rechazo del servidor (número ya usado) se muestra', async () => {
    superadmin();
    server.use(
      http.put(`${BASE}/admin/whatsapp-config`, () =>
        HttpResponse.json({ detail: 'phone number already in use' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(
      <>
        <ActAs />
        <WhatsAppConfig />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'actuar' }));
    await screen.findByLabelText(/Token de acceso/);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('phone number already in use');
  });

  test('quitar el número pide confirmación', async () => {
    superadmin();
    let deleted = 0;
    server.use(
      http.delete(`${BASE}/admin/whatsapp-config`, () => {
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp(
      <>
        <ActAs />
        <WhatsAppConfig />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'actuar' }));
    await user.click(await screen.findByRole('button', { name: 'Quitar número' }));
    expect(deleted).toBe(0);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar número' }),
    );

    await waitFor(() => expect(deleted).toBe(1));
    setActAsTenant(null);
  });
});

describe('plataforma', () => {
  test('muestra viajes por empresa, uso y auditoría con nombres de empresa', async () => {
    superadmin();
    renderApp(<Platform />);

    const tables = await screen.findAllByRole('table');
    await waitFor(() => expect(tables.length).toBeGreaterThanOrEqual(1));
    const kpi = within(await screen.findByRole('table', { name: 'Viajes por empresa' }));
    expect(await kpi.findByText('Mototaxi Seguro')).toBeInTheDocument();
    expect(kpi.getByText('50')).toBeInTheDocument();

    const usage = within(await screen.findByRole('table', { name: 'Uso por empresa' }));
    expect(await usage.findByText('340')).toBeInTheDocument();

    const audit = within(await screen.findByRole('table', { name: 'Registro de auditoría' }));
    expect(await audit.findByText('drivers')).toBeInTheDocument();
    expect(audit.getByText('UPDATE')).toBeInTheDocument();
  });

  test('cambiar la ventana de KPI vuelve a pedir con las horas elegidas', async () => {
    superadmin();
    const hours: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/admin/kpis/by-tenant`, ({ request }) => {
        hours.push(new URL(request.url).searchParams.get('hours'));
        return HttpResponse.json(fx.kpiGroups);
      }),
    );
    const { user } = renderApp(<Platform />);
    await screen.findByRole('table', { name: 'Viajes por empresa' });

    await user.selectOptions(screen.getByLabelText('Ventana'), '168');

    await waitFor(() => expect(hours).toContain('168'));
    expect(hours[0]).toBe('24');
  });

  test('filtrar la auditoría por empresa y tabla manda los parámetros', async () => {
    superadmin();
    const seen: URLSearchParams[] = [];
    server.use(
      http.get(`${BASE}/admin/audit-logs`, ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [], total: 0, page: 1, page_size: 25, pages: 1 });
      }),
    );
    const { user } = renderApp(<Platform />);
    await screen.findByRole('table', { name: 'Viajes por empresa' });

    await user.selectOptions(await screen.findByLabelText('Empresa'), fx.otherTenant.tenant_id);
    await user.type(screen.getByLabelText('Tabla'), 'drivers');

    await waitFor(() => {
      const last = seen.at(-1)!;
      expect(last.get('tenant_id')).toBe(fx.otherTenant.tenant_id);
      expect(last.get('table_name')).toBe('drivers');
    });
    expect(await screen.findByText('Sin registros para este filtro')).toBeInTheDocument();
  });
});
