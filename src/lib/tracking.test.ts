import { describe, expect, test } from 'vitest';

import { vehicleSummary } from '@/test/fixtures';
import { trackingState } from '@/lib/tracking';

const trackerless = { ...vehicleSummary, has_tracker: false, location_source: 'WHATSAPP' };

describe('trackingState', () => {
  test('sin mototaxi asignada no hay nada que rastrear', () => {
    expect(trackingState(undefined)).toBe('noVehicle');
  });

  test('con GPS y señal reciente el rastreador está activo', () => {
    expect(trackingState(vehicleSummary)).toBe('tracker');
  });

  test('con GPS pero sin señal se marca como perdido', () => {
    expect(trackingState({ ...vehicleSummary, is_tracker_stale: true })).toBe('trackerStale');
  });

  test('sin GPS, una ubicación compartida reciente cuenta como seguimiento', () => {
    expect(trackingState(trackerless)).toBe('shared');
  });

  test('sin GPS y con la ubicación vencida el conductor debe volver a compartirla', () => {
    expect(trackingState({ ...trackerless, is_tracker_stale: true })).toBe('needsShare');
  });

  test('sin GPS y sin ninguna ubicación el conductor debe compartirla', () => {
    expect(trackingState({ ...trackerless, location_updated_at: null })).toBe('needsShare');
  });

  test('sin GPS, el celular del conductor reportando cuenta como seguimiento por celular', () => {
    expect(trackingState({ ...trackerless, location_source: 'PHONE' })).toBe('phone');
  });

  test('con GPS sin señal pero el celular cubriendo, se sigue por celular', () => {
    expect(trackingState({ ...vehicleSummary, location_source: 'PHONE' })).toBe('phone');
  });

  test('con GPS sin señal y solo una ubicación compartida vigente, cuenta como compartida', () => {
    expect(trackingState({ ...vehicleSummary, location_source: 'WHATSAPP' })).toBe('shared');
  });

  test('con GPS, sin señal y sin nada que lo cubra, está perdido', () => {
    expect(
      trackingState({ ...vehicleSummary, is_tracker_stale: true, location_source: 'TRACKER' }),
    ).toBe('trackerStale');
  });
});
