import { screen } from '@testing-library/react';
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

  test('ofrece restaurar el valor original solo cuando fue cambiado', async () => {
    server.use(
      http.get(`${BASE}/admin/settings`, () =>
        HttpResponse.json([
          { ...fx.sharedLocationSetting, value: 90, updated_at: '2026-09-24T18:00:00Z' },
        ]),
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

    expect(
      screen.queryByRole('button', { name: /Restaurar valor original/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Nunca se ha cambiado/)).toBeInTheDocument();
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
