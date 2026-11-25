import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Platform from '@/views/tenancy/Platform';

const BASE = '/api/v1';

function superadmin() {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.superadminProfile)));
}

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

    const kpiSection = within(screen.getByRole('region', { name: 'Viajes por empresa' }));
    await user.selectOptions(kpiSection.getByLabelText('Ventana'), '168');

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

    const auditSection = within(
      await screen.findByRole('region', { name: 'Registro de auditoría' }),
    );
    await user.selectOptions(auditSection.getByLabelText('Empresa'), fx.otherTenant.tenant_id);
    await user.type(auditSection.getByLabelText('Tabla'), 'drivers');

    await waitFor(() => {
      const last = seen.at(-1)!;
      expect(last.get('tenant_id')).toBe(fx.otherTenant.tenant_id);
      expect(last.get('table_name')).toBe('drivers');
    });
    expect(await screen.findByText('Sin registros para este filtro')).toBeInTheDocument();
  });
});
