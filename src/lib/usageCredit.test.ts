import { describe, expect, test } from 'vitest';

import { strings } from '@/lib/strings';
import { formatCredit, usageCreditState } from '@/lib/usageCredit';

const NOW = new Date('2026-10-17T14:00:00Z');

const off = {
  usage_credit_enabled: false,
  usage_credit_expired: false,
  usage_credit_expires_at: null,
};
const on = (expiresAt: string, expired = false) => ({
  usage_credit_enabled: true,
  usage_credit_expired: expired,
  usage_credit_expires_at: expiresAt,
});

describe('usageCreditState', () => {
  test('fuera del esquema no hay estado', () => {
    expect(usageCreditState(off, NOW)).toEqual({ state: 'off', hoursLeft: null });
  });

  test('con margen está en orden', () => {
    expect(usageCreditState(on('2026-10-25T14:00:00Z'), NOW)).toEqual({
      state: 'ok',
      hoursLeft: 192,
    });
  });

  test('a tres días o menos se pone amarillo', () => {
    expect(usageCreditState(on('2026-10-20T14:00:00Z'), NOW)).toEqual({
      state: 'soon',
      hoursLeft: 72,
    });
    expect(usageCreditState(on('2026-10-18T02:00:00Z'), NOW)).toEqual({
      state: 'soon',
      hoursLeft: 12,
    });
  });

  test('un minuto más de tres días sigue en orden', () => {
    expect(usageCreditState(on('2026-10-20T14:01:00Z'), NOW).state).toBe('ok');
  });

  test('las horas se redondean hacia arriba', () => {
    expect(usageCreditState(on('2026-10-17T14:10:00Z'), NOW).hoursLeft).toBe(1);
  });

  test('lo vencido lo decide el servidor, no el reloj del navegador', () => {
    // La hora ya pasó, pero el servidor dice que no: manda el servidor.
    expect(usageCreditState(on('2026-10-01T14:00:00Z', false), NOW).state).toBe('soon');
    expect(usageCreditState(on('2026-10-01T14:00:00Z', true), NOW)).toEqual({
      state: 'expired',
      hoursLeft: -384,
    });
  });
});

describe('formatCredit', () => {
  test.each([
    [180, '180'],
    [0, '0'],
    [12.5, '12,5'],
  ])('%s → %s', (value, text) => {
    expect(formatCredit(value)).toBe(text);
  });

  test('sin valor no muestra nada', () => {
    expect(formatCredit(null)).toBe('');
  });
});

describe('creditSoonBadge', () => {
  test.each([
    [0, 'Vence en menos de 1 h'],
    [1, 'Vence en menos de 1 h'],
    [5, 'Vence en 5 h'],
    [24, 'Vence en 24 h'],
    [25, 'Vence en 2 días'],
    [72, 'Vence en 3 días'],
  ])('%s h → %s', (hours, text) => {
    expect(strings.drivers.creditSoonBadge(hours)).toBe(text);
  });
});
