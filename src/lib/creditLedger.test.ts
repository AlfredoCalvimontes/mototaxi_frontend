import { describe, expect, test } from 'vitest';

import type { CreditTransaction } from '@/api/types';
import {
  creditFilterParams,
  describeCreditRow,
  EMPTY_CREDIT_FILTERS,
  formatSignedCredit,
  laPazDayLastInstantIso,
} from '@/lib/creditLedger';

function row(overrides: Partial<CreditTransaction>): CreditTransaction {
  return {
    transaction_uuid: 'r',
    driver_uuid: 'd',
    kind: 'TOPUP',
    amount: 0,
    balance_after: 0,
    requested_amount: null,
    usage_plan_uuid: null,
    usage_plan_name: null,
    rate_applied: null,
    period_from: null,
    period_to: null,
    note: null,
    detail: null,
    actor_user_uuid: null,
    created_at: '2026-10-20T14:00:00Z',
    ...overrides,
  };
}

describe('signos de los movimientos', () => {
  test('un abono lleva +, un descuento lleva −', () => {
    expect(formatSignedCredit(120)).toBe('+120');
    expect(formatSignedCredit(-60)).toBe('−60');
    expect(formatSignedCredit(0)).toBe('0');
  });
});

describe('descripción de cada movimiento', () => {
  test('una recarga muestra su motivo', () => {
    expect(describeCreditRow(row({ kind: 'TOPUP', note: 'Recibo 7' }))).toBe('Recibo 7');
  });

  test('si se pidió más de lo que había, lo dice', () => {
    const text = describeCreditRow(
      row({ kind: 'MANUAL_DEDUCTION', amount: -20, requested_amount: -50, note: 'Multa' }),
    );

    expect(text).toContain('Multa');
    expect(text).toContain('Se pidió 50');
  });

  test('un cambio de tarifa muestra la tarifa anterior y la nueva', () => {
    const text = describeCreditRow(
      row({ kind: 'REPRICE', detail: { from_rate: '60.00', to_rate: '120.00' } }),
    );

    expect(text).toBe('Tarifa de 60 a 120 por día');
  });

  test('un consumo muestra la tarifa con que se consumió', () => {
    expect(describeCreditRow(row({ kind: 'DRAIN', amount: -60, rate_applied: 60 }))).toBe(
      'Consumo a 60 por día',
    );
  });
});

describe('filtros hacia la API', () => {
  test('sin filtros solo van la página y su tamaño', () => {
    expect(creditFilterParams(EMPTY_CREDIT_FILTERS)).toEqual({ page: 1, page_size: 20 });
  });

  test('el tipo y las fechas se traducen a instantes', () => {
    const params = creditFilterParams({
      kind: 'TOPUP',
      from: '2026-10-20',
      to: '2026-10-20',
      page: 3,
    });

    expect(params).toEqual({
      kind: 'TOPUP',
      created_from: '2026-10-20T04:00:00.000Z',
      created_to: '2026-10-21T03:59:59.999Z',
      page: 3,
      page_size: 20,
    });
  });

  test('el último instante de un día es un milisegundo antes del siguiente', () => {
    expect(laPazDayLastInstantIso('2026-10-21T04:00:00.000Z')).toBe('2026-10-21T03:59:59.999Z');
    expect(laPazDayLastInstantIso(undefined)).toBeUndefined();
  });
});
