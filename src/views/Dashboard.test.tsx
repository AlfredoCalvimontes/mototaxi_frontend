import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, test } from 'vitest';

import * as fx from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';
import { AppRoutes } from '@/routes';
import Dashboard from '@/views/Dashboard';

const BASE = '/api/v1';

describe('resumen', () => {
  test('muestra los indicadores del día en unidades legibles', async () => {
    renderApp(<Dashboard />);

    expect(await screen.findByText('34')).toBeInTheDocument();
    // 265.4 s se muestra como duración, no como número crudo.
    expect(screen.getByText('4 min 25 s')).toBeInTheDocument();
    expect(screen.getByText('4.6 ★')).toBeInTheDocument();
  });

  test('un fallo de KPIs no impide ver las alertas', async () => {
    server.use(
      http.get(`${BASE}/admin/kpis`, () => HttpResponse.json({ detail: 'boom' }, { status: 500 })),
    );
    renderApp(<Dashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByText(/GPS sin actualizar/)).toBeInTheDocument();
  });

  test('sin alertas lo dice explícitamente en vez de mostrar una caja vacía', async () => {
    server.use(http.get(`${BASE}/admin/alerts`, () => HttpResponse.json(fx.noAlerts)));
    renderApp(<Dashboard />);

    expect(await screen.findByText('Sin alertas. Todo en orden.')).toBeInTheDocument();
  });
});

describe('alertas accionables', () => {
  test('cada alerta lleva a su vista ya filtrada', async () => {
    renderApp(<Dashboard />);

    expect(await screen.findByRole('link', { name: /GPS sin actualizar/ })).toHaveAttribute(
      'href',
      '/mototaxis?gps=sin-senal',
    );
    expect(screen.getByRole('link', { name: /cerrados automáticamente/ })).toHaveAttribute(
      'href',
      '/historial?cierre=automatico',
    );
    expect(screen.getByRole('link', { name: /sin check-in hoy/ })).toHaveAttribute(
      'href',
      '/conductores?checkin=pendiente',
    );
  });

  test('las acciones fallidas se informan sin enlace: no tienen pantalla', async () => {
    renderApp(<Dashboard />);

    const item = await screen.findByText(/acciones programadas fallidas/);
    expect(item.closest('a')).toBeNull();
  });

  test('solo aparecen las alertas con conteo mayor a cero', async () => {
    renderApp(<Dashboard />);

    await screen.findByText(/GPS sin actualizar/);
    // overdue_trips es 0 en el fixture.
    expect(screen.queryByText(/viajes demorados/)).not.toBeInTheDocument();
  });
});

describe('navegación', () => {
  test('el enlace de una alerta navega a la vista correspondiente', async () => {
    const { user } = renderApp(<AppRoutes />, { route: '/' });

    await user.click(await screen.findByRole('link', { name: /sin check-in hoy/ }));

    // El nombre también aparece en la navegación, así que se busca en el contenido.
    const main = screen.getByRole('main');
    expect(await within(main).findByText('Conductores')).toBeInTheDocument();
  });
});
