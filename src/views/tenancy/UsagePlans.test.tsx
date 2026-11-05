import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import type { UsagePlan } from '@/api/types';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import UsagePlans from '@/views/tenancy/UsagePlans';

const BASE = '/api/v1';

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

function withDrivers(...drivers: object[]) {
  server.use(http.get(`${BASE}/admin/drivers`, () => HttpResponse.json(drivers)));
}

function withDetail(plan: UsagePlan, driverCount: number) {
  server.use(
    http.get(`${BASE}/admin/usage-plans/${plan.usage_plan_uuid}`, () =>
      HttpResponse.json({ ...plan, driver_count: driverCount }),
    ),
  );
}

function capture(method: 'patch' | 'post', path: string, response: object) {
  const bodies: unknown[] = [];
  server.use(
    http[method](`${BASE}${path}`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(response, { status: method === 'post' ? 201 : 200 });
    }),
  );
  return bodies;
}

describe('planes de uso', () => {
  test('lista los planes con su precio, etiqueta y conductores', async () => {
    withDrivers(fx.driverWithCredit);
    renderApp(<UsagePlans />);

    const rental = await rowFor('Alquiler de moto');
    expect(rental.getByText('60 por día')).toBeInTheDocument();
    expect(rental.getByText('Con alquiler')).toBeInTheDocument();
    expect(rental.getByText('1')).toBeInTheDocument();
    expect((await rowFor('Acuerdo personalizado')).getByText('Sin cobro')).toBeInTheDocument();
  });

  test('crea un plan con precio decimal con coma', async () => {
    const bodies = capture('post', '/admin/usage-plans', fx.rentalPlan);
    const { user } = renderApp(<UsagePlans />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Nuevo plan' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Solo sistema');
    await user.type(dialog.getByLabelText(/Crédito por día/), '25,5');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        { name: 'Solo sistema', daily_credit: 25.5, includes_vehicle_rental: false },
      ]),
    );
  });

  test('un precio negativo o ilegible no se envía', async () => {
    const bodies = capture('post', '/admin/usage-plans', fx.rentalPlan);
    const { user } = renderApp(<UsagePlans />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Nuevo plan' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Mal plan');
    await user.type(dialog.getByLabelText(/Crédito por día/), '-5');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByText('Escribe un número, 0 o mayor.')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  test('cambiar el precio avisa de los conductores y envía solo el precio', async () => {
    withDrivers(fx.driverWithCredit);
    withDetail(fx.rentalPlan, 3);
    const bodies = capture(
      'patch',
      `/admin/usage-plans/${fx.rentalPlan.usage_plan_uuid}`,
      fx.rentalPlan,
    );
    const { user } = renderApp(<UsagePlans />);

    await user.click((await rowFor('Alquiler de moto')).getByRole('button', { name: 'Editar' }));
    const dialog = within(screen.getByRole('dialog'));
    const price = dialog.getByLabelText(/Crédito por día/);
    await user.clear(price);
    await user.type(price, '45');

    expect(await dialog.findByRole('alert')).toHaveTextContent(
      /recalcula el vencimiento de 3 conductores/,
    );
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(bodies).toEqual([{ daily_credit: 45 }]));
  });

  test('pasar un plan sin cobro a pagado exige confirmar y envía el conteo', async () => {
    withDrivers(fx.driver);
    withDetail(fx.freePlan, 2);
    const bodies = capture(
      'patch',
      `/admin/usage-plans/${fx.freePlan.usage_plan_uuid}`,
      fx.freePlan,
    );
    const { user } = renderApp(<UsagePlans />);

    await user.click(
      (await rowFor('Acuerdo personalizado')).getByRole('button', { name: 'Editar' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    const price = dialog.getByLabelText(/Crédito por día/);
    await user.clear(price);
    await user.type(price, '30');
    await user.click(await dialog.findByRole('button', { name: 'Guardar' }));

    expect(bodies).toHaveLength(0);
    expect(await dialog.findAllByText(/afecta a 2 conductores/)).not.toHaveLength(0);

    await user.click(dialog.getByRole('checkbox', { name: /afecta a 2 conductores/ }));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(bodies).toEqual([{ daily_credit: 30, confirm_affected_drivers: 2 }]),
    );
  });

  test('archivar envía is_active false', async () => {
    withDrivers();
    const bodies = capture(
      'patch',
      `/admin/usage-plans/${fx.rentalPlan.usage_plan_uuid}`,
      fx.rentalPlan,
    );
    const { user } = renderApp(<UsagePlans />);

    await user.click((await rowFor('Alquiler de moto')).getByRole('button', { name: 'Archivar' }));

    await waitFor(() => expect(bodies).toEqual([{ is_active: false }]));
  });

  test('solo se ofrece eliminar un plan sin conductores', async () => {
    withDrivers(fx.driverWithCredit);
    renderApp(<UsagePlans />);

    expect(
      (await rowFor('Alquiler de moto')).queryByRole('button', { name: 'Eliminar' }),
    ).toBeNull();
    expect(
      (await rowFor('Acuerdo personalizado')).getByRole('button', { name: 'Eliminar' }),
    ).toBeInTheDocument();
  });

  test('sin planes ofrece los modelos y el precio queda por llenar', async () => {
    server.use(http.get(`${BASE}/admin/usage-plans`, () => HttpResponse.json([])));
    const { user } = renderApp(<UsagePlans />);

    await user.click(await screen.findByRole('button', { name: 'Alquiler de moto + sistema' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByLabelText(/Nombre/)).toHaveValue('Alquiler de moto + sistema');
    expect(dialog.getByLabelText(/Crédito por día/)).toHaveValue('');
    expect(dialog.getByRole('checkbox', { name: /alquiler/i })).toBeChecked();
  });
});
