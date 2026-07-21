import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import type { MototaxiSummary } from '@/api/types';
import { FleetMap } from '@/components/FleetMap';
import * as fx from '@/test/fixtures';

/**
 * Leaflet does mount under jsdom — it builds its panes and marker elements
 * without needing real layout. Only tile images fail to load, which jsdom
 * ignores anyway. So the map is tested for real rather than mocked.
 */

/** Markers are div icons, so they are found by their generated element. */
function markers(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.leaflet-marker-icon'));
}

function colorOf(marker: Element) {
  return marker.querySelector('span')?.getAttribute('style') ?? '';
}

const FRESH = '#059669';
const STALE = '#d97706';

describe('unidades sin posición', () => {
  test('sin ninguna posición no dibuja el mapa y lo explica', () => {
    const { container } = render(
      <FleetMap units={[{ ...fx.mototaxiSummary, lat: null, lon: null }]} />,
    );

    expect(screen.getByText(/Ninguna unidad tiene posición/)).toBeInTheDocument();
    expect(container.querySelector('.leaflet-container')).toBeNull();
  });

  test('una lista vacía tampoco dibuja el mapa', () => {
    render(<FleetMap units={[]} />);
    expect(screen.getByText(/Ninguna unidad tiene posición/)).toBeInTheDocument();
  });

  test('las unidades sin posición se omiten, no se dibujan en 0,0', () => {
    const sinPosicion: MototaxiSummary = {
      ...fx.staleMototaxiSummary,
      lat: null,
      lon: null,
    };
    const { container } = render(<FleetMap units={[fx.mototaxiSummary, sinPosicion]} />);

    // Golfo de Guinea: una unidad dibujada en 0,0 es un bug clásico de mapas.
    expect(markers(container)).toHaveLength(1);
  });
});

describe('marcadores', () => {
  test('dibuja un marcador por unidad localizada', () => {
    const { container } = render(
      <FleetMap units={[fx.mototaxiSummary, fx.staleMototaxiSummary]} />,
    );
    expect(markers(container)).toHaveLength(2);
  });

  test('el GPS sin señal se distingue por color del que reporta', () => {
    const { container } = render(
      <FleetMap units={[fx.mototaxiSummary, fx.staleMototaxiSummary]} />,
    );
    const [fresh, stale] = markers(container);

    expect(colorOf(fresh!)).toContain(FRESH);
    expect(colorOf(stale!)).toContain(STALE);
  });

  test('los iconos no dependen de imágenes externas', () => {
    // Los iconos por defecto de Leaflet apuntan a un CDN que no existe en el
    // bundle: con ellos los marcadores desaparecen en silencio.
    const { container } = render(<FleetMap units={[fx.mototaxiSummary]} />);

    expect(container.querySelector('.leaflet-marker-icon img')).toBeNull();
    expect(colorOf(markers(container)[0]!)).toContain('border-radius');
  });
});

describe('detalle de la unidad', () => {
  test('al abrir el marcador muestra placa y antigüedad de la señal', async () => {
    const user = userEvent.setup();
    const { container } = render(<FleetMap units={[fx.mototaxiSummary]} />);

    await user.click(markers(container)[0]!);

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText(/Última señal/)).toBeInTheDocument();
  });

  test('una unidad sin señal lo dice también en su detalle', async () => {
    const user = userEvent.setup();
    const { container } = render(<FleetMap units={[fx.staleMototaxiSummary]} />);

    await user.click(markers(container)[0]!);

    expect(await screen.findByText('XYZ789')).toBeInTheDocument();
    expect(screen.getByText('GPS sin señal')).toBeInTheDocument();
  });

  test('una unidad que reporta no muestra la advertencia', async () => {
    const user = userEvent.setup();
    const { container } = render(<FleetMap units={[fx.mototaxiSummary]} />);

    await user.click(markers(container)[0]!);

    await screen.findByText('ABC123');
    expect(screen.queryByText('GPS sin señal')).not.toBeInTheDocument();
  });
});
