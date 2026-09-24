import { describe, expect, test } from 'vitest';

import { mototaxiSummary } from '@/test/fixtures';
import { trackingState } from '@/lib/tracking';

const trackerless = { ...mototaxiSummary, has_tracker: false, location_source: 'WHATSAPP' };

describe('trackingState', () => {
  test('sin mototaxi asignada no hay nada que rastrear', () => {
    expect(trackingState(undefined)).toBe('noMototaxi');
  });

  test('con GPS y señal reciente el rastreador está activo', () => {
    expect(trackingState(mototaxiSummary)).toBe('tracker');
  });

  test('con GPS pero sin señal se marca como perdido', () => {
    expect(trackingState({ ...mototaxiSummary, is_tracker_stale: true })).toBe('trackerStale');
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
});
