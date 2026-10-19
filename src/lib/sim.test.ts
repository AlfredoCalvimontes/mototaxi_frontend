import { describe, expect, test } from 'vitest';

import { simRechargeState } from '@/lib/sim';

const TODAY = '2026-10-17';

describe('simRechargeState', () => {
  test('sin recarga registrada no hay estado', () => {
    expect(simRechargeState(null, TODAY)).toEqual({ state: 'none', daysLeft: null });
  });

  test('con más de una semana de margen está en orden', () => {
    expect(simRechargeState('2026-10-25', TODAY)).toEqual({ state: 'ok', daysLeft: 8 });
  });

  test('a una semana exacta se pone amarillo', () => {
    expect(simRechargeState('2026-10-24', TODAY).state).toBe('soon');
  });

  test('entre 7 y 4 días sigue amarillo', () => {
    expect(simRechargeState('2026-10-21', TODAY)).toEqual({ state: 'soon', daysLeft: 4 });
  });

  test('a tres días exactos se pone rojo', () => {
    expect(simRechargeState('2026-10-20', TODAY)).toEqual({ state: 'urgent', daysLeft: 3 });
  });

  test('el mismo día de la recarga es rojo', () => {
    expect(simRechargeState(TODAY, TODAY)).toEqual({ state: 'urgent', daysLeft: 0 });
  });

  test('pasada la fecha sigue en rojo y lo dice', () => {
    expect(simRechargeState('2026-10-15', TODAY)).toEqual({ state: 'overdue', daysLeft: -2 });
  });

  test('cuenta días de calendario a través del cambio de mes y de año', () => {
    expect(simRechargeState('2027-01-02', '2026-12-30')).toEqual({ state: 'urgent', daysLeft: 3 });
    expect(simRechargeState('2026-03-01', '2026-02-22').state).toBe('soon');
  });
});
