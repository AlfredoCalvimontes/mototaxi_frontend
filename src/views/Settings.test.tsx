import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import Settings from '@/views/Settings';

const BASE = '/api/v1';
const LABEL = 'Vigencia de la ubicación compartida';

describe('configuración', () => {
  test('muestra el valor actual, la unidad y el rango permitido', async () => {
    renderApp(<Settings />);

    const input = await screen.findByLabelText(LABEL);
    expect(input).toHaveValue('30');
    expect(screen.getByText('minutos')).toBeInTheDocument();
    expect(screen.getByText(/Permitido: de 5 a 480 minutos/)).toBeInTheDocument();
  });

  test('el signo de información explica el ajuste en español', async () => {
    const { user } = renderApp(<Settings />);
    await screen.findByLabelText(LABEL);

    await user.click(screen.getByRole('button', { name: 'Más información' }));

    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent(/ubicación que el conductor comparte por WhatsApp/);
    expect(tip).toHaveTextContent(/No afecta a las motos con GPS/);
  });

  test('el tooltip se cierra con Escape', async () => {
    const { user } = renderApp(<Settings />);
    await screen.findByLabelText(LABEL);
    await user.click(screen.getByRole('button', { name: 'Más información' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('guarda un valor nuevo y lo confirma', async () => {
    const { user } = renderApp(<Settings />);
    const input = await screen.findByLabelText(LABEL);

    await user.clear(input);
    await user.type(input, '60');
    await user.click(screen.getByRole('button', { name: 'Guardar cambio' }));

    expect(await screen.findByText('Cambio guardado.')).toBeInTheDocument();
    expect(screen.getByLabelText(LABEL)).toHaveValue('60');
  });

  test('no deja guardar sin cambios', async () => {
    renderApp(<Settings />);
    await screen.findByLabelText(LABEL);

    expect(screen.getByRole('button', { name: 'Guardar cambio' })).toBeDisabled();
  });

  test.each(['2', '500', 'abc', '', '30.5'])(
    'un valor inválido (%s) bloquea el botón y explica el rango',
    async (typed) => {
      const { user } = renderApp(<Settings />);
      const input = await screen.findByLabelText(LABEL);

      await user.clear(input);
      if (typed) await user.type(input, typed);

      expect(screen.getByRole('button', { name: 'Guardar cambio' })).toBeDisabled();
      expect(screen.getByText(/Escribe un número entero entre 5 y 480/)).toBeInTheDocument();
    },
  );

  test('con un ajuste propio de la empresa ofrece quitarlo con DELETE', async () => {
    const overridden = { ...fx.sharedLocationSetting, value: 90, source: 'tenant' as const };
    const deleted: string[] = [];
    server.use(
      http.get(`${BASE}/admin/settings`, () => HttpResponse.json([overridden])),
      http.delete(`${BASE}/admin/settings/:key`, ({ params }) => {
        deleted.push(String(params.key));
        return HttpResponse.json({ ...fx.sharedLocationSetting, source: 'global' });
      }),
    );
    const { user } = renderApp(<Settings />);

    expect(await screen.findByText('Ajuste de la empresa')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar el ajuste de la empresa' }));

    await waitFor(() => expect(deleted).toEqual([fx.sharedLocationSetting.key]));
  });

  test('un valor heredado del global no ofrece quitar nada', async () => {
    server.use(
      http.get(`${BASE}/admin/settings`, () =>
        HttpResponse.json([{ ...fx.sharedLocationSetting, value: 90, source: 'global' }]),
      ),
    );
    renderApp(<Settings />);

    expect(await screen.findByText('Heredado del valor global')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar el ajuste/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Restaurar valor original/ }),
    ).not.toBeInTheDocument();
  });

  test('un superadmin sin empresa restaura el valor global', async () => {
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(fx.superadminProfile)),
      http.get(`${BASE}/admin/settings`, () =>
        HttpResponse.json([{ ...fx.sharedLocationSetting, value: 90, source: 'global' }]),
      ),
    );
    renderApp(<Settings />);

    expect(
      await screen.findByRole('button', { name: 'Restaurar valor original (30 minutos)' }),
    ).toBeInTheDocument();
  });

  test('no ofrece restaurar cuando ya está el valor original', async () => {
    renderApp(<Settings />);
    await screen.findByLabelText(LABEL);

    expect(screen.queryByRole('button', { name: /Quitar el ajuste/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Nunca se ha cambiado/)).toBeInTheDocument();
    expect(screen.getByText('Valor original del sistema')).toBeInTheDocument();
  });

  test('muestra el error del servidor si el cambio es rechazado', async () => {
    server.use(
      http.put(`${BASE}/admin/settings/:key`, () =>
        HttpResponse.json({ detail: 'valor fuera de rango' }, { status: 422 }),
      ),
    );
    const { user } = renderApp(<Settings />);
    const input = await screen.findByLabelText(LABEL);

    await user.clear(input);
    await user.type(input, '60');
    await user.click(screen.getByRole('button', { name: 'Guardar cambio' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('valor fuera de rango');
  });
});

describe('duración de la SIM por cada 10 de crédito', () => {
  const SIM_LABEL = 'Duración de la SIM por cada 10 de crédito';

  function withBoth() {
    server.use(
      http.get(`${BASE}/admin/settings`, () =>
        HttpResponse.json([fx.sharedLocationSetting, fx.simDaysSetting]),
      ),
    );
  }

  test('aparece con su unidad en días y su rango', async () => {
    withBoth();
    renderApp(<Settings />);

    const input = await screen.findByLabelText(SIM_LABEL);
    expect(input).toHaveValue('30');
    expect(screen.getByText('días')).toBeInTheDocument();
    expect(screen.getByText(/Permitido: de 5 a 365 días/)).toBeInTheDocument();
  });

  test('el signo de información explica que recalcula las fechas', async () => {
    withBoth();
    const { user } = renderApp(<Settings />);
    await screen.findByLabelText(SIM_LABEL);

    const buttons = screen.getAllByRole('button', { name: 'Más información' });
    await user.click(buttons[1]!);

    expect(screen.getByRole('tooltip')).toHaveTextContent(/recalcula todas las fechas/);
  });

  test('guardar un valor nuevo manda la clave correcta', async () => {
    withBoth();
    const calls: { key: string; body: unknown }[] = [];
    server.use(
      http.put(`${BASE}/admin/settings/:key`, async ({ params, request }) => {
        calls.push({ key: String(params.key), body: await request.json() });
        return HttpResponse.json({ ...fx.simDaysSetting, value: 20 });
      }),
    );
    const { user } = renderApp(<Settings />);
    const input = await screen.findByLabelText(SIM_LABEL);

    await user.clear(input);
    await user.type(input, '20');
    await user.click(screen.getAllByRole('button', { name: 'Guardar cambio' })[1]!);

    expect(await screen.findByText('Cambio guardado.')).toBeInTheDocument();
    expect(calls).toEqual([{ key: 'sim_days_per_ten_credit', body: { value: 20 } }]);
  });

  test('no acepta valores fuera del rango', async () => {
    withBoth();
    const { user } = renderApp(<Settings />);
    const input = await screen.findByLabelText(SIM_LABEL);

    await user.clear(input);
    await user.type(input, '1');

    expect(screen.getAllByRole('button', { name: 'Guardar cambio' })[1]).toBeDisabled();
    expect(screen.getByText(/Escribe un número entero entre 5 y 365/)).toBeInTheDocument();
  });
});
