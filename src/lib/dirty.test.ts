import { describe, expect, test } from 'vitest';

import {
  driverChanges,
  mototaxiChanges,
  type DriverFormValues,
  type MototaxiFormValues,
} from '@/lib/dirty';

const driver: DriverFormValues = {
  name: 'Marco Peña',
  phone_whatsapp: '+59171234567',
  license_number: 'LIC-4421',
};

const mototaxi: MototaxiFormValues = {
  plate_number: 'ABC123',
  alias: '',
  brand: 'Honda',
  model: 'CG 125',
  tracker_imei: '860123456789012',
  sim_last_recharge_at: '',
  sim_last_recharge_amount: '',
  notes: '',
  last_maintenance_at: '2026-06-01',
};

describe('conductor: null se ignora, nada se puede limpiar', () => {
  test('sin cambios no envía nada', () => {
    expect(driverChanges(driver, driver).payload).toEqual({});
  });

  test('envía solo los campos tocados', () => {
    const { payload } = driverChanges(driver, { ...driver, name: 'Marco A. Peña' });
    expect(payload).toEqual({ name: 'Marco A. Peña' });
  });

  test('nunca emite null: esta ruta lo ignoraría en silencio', () => {
    const { payload } = driverChanges(driver, { ...driver, license_number: '' });
    expect(payload).toEqual({});
    expect(Object.values(payload)).not.toContain(null);
  });

  test('informa qué campos no se pueden limpiar por esta ruta', () => {
    const { unclearable } = driverChanges(driver, { ...driver, license_number: '  ' });
    // El formulario debe decirlo: enviarlo se aceptaría y no haría nada.
    expect(unclearable).toEqual(['license_number']);
  });

  test('los espacios sobrantes no cuentan como cambio', () => {
    const { payload } = driverChanges(driver, { ...driver, name: '  Marco Peña  ' });
    expect(payload).toEqual({});
  });
});

describe('mototaxi: null limpia el campo', () => {
  test('sin cambios no envía nada', () => {
    expect(mototaxiChanges(mototaxi, mototaxi).payload).toEqual({});
  });

  test('vaciar un campo opcional lo limpia explícitamente', () => {
    const { payload } = mototaxiChanges(mototaxi, { ...mototaxi, brand: '' });
    expect(payload).toEqual({ brand: null });
  });

  test('un campo intacto nunca se emite como null', () => {
    const { payload } = mototaxiChanges(mototaxi, { ...mototaxi, model: 'CG 150' });
    // Solo el modelo: emitir tracker_imei: null aquí desconectaría el GPS.
    expect(payload).toEqual({ model: 'CG 150' });
    expect('tracker_imei' in payload).toBe(false);
  });

  test('un campo ya vacío en ambos lados no se envía', () => {
    const { payload } = mototaxiChanges(mototaxi, { ...mototaxi, notes: '   ' });
    expect(payload).toEqual({});
  });

  test('quitar el IMEI se marca como desconexión del GPS', () => {
    const { payload, detachesTracker } = mototaxiChanges(mototaxi, {
      ...mototaxi,
      tracker_imei: '',
    });
    expect(payload).toEqual({ tracker_imei: null });
    expect(detachesTracker).toBe(true);
  });

  test('cambiar el IMEI por otro no es una desconexión', () => {
    const { payload, detachesTracker } = mototaxiChanges(mototaxi, {
      ...mototaxi,
      tracker_imei: '860999999999999',
    });
    expect(payload).toEqual({ tracker_imei: '860999999999999' });
    expect(detachesTracker).toBe(false);
  });

  test('un vehículo que ya venía sin IMEI no cuenta como desconexión', () => {
    const sinImei = { ...mototaxi, tracker_imei: '' };
    const { detachesTracker } = mototaxiChanges(sinImei, sinImei);
    expect(detachesTracker).toBe(false);
  });
});

describe('mototaxi: alias', () => {
  it('un alias nuevo se envía y vaciarlo lo limpia', () => {
    expect(mototaxiChanges(mototaxi, { ...mototaxi, alias: ' Rayo ' }).payload).toEqual({
      alias: 'Rayo',
    });
    const named = { ...mototaxi, alias: 'Rayo' };
    expect(mototaxiChanges(named, { ...named, alias: '' }).payload).toEqual({ alias: null });
  });
});

describe('mototaxi: recarga de la SIM', () => {
  const recharged = {
    ...mototaxi,
    sim_last_recharge_at: '2026-10-01',
    sim_last_recharge_amount: '10',
  };

  test('sin cambios no envía nada de la SIM', () => {
    expect(mototaxiChanges(recharged, recharged).payload).toEqual({});
  });

  test('registrar la primera recarga envía la fecha y el crédito juntos', () => {
    expect(
      mototaxiChanges(mototaxi, {
        ...mototaxi,
        sim_last_recharge_at: '2026-10-01',
        sim_last_recharge_amount: '10',
      }).payload,
    ).toEqual({ sim_last_recharge_at: '2026-10-01', sim_last_recharge_amount: 10 });
  });

  test('cambiar solo el crédito reenvía también la fecha', () => {
    expect(
      mototaxiChanges(recharged, { ...recharged, sim_last_recharge_amount: '20' }).payload,
    ).toEqual({ sim_last_recharge_at: '2026-10-01', sim_last_recharge_amount: 20 });
  });

  test('acepta la coma decimal', () => {
    expect(
      mototaxiChanges(mototaxi, {
        ...mototaxi,
        sim_last_recharge_at: '2026-10-01',
        sim_last_recharge_amount: '10,5',
      }).payload,
    ).toMatchObject({ sim_last_recharge_amount: 10.5 });
  });

  test('vaciar ambos los limpia explícitamente', () => {
    expect(
      mototaxiChanges(recharged, {
        ...recharged,
        sim_last_recharge_at: '',
        sim_last_recharge_amount: '',
      }).payload,
    ).toEqual({ sim_last_recharge_at: null, sim_last_recharge_amount: null });
  });

  test('quitar el GPS no envía la SIM: el servidor la borra con el rastreador', () => {
    const { payload, detachesTracker } = mototaxiChanges(recharged, {
      ...recharged,
      tracker_imei: '',
    });
    expect(payload).toEqual({ tracker_imei: null });
    expect(detachesTracker).toBe(true);
  });
});
