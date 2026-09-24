import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { renderApp } from '@/test/render';
import Drivers from '@/views/Drivers';

async function table() {
  return within(await screen.findByRole('table'));
}

describe('listado de conductores', () => {
  test('muestra métricas derivadas en unidades legibles', async () => {
    renderApp(<Drivers />);
    const rows = await (await table()).findAllByRole('row');
    const marco = rows.find((row) => within(row).queryByText('Marco Peña'))!;

    // acceptance_rate 0.91 → porcentaje; 18.5 s de respuesta → segundos redondeados.
    expect(within(marco).getByText('91 %')).toBeInTheDocument();
    expect(within(marco).getByText('19 s')).toBeInTheDocument();
  });

  test('resuelve la placa asignada a partir del uuid del vehículo', async () => {
    renderApp(<Drivers />);
    const rows = await (await table()).findAllByRole('row');
    const marco = rows.find((row) => within(row).queryByText('Marco Peña'))!;

    expect(within(marco).getByText('ABC123')).toBeInTheDocument();
  });

  test('señala a quien no hizo check-in: ese día no recibe ofertas', async () => {
    renderApp(<Drivers />);
    const rows = await (await table()).findAllByRole('row');
    const lucia = rows.find((row) => within(row).queryByText('Lucía Vargas'))!;
    const marco = rows.find((row) => within(row).queryByText('Marco Peña'))!;

    expect(within(lucia).getByText('Sin check-in hoy')).toBeInTheDocument();
    expect(within(marco).queryByText('Sin check-in hoy')).not.toBeInTheDocument();
  });
});

describe('seguimiento', () => {
  test('un conductor con GPS y señal reciente aparece con seguimiento activo', async () => {
    renderApp(<Drivers />);
    const rows = await (await table()).findAllByRole('row');
    const marco = rows.find((row) => within(row).queryByText('Marco Peña'))!;

    expect(within(marco).getByText('GPS activo')).toBeInTheDocument();
  });

  test('sin mototaxi asignada se dice que no hay nada que rastrear', async () => {
    renderApp(<Drivers />);
    const rows = await (await table()).findAllByRole('row');
    const lucia = rows.find((row) => within(row).queryByText('Lucía Vargas'))!;

    expect(within(lucia).getByText('Sin mototaxi')).toBeInTheDocument();
  });
});

describe('privacidad', () => {
  test('teléfono y CI llegan enmascarados', async () => {
    renderApp(<Drivers />);
    const rows = await (await table()).findAllByRole('row');
    const marco = rows.find((row) => within(row).queryByText('Marco Peña'))!;

    expect(within(marco).getByText('+591····4567')).toBeInTheDocument();
    expect(within(marco).getByText('····21TJ')).toBeInTheDocument();
    expect(within(marco).queryByText('+59171234567')).not.toBeInTheDocument();
  });

  test('el valor completo se revela fila por fila, de forma deliberada', async () => {
    const { user } = renderApp(<Drivers />);
    const rows = await (await table()).findAllByRole('row');
    const marco = within(rows.find((row) => within(row).queryByText('Marco Peña'))!);

    await user.click(marco.getByRole('button', { name: /Mostrar: \+591····4567/ }));

    expect(marco.getByText('+59171234567')).toBeInTheDocument();
    // Revelar un teléfono no revela el CI de la misma fila.
    expect(marco.getByText('····21TJ')).toBeInTheDocument();
  });
});

describe('filtro de check-in', () => {
  test('la URL del enlace del resumen deja el filtro ya aplicado', async () => {
    renderApp(<Drivers />, { route: '/conductores?checkin=pendiente' });

    const rows = await (await table()).findAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[1]!).getByText('Lucía Vargas')).toBeInTheDocument();
  });

  test('la búsqueda encuentra por el número completo aunque se muestre enmascarado', async () => {
    const { user } = renderApp(<Drivers />);
    await screen.findByRole('table');

    await user.type(screen.getByRole('searchbox'), '76543210');

    const rows = await (await table()).findAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[1]!).getByText('Lucía Vargas')).toBeInTheDocument();
  });
});
