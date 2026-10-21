import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Drivers from '@/views/Drivers';
import Vehicles from '@/views/Vehicles';

// Not the subject here, and rendering tiles per test is wasted work. The real
// component is covered in FleetMap.test.tsx.
vi.mock('@/components/FleetMap', () => ({ FleetMap: () => <div /> }));

const BASE = '/api/v1';

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

describe('edición de conductor: null se ignora', () => {
  test('envía solo los campos tocados', async () => {
    const bodies = captureBody('patch', '/admin/drivers/:uuid', fx.driver);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Editar' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByLabelText(/Nombre/));
    await user.type(dialog.getByLabelText(/Nombre/), 'Marco A. Peña');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ name: 'Marco A. Peña' });
  });

  test('vaciar la licencia avisa en vez de fingir que la borra', async () => {
    const bodies = captureBody('patch', '/admin/drivers/:uuid', fx.driver);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Editar' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByLabelText(/Licencia/));

    // La ruta ignoraría el null en silencio, así que el formulario lo dice.
    expect(await dialog.findByRole('alert')).toHaveTextContent(/no se pueden borrar/);

    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Sin cambios reales: no se envía nada.
    expect(bodies).toHaveLength(0);
  });

  test('el CI no se ofrece para editar', async () => {
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Editar' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByLabelText(/^CI/)).not.toBeInTheDocument();
    expect(dialog.getByText(/no se edita/)).toBeInTheDocument();
  });
});

describe('registro', () => {
  test('un conductor nuevo sí pide CI y lo envía completo', async () => {
    const bodies = captureBody('post', '/admin/drivers', fx.driver);
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar conductor' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Ana Choque');
    await user.type(dialog.getByLabelText(/^CI/), '9988776 TJ');
    await user.type(dialog.getByLabelText(/WhatsApp/), '+59170001111');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      name: 'Ana Choque',
      ci: '9988776 TJ',
      phone_whatsapp: '+59170001111',
      license_number: null,
    });
  });

  test('no envía el alta si faltan campos obligatorios', async () => {
    const bodies = captureBody('post', '/admin/drivers', fx.driver);
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar conductor' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Nombre/), 'Ana Choque');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(bodies).toHaveLength(0);
    expect(dialog.getAllByText('Este campo es obligatorio').length).toBeGreaterThan(0);
  });

  test('una mototaxi nueva envía los opcionales vacíos como null', async () => {
    const bodies = captureBody('post', '/admin/vehicles', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar mototaxi' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Placa/), 'JKL456');
    await user.type(dialog.getByLabelText(/IMEI/), '860111222333444');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      plate_number: 'JKL456',
      alias: null,
      brand: null,
      model: null,
      tracker_imei: '860111222333444',
      notes: null,
    });
  });

  test('un alta duplicada muestra el mensaje del servidor', async () => {
    server.use(
      http.post(`${BASE}/admin/vehicles`, () =>
        HttpResponse.json({ detail: 'La placa ya está registrada' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(<Vehicles />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar mototaxi' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Placa/), 'ABC123');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('La placa ya está registrada');
  });
});

describe('recarga de la SIM en el formulario', () => {
  async function openNew(user: ReturnType<typeof renderApp>['user']) {
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Registrar mototaxi' }));
    return within(screen.getByRole('dialog'));
  }

  test('los campos de la SIM solo aparecen cuando hay un GPS', async () => {
    const { user } = renderApp(<Vehicles />);
    const dialog = await openNew(user);

    expect(dialog.queryByLabelText('Última recarga')).not.toBeInTheDocument();

    await user.type(dialog.getByLabelText(/IMEI/), '860111222333444');
    expect(dialog.getByLabelText('Última recarga')).toBeInTheDocument();
    expect(dialog.getByLabelText('Crédito cargado')).toBeInTheDocument();
  });

  test('una alta con GPS y recarga envía la fecha y el crédito', async () => {
    const bodies = captureBody('post', '/admin/vehicles', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);
    const dialog = await openNew(user);

    await user.type(dialog.getByLabelText(/Placa/), 'JKL456');
    await user.type(dialog.getByLabelText(/IMEI/), '860111222333444');
    await user.type(dialog.getByLabelText('Última recarga'), '2026-10-01');
    await user.type(dialog.getByLabelText('Crédito cargado'), '10,5');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      tracker_imei: '860111222333444',
      sim_last_recharge_at: '2026-10-01',
      sim_last_recharge_amount: 10.5,
    });
  });

  test('la fecha sin el crédito (o al revés) no se envía y lo explica', async () => {
    const bodies = captureBody('post', '/admin/vehicles', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);
    const dialog = await openNew(user);

    await user.type(dialog.getByLabelText(/Placa/), 'JKL456');
    await user.type(dialog.getByLabelText(/IMEI/), '860111222333444');
    await user.type(dialog.getByLabelText('Última recarga'), '2026-10-01');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByText(/fecha y el crédito, o deja ambos vacíos/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  test('un crédito que no es un número positivo se rechaza', async () => {
    const bodies = captureBody('post', '/admin/vehicles', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);
    const dialog = await openNew(user);

    await user.type(dialog.getByLabelText(/Placa/), 'JKL456');
    await user.type(dialog.getByLabelText(/IMEI/), '860111222333444');
    await user.type(dialog.getByLabelText('Última recarga'), '2026-10-01');
    await user.type(dialog.getByLabelText('Crédito cargado'), 'abc');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByText(/mayor que cero/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  test('al editar, los valores guardados vienen cargados y se puede limpiar', async () => {
    server.use(
      http.get(`${BASE}/admin/vehicles/:uuid`, () =>
        HttpResponse.json({
          ...fx.vehicleDetail,
          sim_last_recharge_at: '2026-10-01',
          sim_last_recharge_amount: 10,
          sim_next_recharge_at: '2026-10-31',
        }),
      ),
    );
    const bodies = captureBody('patch', '/admin/vehicles/:uuid', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Editar' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByDisplayValue('2026-10-01')).toBeInTheDocument();
    expect(dialog.getByDisplayValue('10')).toBeInTheDocument();

    await user.clear(dialog.getByLabelText('Última recarga'));
    await user.clear(dialog.getByLabelText('Crédito cargado'));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ sim_last_recharge_at: null, sim_last_recharge_amount: null });
  });

  test('cambiar solo el crédito reenvía el par completo', async () => {
    server.use(
      http.get(`${BASE}/admin/vehicles/:uuid`, () =>
        HttpResponse.json({
          ...fx.vehicleDetail,
          sim_last_recharge_at: '2026-10-01',
          sim_last_recharge_amount: 10,
          sim_next_recharge_at: '2026-10-31',
        }),
      ),
    );
    const bodies = captureBody('patch', '/admin/vehicles/:uuid', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Editar' }));
    const dialog = within(await screen.findByRole('dialog'));
    const amount = await dialog.findByLabelText('Crédito cargado');
    await user.clear(amount);
    await user.type(amount, '20');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ sim_last_recharge_at: '2026-10-01', sim_last_recharge_amount: 20 });
  });
});

describe('edición de mototaxi: null limpia', () => {
  test('vaciar un campo opcional lo borra explícitamente', async () => {
    const bodies = captureBody('patch', '/admin/vehicles/:uuid', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Editar' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.clear(await dialog.findByLabelText(/Marca/));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ brand: null });
  });

  test('un campo intacto nunca viaja como null', async () => {
    const bodies = captureBody('patch', '/admin/vehicles/:uuid', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Editar' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.clear(await dialog.findByLabelText(/Modelo/));
    await user.type(dialog.getByLabelText(/Modelo/), 'CG 150');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    // Si el IMEI viajara como null aquí, se desconectaría el GPS sin querer.
    expect(bodies[0]).toEqual({ model: 'CG 150' });
  });
});

describe('desconexión del GPS', () => {
  test('vaciar el IMEI exige una confirmación propia antes de guardar', async () => {
    const bodies = captureBody('patch', '/admin/vehicles/:uuid', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Editar' }));
    const form = within(await screen.findByRole('dialog'));
    await user.clear(await form.findByLabelText(/IMEI/));
    await user.click(form.getByRole('button', { name: 'Guardar' }));

    // Guardar no basta: aparece una confirmación que nombra el IMEI y la placa.
    expect(bodies).toHaveLength(0);
    const confirm = within(await screen.findByRole('dialog', { name: 'Desconectar el GPS' }));
    expect(confirm.getByText(/860123456789012/)).toBeInTheDocument();
    expect(confirm.getByText(/ABC123/)).toBeInTheDocument();

    await user.click(confirm.getByRole('button', { name: 'Desconectar GPS' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ tracker_imei: null });
  });

  test('cambiar el IMEI por otro no pide confirmación de desconexión', async () => {
    const bodies = captureBody('patch', '/admin/vehicles/:uuid', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Editar' }));
    const form = within(await screen.findByRole('dialog'));
    await user.clear(await form.findByLabelText(/IMEI/));
    await user.type(form.getByLabelText(/IMEI/), '860999999999999');
    await user.click(form.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ tracker_imei: '860999999999999' });
  });
});

describe('estado del conductor', () => {
  test('la fecha de descanso solo se ofrece para el estado en descanso', async () => {
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Cambiar estado/ }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.queryByLabelText('Descansa hasta')).not.toBeInTheDocument();
    await user.click(dialog.getByRole('radio', { name: 'En descanso' }));
    expect(dialog.getByLabelText('Descansa hasta')).toBeInTheDocument();
  });

  test('no envía resting_until con otros estados: sería un 422', async () => {
    const bodies = captureBody('patch', '/admin/drivers/:uuid/status', fx.driver);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Cambiar estado/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'En descanso' }));
    await user.type(dialog.getByLabelText('Descansa hasta'), '2026-07-20T18:00');
    // El operador cambia de idea: el campo desaparece y no debe viajar.
    await user.click(dialog.getByRole('radio', { name: 'Fuera de turno' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ status: 'OFFLINE', resting_until: null });
  });

  test('un conductor deshabilitado puede volver a estar disponible', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers`, () =>
        HttpResponse.json([{ ...fx.driver, status: 'DISABLED' }]),
      ),
    );
    const bodies = captureBody('patch', '/admin/drivers/:uuid/status', fx.driver);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Cambiar estado/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Disponible' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ status: 'AVAILABLE' });
  });
});

describe('asignación de mototaxi', () => {
  test('quitar la asignación se envía como null explícito', async () => {
    const bodies = captureBody('patch', '/admin/drivers/:uuid/vehicle', fx.driver);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Cambiar mototaxi' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText('Mototaxi'), '');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ vehicle_uuid: null });
  });

  test('no ofrece vehículos que ya conduce otra persona', async () => {
    const { user } = renderApp(<Drivers />);

    await user.click(
      (await rowFor('Lucía Vargas')).getByRole('button', { name: 'Asignar mototaxi' }),
    );
    const select = within(screen.getByRole('dialog')).getByLabelText('Mototaxi');

    // ABC123 la conduce Marco; XYZ789 está libre.
    expect(within(select).queryByRole('option', { name: 'ABC123' })).not.toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'XYZ789' })).toBeInTheDocument();
  });

  test('con el conductor en viaje, la asignación queda bloqueada', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers`, () =>
        HttpResponse.json([{ ...fx.driver, status: 'IN_TRIP' }]),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Cambiar mototaxi' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText(/está en viaje/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});

describe('estado del vehículo', () => {
  test('envía el nuevo estado de la unidad', async () => {
    const bodies = captureBody('patch', '/admin/vehicles/:uuid/status', fx.vehicleDetail);
    const { user } = renderApp(<Vehicles />);

    await user.click(
      (await rowFor('ABC123')).getByRole('button', { name: /^Estado del vehículo/ }),
    );
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Fuera de servicio' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ status: 'OUT_OF_SERVICE' });
  });

  test('no ofrece estados de conductor: son cosas distintas', async () => {
    const { user } = renderApp(<Vehicles />);

    await user.click(
      (await rowFor('ABC123')).getByRole('button', { name: /^Estado del vehículo/ }),
    );
    const dialog = within(screen.getByRole('dialog'));

    // El estado del vehículo es mecánico/administrativo; la elegibilidad para
    // despacho sale del conductor (spec §4.2).
    expect(dialog.queryByRole('radio', { name: 'En viaje' })).not.toBeInTheDocument();
    expect(dialog.queryByRole('radio', { name: 'En descanso' })).not.toBeInTheDocument();
  });

  test('un rechazo del servidor se muestra dentro del diálogo', async () => {
    server.use(
      http.patch(`${BASE}/admin/vehicles/:uuid/status`, () =>
        HttpResponse.json({ detail: 'El conductor está en viaje' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(<Vehicles />);

    await user.click(
      (await rowFor('ABC123')).getByRole('button', { name: /^Estado del vehículo/ }),
    );
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Deshabilitada' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('El conductor está en viaje');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('baja de conductor', () => {
  test('la confirmación explica que es reversible y conserva métricas', async () => {
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Dar de baja' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Marco Peña/)).toBeInTheDocument();
    expect(dialog.getByText(/métricas se conservan/)).toBeInTheDocument();
  });

  test('un conductor ya deshabilitado no ofrece darse de baja otra vez', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers`, () =>
        HttpResponse.json([{ ...fx.driver, status: 'DISABLED' }]),
      ),
    );
    renderApp(<Drivers />);

    const row = await rowFor('Marco Peña');
    expect(row.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument();
  });
});

describe('clave GPS del teléfono (del conductor)', () => {
  const driverWithKey = { ...fx.driver, has_phone_key: true };

  test('genera la clave, la muestra una vez y no la conserva al cerrar', async () => {
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Clave GPS/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Este conductor no tiene clave.')).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Generar clave' }));

    expect(await dialog.findByTestId('phone-key')).toHaveTextContent(
      'test-phone-key-0123456789abcdefghij',
    );
    expect(dialog.getByText(/solo se muestra una vez/)).toBeInTheDocument();
    expect(dialog.getByText(/\/api\/v1\/tracking\/phone$/)).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Listo' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('test-phone-key-0123456789abcdefghij')).not.toBeInTheDocument();
  });

  test('la clave se pide para el conductor, no para su unidad', async () => {
    const calls: string[] = [];
    server.use(
      http.post(`${BASE}/admin/drivers/:uuid/phone-key`, ({ params }) => {
        calls.push(String(params.uuid));
        return HttpResponse.json({ phone_key: 'k' });
      }),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Clave GPS/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Generar clave' }),
    );

    await waitFor(() => expect(calls).toEqual([fx.driver.driver_uuid]));
  });

  test('un conductor con clave ofrece reemplazarla o revocarla, sin mostrar la clave', async () => {
    server.use(http.get(`${BASE}/admin/drivers`, () => HttpResponse.json([driverWithKey])));
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Clave GPS/ }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText('Este conductor ya tiene una clave.')).toBeInTheDocument();
    expect(dialog.getByText(/deja de funcionar al instante/)).toBeInTheDocument();
    expect(dialog.queryByTestId('phone-key')).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Generar una nueva' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Revocar clave' })).toBeInTheDocument();
  });

  test('revocar llama al endpoint del conductor y lo deja sin clave', async () => {
    server.use(http.get(`${BASE}/admin/drivers`, () => HttpResponse.json([driverWithKey])));
    const calls: string[] = [];
    server.use(
      http.delete(`${BASE}/admin/drivers/:uuid/phone-key`, ({ params }) => {
        calls.push(String(params.uuid));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Clave GPS/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Revocar clave' }));

    expect(await dialog.findByText('Este conductor no tiene clave.')).toBeInTheDocument();
    expect(calls).toEqual([fx.driver.driver_uuid]);
  });

  test('un conductor sin mototaxi lo avisa: su clave no mueve ninguna unidad', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers`, () =>
        HttpResponse.json([
          { ...fx.driverWithoutCheckin, has_phone_key: true, current_vehicle_uuid: null },
        ]),
      ),
    );
    const { user } = renderApp(<Drivers />);

    const row = await rowFor('Lucía Vargas');
    expect(row.getByText('Clave sin mototaxi')).toBeInTheDocument();

    await user.click(row.getByRole('button', { name: /Clave GPS/ }));
    expect(
      within(screen.getByRole('dialog')).getByText(/no mueve ninguna unidad/),
    ).toBeInTheDocument();
  });

  test('un error del servidor se muestra y no deja una clave a medias', async () => {
    server.use(
      http.post(`${BASE}/admin/drivers/:uuid/phone-key`, () =>
        HttpResponse.json({ detail: 'Conductor no encontrado' }, { status: 404 }),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Clave GPS/ }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Generar clave' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(/no encontrado/);
    expect(dialog.queryByTestId('phone-key')).not.toBeInTheDocument();
  });

  test('la lista de mototaxis ya no ofrece la clave GPS', async () => {
    renderApp(<Vehicles />);

    const row = await rowFor('ABC123');
    expect(row.queryByRole('button', { name: /Clave GPS/ })).not.toBeInTheDocument();
  });
});

describe('posición del conductor frente a su unidad', () => {
  test('muestra las distancias y que coinciden', async () => {
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Posición' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(await dialog.findByText('Coinciden')).toBeInTheDocument();
    expect(dialog.getAllByText(/18 m/)).not.toHaveLength(0);
    expect(dialog.getByText(/30 s de diferencia/)).toBeInTheDocument();
  });

  test('avisa cuando el conductor y el GPS se alejan, y cuenta los reportes sospechosos', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers/:uuid/position-check`, () =>
        HttpResponse.json({
          ...fx.positionCheck,
          driver_to_tracker_m: 2300,
          diverges: true,
          flagged_fixes: 3,
          driver_trace: [{ ...fx.positionCheck.driver_trace[0], flag: 'DIVERGES_FROM_TRACKER' }],
        }),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Posición' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(await dialog.findByText('Se alejan')).toBeInTheDocument();
    expect(dialog.getByText(/2,3 km/)).toBeInTheDocument();
    expect(dialog.getByText('3')).toBeInTheDocument();
    expect(dialog.getByText('Lejos del GPS de la unidad')).toBeInTheDocument();
  });

  test('un conductor sin reportes lo dice', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers/:uuid/position-check`, () =>
        HttpResponse.json({
          ...fx.positionCheck,
          driver_fix: null,
          driver_to_vehicle_m: null,
          driver_to_tracker_m: null,
          seconds_apart: null,
          driver_trace: [],
        }),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Posición' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(await dialog.findByText(/no ha reportado posición/)).toBeInTheDocument();
  });

  test('un error del servidor se muestra', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers/:uuid/position-check`, () =>
        HttpResponse.json({ detail: 'Conductor no encontrado' }, { status: 404 }),
      ),
    );
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Posición' }));

    expect(
      await within(screen.getByRole('dialog')).findByText(/no encontrado/),
    ).toBeInTheDocument();
  });
});

describe('lista de conductores: datos a la vista', () => {
  test('«Mostrar todo» revela la columna entera y «Ocultar todo» la vuelve a tapar', async () => {
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    expect(screen.queryByText(fx.driver.phone_whatsapp)).not.toBeInTheDocument();
    expect(screen.queryByText(fx.driverWithoutCheckin.phone_whatsapp)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mostrar todo: WhatsApp' }));
    expect(screen.getByText(fx.driver.phone_whatsapp)).toBeInTheDocument();
    expect(screen.getByText(fx.driverWithoutCheckin.phone_whatsapp)).toBeInTheDocument();
    // La columna de CI es otra: sigue tapada.
    expect(screen.queryByText(fx.driver.ci)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ocultar todo: WhatsApp' }));
    expect(screen.queryByText(fx.driver.phone_whatsapp)).not.toBeInTheDocument();
    expect(screen.queryByText(fx.driverWithoutCheckin.phone_whatsapp)).not.toBeInTheDocument();
  });

  test('«Ocultar todo» también tapa lo que se reveló a mano fila por fila', async () => {
    const { user } = renderApp(<Drivers />);
    const row = await rowFor('Marco Peña');

    // El primer «Mostrar» de la fila es el del WhatsApp.
    await user.click(row.getAllByRole('button', { name: /^Mostrar: / })[0]!);
    expect(screen.getByText(fx.driver.phone_whatsapp)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostrar todo: WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Ocultar todo: WhatsApp' }));

    expect(screen.queryByText(fx.driver.phone_whatsapp)).not.toBeInTheDocument();
  });

  test('el botón de estado muestra el estado actual del conductor', async () => {
    renderApp(<Drivers />);

    const row = await rowFor('Marco Peña');
    const button = row.getByRole('button', { name: /Cambiar estado/ });
    expect(within(button).getByText('Disponible')).toBeInTheDocument();
  });

  test('el diálogo de estado dice cuál es el estado actual', async () => {
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: /Cambiar estado/ }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText(/Estado actual/)).toBeInTheDocument();
    expect(dialog.getAllByText('Disponible').length).toBeGreaterThan(0);
  });

  test('con mototaxi asignada el botón ofrece cambiarla; sin ella, asignarla', async () => {
    renderApp(<Drivers />);

    const withMoto = await rowFor('Marco Peña');
    expect(withMoto.getByRole('button', { name: 'Cambiar mototaxi' })).toBeInTheDocument();
    expect(withMoto.queryByRole('button', { name: 'Asignar mototaxi' })).not.toBeInTheDocument();

    const without = await rowFor('Lucía Vargas');
    expect(without.getByRole('button', { name: 'Asignar mototaxi' })).toBeInTheDocument();
  });

  test('la clave GPS configurada se ve como «Activa»; la que falta, como «Sin clave»', async () => {
    server.use(
      http.get(`${BASE}/admin/drivers`, () =>
        HttpResponse.json([{ ...fx.driver, has_phone_key: true }, fx.driverWithoutCheckin]),
      ),
    );
    renderApp(<Drivers />);

    const set = (await rowFor('Marco Peña')).getByRole('button', { name: /Clave GPS/ });
    expect(within(set).getByText('Activa')).toBeInTheDocument();
    expect(set.className).toMatch(/emerald/);

    const missing = (await rowFor('Lucía Vargas')).getByRole('button', { name: /Clave GPS/ });
    expect(within(missing).getByText('Sin clave')).toBeInTheDocument();
    expect(missing.className).not.toMatch(/emerald/);
  });
});
