import { describe, expect, test } from 'vitest';

import { formatCredit, usageCreditState } from '@/lib/usageCredit';

const TODAY = '2026-10-17';

const off = {
  usage_credit_enabled: false,
  usage_credit_expired: false,
  usage_credit_expires_on: null,
};
const on = (expiresOn: string, expired = false) => ({
  usage_credit_enabled: true,
  usage_credit_expired: expired,
  usage_credit_expires_on: expiresOn,
});

describe('usageCreditState', () => {
  test('fuera del esquema no hay estado', () => {
    expect(usageCreditState(off, TODAY)).toEqual({ state: 'off', daysLeft: null });
  });

  test('con margen está en orden', () => {
    expect(usageCreditState(on('2026-10-25'), TODAY)).toEqual({ state: 'ok', daysLeft: 8 });
  });

  test('a tres días o menos se pone amarillo', () => {
    expect(usageCreditState(on('2026-10-20'), TODAY)).toEqual({ state: 'soon', daysLeft: 3 });
    expect(usageCreditState(on('2026-10-18'), TODAY)).toEqual({ state: 'soon', daysLeft: 1 });
  });

  test('a cuatro días sigue en orden', () => {
    expect(usageCreditState(on('2026-10-21'), TODAY).state).toBe('ok');
  });

  test('lo vencido lo decide el servidor, no el reloj del navegador', () => {
    // La fecha ya pasó, pero el servidor dice que no: manda el servidor.
    expect(usageCreditState(on('2026-10-01', false), TODAY).state).toBe('soon');
    expect(usageCreditState(on('2026-10-01', true), TODAY)).toEqual({
      state: 'expired',
      daysLeft: -16,
    });
  });
});

describe('formatCredit', () => {
  test.each([
    [180, '180'],
    [-20, '-20'],
    [12.5, '12,5'],
    [0, '0'],
  ])('%s → %s', (value, text) => {
    expect(formatCredit(value)).toBe(text);
  });

  test('sin valor no muestra nada', () => {
    expect(formatCredit(null)).toBe('');
  });
});
