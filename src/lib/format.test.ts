import { describe, expect, test } from 'vitest';

import {
  EMPTY,
  daysAgoInLaPaz,
  formatDateTime,
  formatDuration,
  formatRelative,
  laPazDayEndIso,
  laPazDayStartIso,
  maskCi,
  maskPhone,
  todayInLaPaz,
} from '@/lib/format';

describe('fechas', () => {
  test('se muestran en America/La_Paz, no en la zona del navegador', () => {
    // 02:30 UTC on the 21st is still 22:30 on the 20th in La Paz (UTC-4).
    expect(formatDateTime('2026-07-21T02:30:00Z')).toBe('20/07/2026, 22:30');
  });

  test('valores nulos o inválidos no rompen la tabla', () => {
    expect(formatDateTime(null)).toBe(EMPTY);
    expect(formatDateTime('no es una fecha')).toBe(EMPTY);
  });

  test('una fecha vacía o inválida no produce un rango, en vez de reventar', () => {
    // Un input de fecha limpiado devuelve '': antes esto lanzaba desde el
    // render y tumbaba la vista entera.
    expect(laPazDayStartIso('')).toBeUndefined();
    expect(laPazDayEndIso('2026-13-45')).toBeUndefined();
  });

  test('las fechas locales se convierten al instante UTC correcto', () => {
    // La Paz es UTC-4 todo el año: la medianoche local son las 04:00 UTC.
    expect(laPazDayStartIso('2026-07-20')).toBe('2026-07-20T04:00:00.000Z');
    // Cota superior exclusiva: el inicio del día siguiente.
    expect(laPazDayEndIso('2026-07-20')).toBe('2026-07-21T04:00:00.000Z');
  });

  test('el "hoy" del historial es el de La Paz', () => {
    // 03:00 UTC is 23:00 the previous day locally — the boundary that would
    // otherwise show an operator an empty "today" late at night.
    expect(todayInLaPaz(new Date('2026-07-21T03:00:00Z'))).toBe('2026-07-20');
    expect(daysAgoInLaPaz(1, new Date('2026-07-21T03:00:00Z'))).toBe('2026-07-19');
  });
});

describe('duraciones', () => {
  test.each([
    [45, '45 s'],
    [60, '1 min'],
    [265, '4 min 25 s'],
    [3600, '1 h 0 min'],
    [null, EMPTY],
  ])('%s → %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe('tiempo relativo', () => {
  const now = new Date('2026-07-20T14:00:00Z');

  test.each([
    ['2026-07-20T13:59:30Z', 'hace segundos'],
    ['2026-07-20T13:50:00Z', 'hace 10 min'],
    ['2026-07-20T11:00:00Z', 'hace 3 h'],
    ['2026-07-18T14:00:00Z', 'hace 2 d'],
  ])('%s → %s', (input, expected) => {
    expect(formatRelative(input, now)).toBe(expected);
  });
});

describe('enmascarado', () => {
  test('el teléfono conserva prefijo y últimos dígitos', () => {
    expect(maskPhone('+59171234567')).toBe('+591····4567');
  });

  test('un número corto se deja como está en lugar de convertirse en ruido', () => {
    expect(maskPhone('7712')).toBe('7712');
  });

  test('el CI también se enmascara: viaja en cada consulta de conductores', () => {
    // El sufijo de departamento no debe consumir caracteres revelados.
    expect(maskCi('7654321 TJ')).toBe('····21TJ');
    expect(maskCi('1234567')).toBe('····4567');
  });
});
