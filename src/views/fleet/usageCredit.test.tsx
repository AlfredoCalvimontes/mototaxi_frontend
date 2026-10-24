import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Drivers from '@/views/Drivers';

vi.mock('@/components/FleetMap', () => ({ FleetMap: () => <div /> }));

const BASE = '/api/v1';

function withDrivers(...drivers: object[]) {
  server.use(http.get(`${BASE}/admin/drivers`, () => HttpResponse.json(drivers)));
}

async function rowFor(text: string) {
  const rows = await within(await screen.findByRole('table')).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(text))!);
}

function captureBody(method: 'patch' | 'post', path: string, response: object) {
  const bodies: unknown[] = [];
  server.use(
    http[method](`${BASE}${path}`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(response);
    }),
  );
  return bodies;
}

describe('crédito de uso en la tabla', () => {
  test('muestra el crédito y la fecha de vencimiento', async () => {
    withDrivers(fx.driverWithCredit);
    renderApp(<Drivers />);

    const row = await rowFor('Rafael Soria');

    expect(row.getByText('180')).toBeInTheDocument();
    expect(row.getByText('01/01/2099, 10:00')).toBeInTheDocument();
    expect(row.queryByText('Crédito vencido')).not.toBeInTheDocument();
  });

  test('un crédito vencido se ve en rojo y con alerta', async () => {
    withDrivers(fx.driverCreditExpired);
    renderApp(<Drivers />);

    const row = await rowFor('Elena Cruz');

    expect(row.getByText('Crédito vencido')).toBeInTheDocument();
    expect(row.getByText('0')).toHaveClass('text-red-700');
    expect(row.getByText('01/10/2026, 10:00')).toHaveClass('text-red-700');
    expect(row.getByText('Crédito vencido').closest('tr')).toHaveClass('bg-red-50/70');
  });

  test('quien no usa crédito no muestra nada ni ofrece agregarlo', async () => {
    withDrivers(fx.driver);
    renderApp(<Drivers />);

    const row = await rowFor('Marco Peña');

    expect(row.queryByText('Crédito vencido')).not.toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Agregar crédito' })).not.toBeInTheDocument();
  });
});

describe('agregar crédito', () => {
  test('envía el monto y refresca la lista', async () => {
    withDrivers(fx.driverWithCredit);
    const bodies = captureBody('post', '/admin/drivers/:uuid/usage-credit', fx.driverWithCredit);
    const { user } = renderApp(<Drivers />);

    await user.click(
      (await rowFor('Rafael Soria')).getByRole('button', { name: 'Agregar crédito' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Crédito actual: 180/)).toBeInTheDocument();
    await user.type(dialog.getByLabelText(/Monto/), '120,5');
    await user.click(dialog.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(bodies).toEqual([{ amount: 120.5 }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('un monto negativo avisa que reduce el crédito', async () => {
    withDrivers(fx.driverWithCredit);
    const bodies = captureBody('post', '/admin/drivers/:uuid/usage-credit', fx.driverWithCredit);
    const { user } = renderApp(<Drivers />);

    await user.click(
      (await rowFor('Rafael Soria')).getByRole('button', { name: 'Agregar crédito' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('alert')).not.toBeInTheDocument();
    await user.type(dialog.getByLabelText(/Monto/), '-50');

    expect(await dialog.findByRole('alert')).toHaveTextContent(/reduce el crédito/);
    await user.click(dialog.getByRole('button', { name: 'Quitar crédito' }));
    await waitFor(() => expect(bodies).toEqual([{ amount: -50 }]));
  });

  test('cero o texto no se envían', async () => {
    withDrivers(fx.driverWithCredit);
    const bodies = captureBody('post', '/admin/drivers/:uuid/usage-credit', fx.driverWithCredit);
    const { user } = renderApp(<Drivers />);

    await user.click(
      (await rowFor('Rafael Soria')).getByRole('button', { name: 'Agregar crédito' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Monto/), '0');
    await user.click(dialog.getByRole('button', { name: 'Agregar' }));
    expect(dialog.getByText('Escribe un monto distinto de cero.')).toBeInTheDocument();

    await user.clear(dialog.getByLabelText(/Monto/));
    await user.type(dialog.getByLabelText(/Monto/), 'abc');
    await user.click(dialog.getByRole('button', { name: 'Agregar' }));

    expect(bodies).toHaveLength(0);
  });

  test('el diálogo de un crédito vencido lo dice', async () => {
    withDrivers(fx.driverCreditExpired);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Elena Cruz')).getByRole('button', { name: 'Agregar crédito' }));

    expect(within(screen.getByRole('dialog')).getByText(/Está vencido/)).toBeInTheDocument();
  });

  test('muestra el error del servidor y no cierra', async () => {
    withDrivers(fx.driverWithCredit);
    server.use(
      http.post(`${BASE}/admin/drivers/:uuid/usage-credit`, () =>
        HttpResponse.json({ detail: 'sin crédito de uso' }, { status: 422 }),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click(
      (await rowFor('Rafael Soria')).getByRole('button', { name: 'Agregar crédito' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Monto/), '10');
    await user.click(dialog.getByRole('button', { name: 'Agregar' }));

    expect(await dialog.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('plan de uso en el formulario', () => {
  test('el alta envía el plan elegido', async () => {
    const bodies = captureBody('post', '/admin/drivers', fx.driver);
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar conductor' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Ana Choque');
    await user.type(dialog.getByLabelText(/^CI/), '9988776 TJ');
    await user.type(dialog.getByLabelText(/WhatsApp/), '+59170001111');
    await user.selectOptions(await dialog.findByLabelText(/Plan de uso/), 'Alquiler de moto');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ usage_plan_uuid: fx.rentalPlan.usage_plan_uuid });
  });

  test('el alta exige elegir un plan', async () => {
    const bodies = captureBody('post', '/admin/drivers', fx.driver);
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar conductor' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Ana Choque');
    await user.type(dialog.getByLabelText(/^CI/), '9988776 TJ');
    await user.type(dialog.getByLabelText(/WhatsApp/), '+59170001111');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByText('Este campo es obligatorio')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  test('sin planes el formulario manda a crearlos', async () => {
    server.use(http.get(`${BASE}/admin/usage-plans`, () => HttpResponse.json([])));
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar conductor' }));

    expect(
      await within(screen.getByRole('dialog')).findByRole('link', { name: 'Crear planes' }),
    ).toBeInTheDocument();
  });

  test('cambiar de plan avisa que se salda al precio anterior y envía solo el plan', async () => {
    withDrivers(fx.driverWithCredit);
    const bodies = captureBody('patch', '/admin/drivers/:uuid', fx.driverWithCredit);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Rafael Soria')).getByRole('button', { name: 'Editar' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('alert')).not.toBeInTheDocument();
    await user.selectOptions(await dialog.findByLabelText(/Plan de uso/), 'Acuerdo personalizado');

    expect(await dialog.findByRole('alert')).toHaveTextContent(/precio del plan anterior/);
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(bodies).toEqual([{ usage_plan_uuid: fx.freePlan.usage_plan_uuid }]));
  });
});
