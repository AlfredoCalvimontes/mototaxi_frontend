import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { useEffect } from 'react';
import { describe, expect, test, vi } from 'vitest';

import type { UserProfile } from '@/api/types';
import { useAuth } from '@/auth/context';
import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import WhatsAppRouting from '@/views/tenancy/WhatsAppRouting';

const BASE = '/api/v1';

function asUser(profile: UserProfile) {
  server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(profile)));
}

/** Selects a tenant the way the header does for a superadmin. */
function ActAs({ tenantId }: { tenantId: string }) {
  const { setActingAsTenant } = useAuth();
  useEffect(() => setActingAsTenant(tenantId), [setActingAsTenant, tenantId]);
  return null;
}

function renderRouting(tenantId?: string) {
  return renderApp(
    <>
      {tenantId && <ActAs tenantId={tenantId} />}
      <WhatsAppRouting />
    </>,
    { route: '/rutas-whatsapp' },
  );
}

async function cityRow(name: string) {
  const table = await screen.findByRole('table', { name: 'Ciudades' });
  const rows = await within(table).findAllByRole('row');
  return within(rows.find((row) => within(row).queryByText(name))!);
}

describe('rutas WhatsApp por ciudad', () => {
  test('la empresa ve su ruta por ciudad y no tiene controles de escritura', async () => {
    asUser(fx.adminProfile);
    renderRouting();

    const villa = await cityRow(fx.city.name);
    expect(villa.getAllByText('+591 7000 0001').length).toBeGreaterThan(0);
    const sec = await cityRow(fx.secondCity.name);
    expect(sec.getByText('Sí')).toBeInTheDocument();
    expect(sec.getByText('+591 7000 9999')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar número' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delegar a la plataforma' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Agregar número de plataforma' }),
    ).not.toBeInTheDocument();
  });

  test('muestra el motivo cuando ningún número atiende la ciudad', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () =>
        HttpResponse.json([
          {
            ...fx.cityRoutingRows[0],
            own_city_number: null,
            serving: { number: null, deny_reason: 'number_unavailable' },
          },
        ]),
      ),
    );
    renderRouting();

    const villa = await cityRow(fx.city.name);
    expect(villa.getByText('El número de esta ciudad está apagado.')).toBeInTheDocument();
  });

  test('el superadmin sin empresa elegida ve la indicación y no consulta las ciudades', async () => {
    asUser(fx.superadminProfile);
    const citiesSpy = vi.fn();
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () => {
        citiesSpy();
        return HttpResponse.json([]);
      }),
    );
    renderRouting();

    expect(
      await screen.findByText('Elige una empresa (arriba) para ver y configurar sus ciudades.'),
    ).toBeInTheDocument();
    expect(citiesSpy).not.toHaveBeenCalled();
  });

  test('el superadmin delega una ciudad sin número propio', async () => {
    asUser(fx.superadminProfile);
    const delegated = vi.fn();
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () =>
        HttpResponse.json([{ ...fx.cityRoutingRows[0], own_city_number: null }]),
      ),
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/delegation`, ({ params }) => {
        delegated(params.uuid);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Delegar a la plataforma' }));
    await waitFor(() => expect(delegated).toHaveBeenCalledWith(fx.city.city_id));
  });

  test('no se puede delegar una ciudad con número propio', async () => {
    asUser(fx.superadminProfile);
    renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    expect(villa.getByRole('button', { name: 'Delegar a la plataforma' })).toBeDisabled();
  });

  test('muestra el rechazo del servidor al delegar', async () => {
    asUser(fx.superadminProfile);
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/delegation`, () =>
        HttpResponse.json(
          { detail: 'la empresa tiene número propio para esta ciudad' },
          { status: 422 },
        ),
      ),
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () =>
        HttpResponse.json([{ ...fx.cityRoutingRows[0], own_city_number: null }]),
      ),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Delegar a la plataforma' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'la empresa tiene número propio para esta ciudad',
    );
  });

  test('guardar un número exige el token y lo envía en el PUT', async () => {
    asUser(fx.superadminProfile);
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/number`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.ownCityNumber);
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const sec = await cityRow(fx.secondCity.name);
    await user.click(sec.getByRole('button', { name: 'Asignar número' }));
    const form = screen.getByRole('form', { name: /Asignar número/ });

    await user.type(within(form).getByLabelText(/ID del número/), '3000');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(bodies).toHaveLength(0);
    expect(within(form).getAllByText(/obligatorio/i).length).toBeGreaterThan(0);

    await user.type(within(form).getByLabelText(/Token de acceso/), 'tok-secreto');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ phone_number_id: '3000', access_token: 'tok-secreto' });
  });

  test('quitar el número propio pide confirmación antes del DELETE', async () => {
    asUser(fx.superadminProfile);
    const removed = vi.fn();
    server.use(
      http.delete(`${BASE}/admin/whatsapp-routing/numbers/:uuid`, ({ params }) => {
        removed(params.uuid);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Quitar número propio' }));
    const dialog = await screen.findByRole('dialog');
    expect(removed).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(removed).toHaveBeenCalledWith(fx.ownCityNumber.number_uuid));
  });
});

const CITY2 = fx.secondCity.city_id;

/** A city row where the superadmin's city has no own number and is delegated. */
function delegatedRow() {
  return fx.cityRoutingRows[1]!;
}

describe('rutas WhatsApp: acciones del superadmin', () => {
  test('replace: el formulario abre con el número actual y el token sigue siendo obligatorio', async () => {
    asUser(fx.superadminProfile);
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/number`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.ownCityNumber);
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Cambiar número' }));
    const form = screen.getByRole('form', { name: /Cambiar número — Villa Montes/ });
    expect(within(form).getByLabelText(/ID del número/)).toHaveValue('1000000000001');

    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(bodies).toHaveLength(0);
    expect(
      within(form).getByText('Obligatorio en cada guardado. Se cifra y no se vuelve a mostrar.'),
    ).toBeInTheDocument();
  });

  test('guardar envía los opcionales vacíos como null y el aviso de éxito cierra el formulario', async () => {
    asUser(fx.superadminProfile);
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/number`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(fx.ownCityNumber);
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const sec = await cityRow(fx.secondCity.name);
    await user.click(sec.getByRole('button', { name: 'Asignar número' }));
    const form = screen.getByRole('form', { name: /Asignar número — Yacuiba/ });
    await user.type(within(form).getByLabelText(/ID del número/), '  3000  ');
    await user.type(within(form).getByLabelText(/Token de acceso/), 'tok');
    await user.click(within(form).getByRole('checkbox', { name: /Número activo/ }));
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      phone_number_id: '3000',
      access_token: 'tok',
      waba_id: null,
      display_phone_number: null,
      is_active: false,
    });
    expect(await screen.findByText('Número guardado.')).toBeInTheDocument();
    expect(
      screen.queryByRole('form', { name: /Asignar número — Yacuiba/ }),
    ).not.toBeInTheDocument();
  });

  test('cancelar el formulario de número no envía nada', async () => {
    asUser(fx.superadminProfile);
    const saved = vi.fn();
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/number`, () => {
        saved();
        return HttpResponse.json(fx.ownCityNumber);
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const sec = await cityRow(fx.secondCity.name);
    await user.click(sec.getByRole('button', { name: 'Asignar número' }));
    const form = screen.getByRole('form', { name: /Asignar número/ });
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: /Asignar número/ })).not.toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });

  test('un 503 al guardar (cifrado no configurado) se muestra en el formulario', async () => {
    asUser(fx.superadminProfile);
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/cities/:uuid/number`, () =>
        HttpResponse.json({ detail: 'cifrado no disponible' }, { status: 503 }),
      ),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const sec = await cityRow(fx.secondCity.name);
    await user.click(sec.getByRole('button', { name: 'Asignar número' }));
    const form = screen.getByRole('form', { name: /Asignar número/ });
    await user.type(within(form).getByLabelText(/ID del número/), '3000');
    await user.type(within(form).getByLabelText(/Token de acceso/), 'tok');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('cifrado no disponible');
  });

  test('delegar muestra el aviso de éxito', async () => {
    asUser(fx.superadminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () =>
        HttpResponse.json([{ ...fx.cityRoutingRows[0], own_city_number: null }]),
      ),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Delegar a la plataforma' }));
    expect(await screen.findByText('Ciudad delegada a la plataforma.')).toBeInTheDocument();
  });

  test('quitar delegación llama al DELETE de la delegación', async () => {
    asUser(fx.superadminProfile);
    const undelegated = vi.fn();
    server.use(
      http.delete(`${BASE}/admin/whatsapp-routing/cities/:uuid/delegation`, ({ params }) => {
        undelegated(params.uuid);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const sec = await cityRow(fx.secondCity.name);
    await user.click(sec.getByRole('button', { name: 'Quitar delegación' }));
    await waitFor(() => expect(undelegated).toHaveBeenCalledWith(CITY2));
    expect(await screen.findByText('Delegación quitada.')).toBeInTheDocument();
  });

  test('una ciudad delegada no muestra el botón de delegar', async () => {
    asUser(fx.superadminProfile);
    renderRouting(fx.tenant.tenant_id);
    const sec = await cityRow(fx.secondCity.name);
    expect(sec.queryByRole('button', { name: 'Delegar a la plataforma' })).not.toBeInTheDocument();
    expect(sec.getByRole('button', { name: 'Quitar delegación' })).toBeEnabled();
  });

  test('cancelar el diálogo de quitar número no hace DELETE', async () => {
    asUser(fx.superadminProfile);
    const removed = vi.fn();
    server.use(
      http.delete(`${BASE}/admin/whatsapp-routing/numbers/:uuid`, () => {
        removed();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Quitar número propio' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(removed).not.toHaveBeenCalled();
  });

  test('quitar número muestra el aviso y el error del servidor si falla', async () => {
    asUser(fx.superadminProfile);
    server.use(
      http.delete(`${BASE}/admin/whatsapp-routing/numbers/:uuid`, () =>
        HttpResponse.json({ detail: 'número en uso' }, { status: 409 }),
      ),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const villa = await cityRow(fx.city.name);
    await user.click(villa.getByRole('button', { name: 'Quitar número propio' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));
    expect(await within(dialog).findByText('número en uso')).toBeInTheDocument();
  });

  test('el número de plataforma se quita desde su tabla con confirmación', async () => {
    asUser(fx.superadminProfile);
    const removed = vi.fn();
    server.use(
      http.delete(`${BASE}/admin/whatsapp-routing/numbers/:uuid`, ({ params }) => {
        removed(params.uuid);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const table = await screen.findByRole('table', { name: 'Números de la plataforma' });
    await user.click(within(table).getByRole('button', { name: 'Quitar' }));
    const dialog = await screen.findByRole('dialog');
    expect(removed).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(removed).toHaveBeenCalledWith(fx.platformMainNumber.number_uuid));
    expect(await screen.findByText('Número quitado.')).toBeInTheDocument();
  });
});

describe('rutas WhatsApp: número de plataforma', () => {
  test('agrega un número MAIN de plataforma sin ciudad', async () => {
    asUser(fx.superadminProfile);
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/platform-numbers`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(fx.platformMainNumber);
      }),
    );
    const { user } = renderRouting();

    await user.click(await screen.findByRole('button', { name: 'Agregar número de plataforma' }));
    const form = screen.getByRole('form', { name: 'Números de la plataforma' });
    await user.type(within(form).getByLabelText(/ID del número/), '2000');
    await user.type(within(form).getByLabelText(/Token de acceso/), 'tok-plat');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      phone_number_id: '2000',
      access_token: 'tok-plat',
      role: 'MAIN',
      city_uuid: null,
    });
    expect(await screen.findByText('Número guardado.')).toBeInTheDocument();
  });

  test('un número de ciudad exige elegir la ciudad antes de guardar', async () => {
    asUser(fx.superadminProfile);
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/platform-numbers`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(fx.platformMainNumber);
      }),
    );
    const { user } = renderRouting();

    await user.click(await screen.findByRole('button', { name: 'Agregar número de plataforma' }));
    const form = screen.getByRole('form', { name: 'Números de la plataforma' });
    await user.selectOptions(within(form).getByLabelText('Rol'), 'CITY');
    await user.type(within(form).getByLabelText(/ID del número/), '2001');
    await user.type(within(form).getByLabelText(/Token de acceso/), 'tok');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    expect(await within(form).findByText('Elige una ciudad')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await user.selectOptions(
      within(form).getByLabelText(/Ciudad \(solo para número de ciudad\)/),
      CITY2,
    );
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ role: 'CITY', city_uuid: CITY2 });
  });

  test('cancelar cierra el formulario de plataforma sin guardar', async () => {
    asUser(fx.superadminProfile);
    const saved = vi.fn();
    server.use(
      http.put(`${BASE}/admin/whatsapp-routing/platform-numbers`, () => {
        saved();
        return HttpResponse.json(fx.platformMainNumber);
      }),
    );
    const { user } = renderRouting();

    await user.click(await screen.findByRole('button', { name: 'Agregar número de plataforma' }));
    const form = screen.getByRole('form', { name: 'Números de la plataforma' });
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('form', { name: 'Números de la plataforma' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Agregar número de plataforma' }),
    ).toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
  });
});

describe('rutas WhatsApp: vista previa "¿Quién atiende una ciudad?"', () => {
  test('muestra el número que atiende la ciudad elegida', async () => {
    asUser(fx.adminProfile);
    const { user } = renderRouting();
    await screen.findByRole('table', { name: 'Ciudades' });

    const region = screen.getByRole('region', { name: '¿Quién atiende una ciudad?' });
    await user.selectOptions(within(region).getByRole('combobox'), CITY2);
    expect(await within(region).findByRole('status')).toHaveTextContent('+591 7000 9999');
  });

  test('muestra el motivo cuando la empresa no opera la ciudad', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities/:uuid/serving`, () =>
        HttpResponse.json({ number: null, deny_reason: 'not_operating' }),
      ),
    );
    const { user } = renderRouting();
    await screen.findByRole('table', { name: 'Ciudades' });

    const region = screen.getByRole('region', { name: '¿Quién atiende una ciudad?' });
    await user.selectOptions(within(region).getByRole('combobox'), CITY2);
    expect(await within(region).findByRole('status')).toHaveTextContent(
      'La empresa no opera en esta ciudad.',
    );
  });

  test('muestra "Ninguno" cuando no hay motivo ni número', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities/:uuid/serving`, () =>
        HttpResponse.json({ number: null, deny_reason: null }),
      ),
    );
    const { user } = renderRouting();
    await screen.findByRole('table', { name: 'Ciudades' });

    const region = screen.getByRole('region', { name: '¿Quién atiende una ciudad?' });
    await user.selectOptions(within(region).getByRole('combobox'), CITY2);
    expect(await within(region).findByRole('status')).toHaveTextContent('Ninguno');
  });

  test('un error al consultar se muestra como alerta', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities/:uuid/serving`, () =>
        HttpResponse.json({ detail: 'servicio no disponible' }, { status: 500 }),
      ),
    );
    const { user } = renderRouting();
    await screen.findByRole('table', { name: 'Ciudades' });

    const region = screen.getByRole('region', { name: '¿Quién atiende una ciudad?' });
    await user.selectOptions(within(region).getByRole('combobox'), CITY2);
    expect(await within(region).findByRole('alert')).toBeInTheDocument();
  });
});

describe('rutas WhatsApp: lectura y estados vacíos', () => {
  test('la empresa no ve ningún botón de escritura, tampoco al quitar números', async () => {
    asUser(fx.adminProfile);
    renderRouting();
    const table = await screen.findByRole('table', { name: 'Números de la empresa' });
    expect(within(table).queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    const platform = screen.getByRole('table', { name: 'Números de la plataforma' });
    expect(within(platform).queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar delegación' })).not.toBeInTheDocument();
  });

  test('sin ciudades muestra el aviso de la empresa', async () => {
    asUser(fx.adminProfile);
    server.use(http.get(`${BASE}/admin/whatsapp-routing/cities`, () => HttpResponse.json([])));
    renderRouting();
    expect(
      await screen.findByText('La empresa no opera ninguna ciudad todavía.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '¿Quién atiende una ciudad?' }),
    ).not.toBeInTheDocument();
  });

  test('sin números de empresa y de plataforma muestra los avisos vacíos', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/numbers`, () => HttpResponse.json([])),
      http.get(`${BASE}/admin/whatsapp-routing/platform-numbers`, () => HttpResponse.json([])),
    );
    renderRouting();
    expect(await screen.findByText('La empresa no tiene números.')).toBeInTheDocument();
    expect(screen.getByText('La plataforma no tiene números.')).toBeInTheDocument();
  });

  test('si falla la carga de ciudades se muestra el error con reintento', async () => {
    asUser(fx.adminProfile);
    let attempts = 0;
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ detail: 'caído' }, { status: 500 })
          : HttpResponse.json(fx.cityRoutingRows);
      }),
    );
    const { user } = renderRouting();
    const retry = await screen.findByRole('button', { name: /reintentar/i });
    await user.click(retry);
    expect(await screen.findByRole('table', { name: 'Ciudades' })).toBeInTheDocument();
  });

  test('el superadmin sin empresa puede agregar número de plataforma pero no ve acciones de ciudad', async () => {
    asUser(fx.superadminProfile);
    renderRouting();
    expect(
      await screen.findByRole('button', { name: 'Agregar número de plataforma' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar número' })).not.toBeInTheDocument();
    const companyTable = screen.queryByRole('table', { name: 'Números de la empresa' });
    expect(companyTable).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar' })).toBeInTheDocument();
  });

  test('una ciudad delegada se lee como Sí en la tabla', async () => {
    asUser(fx.adminProfile);
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/cities`, () => HttpResponse.json([delegatedRow()])),
    );
    renderRouting();
    const row = await cityRow(fx.secondCity.name);
    expect(row.getByText('Sí')).toBeInTheDocument();
  });
});

describe('rutas WhatsApp: cierre de cobertura', () => {
  test('sin empresa elegida, si falla la lista de la plataforma se muestra el error con reintento', async () => {
    asUser(fx.superadminProfile);
    let attempts = 0;
    server.use(
      http.get(`${BASE}/admin/whatsapp-routing/platform-numbers`, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ detail: 'caído' }, { status: 500 })
          : HttpResponse.json(fx.platformRoutingNumbers);
      }),
    );
    const { user } = renderRouting();
    await user.click(await screen.findByRole('button', { name: /reintentar/i }));
    expect(
      await screen.findByRole('button', { name: 'Agregar número de plataforma' }),
    ).toBeInTheDocument();
  });

  test('el superadmin quita un número de la empresa desde su tabla, con confirmación', async () => {
    asUser(fx.superadminProfile);
    const removed = vi.fn();
    server.use(
      http.delete(`${BASE}/admin/whatsapp-routing/numbers/:uuid`, ({ params }) => {
        removed(params.uuid);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderRouting(fx.tenant.tenant_id);

    const table = await screen.findByRole('table', { name: 'Números de la empresa' });
    await user.click(within(table).getByRole('button', { name: 'Quitar' }));
    const dialog = await screen.findByRole('dialog');
    expect(removed).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(removed).toHaveBeenCalledWith(fx.ownCityNumber.number_uuid));
    expect(await screen.findByText('Número quitado.')).toBeInTheDocument();
  });
});
