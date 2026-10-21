import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import type { Driver } from '@/api/types';
import { useAuth } from '@/auth/context';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Drivers from '@/views/Drivers';

const BASE = '/api/v1';

const northDriver: Driver = { ...fx.driver, driver_uuid: 'n-1', name: 'Nora del Norte' };
const southDriver: Driver = { ...fx.driver, driver_uuid: 's-1', name: 'Saúl del Sur' };

/** Two datasets, picked by the `X-Tenant-Id` the SPA sends — like the real backend under act-as. */
function twoTenants() {
  server.use(
    http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.superadminProfile)),
    http.get(`${BASE}/admin/drivers`, ({ request }) => {
      const tenant = request.headers.get('X-Tenant-Id');
      if (tenant === 'north') return HttpResponse.json([northDriver]);
      if (tenant === 'south') return HttpResponse.json([southDriver]);
      return HttpResponse.json([]);
    }),
  );
}

function Switch() {
  const { setActingAsTenant } = useAuth();
  return (
    <>
      <button type="button" onClick={() => setActingAsTenant('north')}>
        norte
      </button>
      <button type="button" onClick={() => setActingAsTenant('south')}>
        sur
      </button>
      <button type="button" onClick={() => setActingAsTenant(null)}>
        ninguna
      </button>
    </>
  );
}

describe('cambio de empresa', () => {
  test('nunca muestra filas de la empresa anterior', async () => {
    twoTenants();
    const { user } = renderApp(
      <>
        <Switch />
        <Drivers />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: 'norte' }));
    expect(await screen.findByText('Nora del Norte')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'sur' }));
    expect(await screen.findByText('Saúl del Sur')).toBeInTheDocument();
    // Gone as soon as the new tenant's rows are in; never both.
    expect(screen.queryByText('Nora del Norte')).not.toBeInTheDocument();
  });

  test('al salir de la empresa vuelve a la vista sin empresa', async () => {
    twoTenants();
    const { user } = renderApp(
      <>
        <Switch />
        <Drivers />
      </>,
    );

    await user.click(await screen.findByRole('button', { name: 'sur' }));
    await screen.findByText('Saúl del Sur');

    await user.click(screen.getByRole('button', { name: 'ninguna' }));
    await waitFor(() => expect(screen.queryByText('Saúl del Sur')).not.toBeInTheDocument());
  });

  test('el cambio descarta la caché: no sirve datos viejos mientras llegan los nuevos', async () => {
    twoTenants();
    const { user, queryClient } = renderApp(
      <>
        <Switch />
        <Drivers />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'norte' }));
    await screen.findByText('Nora del Norte');

    // Hold the south response so the in-between state is observable.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(`${BASE}/admin/drivers`, async () => {
        await gate;
        return HttpResponse.json([southDriver]);
      }),
    );
    await user.click(screen.getByRole('button', { name: 'sur' }));

    expect(queryClient.getQueryData(['drivers', 'all'])).toBeUndefined();
    expect(screen.queryByText('Nora del Norte')).not.toBeInTheDocument();
    release();
    expect(await screen.findByText('Saúl del Sur')).toBeInTheDocument();
  });
});
