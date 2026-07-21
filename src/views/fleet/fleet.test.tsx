import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Drivers from '@/views/Drivers';
import Mototaxis from '@/views/Mototaxis';

// Leaflet needs layout APIs jsdom does not provide.
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
    const bodies = captureBody('post', '/admin/mototaxis', fx.mototaxiDetail);
    const { user } = renderApp(<Mototaxis />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar mototaxi' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Placa/), 'JKL456');
    await user.type(dialog.getByLabelText(/IMEI/), '860111222333444');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      plate_number: 'JKL456',
      brand: null,
      model: null,
      tracker_imei: '860111222333444',
      notes: null,
    });
  });

  test('un alta duplicada muestra el mensaje del servidor', async () => {
    server.use(
      http.post(`${BASE}/admin/mototaxis`, () =>
        HttpResponse.json({ detail: 'La placa ya está registrada' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(<Mototaxis />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Registrar mototaxi' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Placa/), 'ABC123');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent('La placa ya está registrada');
  });
});

describe('edición de mototaxi: null limpia', () => {
  test('vaciar un campo opcional lo borra explícitamente', async () => {
    const bodies = captureBody('patch', '/admin/mototaxis/:uuid', fx.mototaxiDetail);
    const { user } = renderApp(<Mototaxis />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Editar' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.clear(await dialog.findByLabelText(/Marca/));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ brand: null });
  });

  test('un campo intacto nunca viaja como null', async () => {
    const bodies = captureBody('patch', '/admin/mototaxis/:uuid', fx.mototaxiDetail);
    const { user } = renderApp(<Mototaxis />);

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
    const bodies = captureBody('patch', '/admin/mototaxis/:uuid', fx.mototaxiDetail);
    const { user } = renderApp(<Mototaxis />);

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
    const bodies = captureBody('patch', '/admin/mototaxis/:uuid', fx.mototaxiDetail);
    const { user } = renderApp(<Mototaxis />);

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

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Cambiar estado' }));
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.queryByLabelText('Descansa hasta')).not.toBeInTheDocument();
    await user.click(dialog.getByRole('radio', { name: 'En descanso' }));
    expect(dialog.getByLabelText('Descansa hasta')).toBeInTheDocument();
  });

  test('no envía resting_until con otros estados: sería un 422', async () => {
    const bodies = captureBody('patch', '/admin/drivers/:uuid/status', fx.driver);
    const { user } = renderApp(<Drivers />);

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Cambiar estado' }));
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

    await user.click((await rowFor('Marco Peña')).getByRole('button', { name: 'Cambiar estado' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Disponible' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ status: 'AVAILABLE' });
  });
});

describe('asignación de mototaxi', () => {
  test('quitar la asignación se envía como null explícito', async () => {
    const bodies = captureBody('patch', '/admin/drivers/:uuid/mototaxi', fx.driver);
    const { user } = renderApp(<Drivers />);

    await user.click(
      (await rowFor('Marco Peña')).getByRole('button', { name: 'Asignar mototaxi' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText('Mototaxi'), '');
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ mototaxi_uuid: null });
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

    await user.click(
      (await rowFor('Marco Peña')).getByRole('button', { name: 'Asignar mototaxi' }),
    );
    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText(/está en viaje/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});

describe('estado del vehículo', () => {
  test('envía el nuevo estado de la unidad', async () => {
    const bodies = captureBody('patch', '/admin/mototaxis/:uuid/status', fx.mototaxiDetail);
    const { user } = renderApp(<Mototaxis />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Estado del vehículo' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('radio', { name: 'Fuera de servicio' }));
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ status: 'OUT_OF_SERVICE' });
  });

  test('no ofrece estados de conductor: son cosas distintas', async () => {
    const { user } = renderApp(<Mototaxis />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Estado del vehículo' }));
    const dialog = within(screen.getByRole('dialog'));

    // El estado del vehículo es mecánico/administrativo; la elegibilidad para
    // despacho sale del conductor (spec §4.2).
    expect(dialog.queryByRole('radio', { name: 'En viaje' })).not.toBeInTheDocument();
    expect(dialog.queryByRole('radio', { name: 'En descanso' })).not.toBeInTheDocument();
  });

  test('un rechazo del servidor se muestra dentro del diálogo', async () => {
    server.use(
      http.patch(`${BASE}/admin/mototaxis/:uuid/status`, () =>
        HttpResponse.json({ detail: 'El conductor está en viaje' }, { status: 409 }),
      ),
    );
    const { user } = renderApp(<Mototaxis />);

    await user.click((await rowFor('ABC123')).getByRole('button', { name: 'Estado del vehículo' }));
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
