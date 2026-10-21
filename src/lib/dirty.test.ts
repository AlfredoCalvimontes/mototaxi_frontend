import { describe, expect, test } from 'vitest';

import {
  driverChanges,
  vehicleChanges,
  type DriverFormValues,
  type VehicleFormValues,
} from '@/lib/dirty';

const driver: DriverFormValues = {
  name: 'Marco Peña',
  phone_whatsapp: '+59171234567',
  license_number: 'LIC-4421',
  usage_credit_enabled: false,
};

const vehicle: VehicleFormValues = {
  plate_number: 'ABC123',
  alias: '',
  brand: 'Honda',
  model: 'CG 125',
  device_id: '860123456789012',
  tracker_type: 'GT06',
  vehicle_type_uuid: '',
  attributes: {},
  sim_last_recharge_at: '',
  sim_last_recharge_amount: '',
  notes: '',
  last_maintenance_at: '2026-06-01',
};

describe('conductor: crédito de uso', () => {
  test('activarlo se envía', () => {
    expect(driverChanges(driver, { ...driver, usage_credit_enabled: true }).payload).toEqual({
      usage_credit_enabled: true,
    });
  });

  test('desactivarlo se envía como false, no como null', () => {
    const on = { ...driver, usage_credit_enabled: true };
    expect(driverChanges(on, { ...on, usage_credit_enabled: false }).payload).toEqual({
      usage_credit_enabled: false,
    });
  });

  test('sin tocarlo no viaja', () => {
    expect(driverChanges(driver, { ...driver, name: 'Otro' }).payload).toEqual({ name: 'Otro' });
  });
});

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
    expect(vehicleChanges(vehicle, vehicle).payload).toEqual({});
  });

  test('vaciar un campo opcional lo limpia explícitamente', () => {
    const { payload } = vehicleChanges(vehicle, { ...vehicle, brand: '' });
    expect(payload).toEqual({ brand: null });
  });

  test('un campo intacto nunca se emite como null', () => {
    const { payload } = vehicleChanges(vehicle, { ...vehicle, model: 'CG 150' });
    // Solo el modelo: emitir device_id: null aquí desconectaría el GPS.
    expect(payload).toEqual({ model: 'CG 150' });
    expect('device_id' in payload).toBe(false);
  });

  test('un campo ya vacío en ambos lados no se envía', () => {
    const { payload } = vehicleChanges(vehicle, { ...vehicle, notes: '   ' });
    expect(payload).toEqual({});
  });

  test('quitar el IMEI se marca como desconexión del GPS', () => {
    const { payload, detachesTracker } = vehicleChanges(vehicle, {
      ...vehicle,
      device_id: '',
    });
    expect(payload).toEqual({ device_id: null });
    expect(detachesTracker).toBe(true);
  });

  test('cambiar el IMEI por otro no es una desconexión', () => {
    const { payload, detachesTracker } = vehicleChanges(vehicle, {
      ...vehicle,
      device_id: '860999999999999',
    });
    expect(payload).toEqual({ device_id: '860999999999999' });
    expect(detachesTracker).toBe(false);
  });

  test('un vehículo que ya venía sin IMEI no cuenta como desconexión', () => {
    const sinImei = { ...vehicle, device_id: '' };
    const { detachesTracker } = vehicleChanges(sinImei, sinImei);
    expect(detachesTracker).toBe(false);
  });
});

describe('mototaxi: alias', () => {
  it('un alias nuevo se envía y vaciarlo lo limpia', () => {
    expect(vehicleChanges(vehicle, { ...vehicle, alias: ' Rayo ' }).payload).toEqual({
      alias: 'Rayo',
    });
    const named = { ...vehicle, alias: 'Rayo' };
    expect(vehicleChanges(named, { ...named, alias: '' }).payload).toEqual({ alias: null });
  });
});

describe('mototaxi: recarga de la SIM', () => {
  const recharged = {
    ...vehicle,
    sim_last_recharge_at: '2026-10-01',
    sim_last_recharge_amount: '10',
  };

  test('sin cambios no envía nada de la SIM', () => {
    expect(vehicleChanges(recharged, recharged).payload).toEqual({});
  });

  test('registrar la primera recarga envía la fecha y el crédito juntos', () => {
    expect(
      vehicleChanges(vehicle, {
        ...vehicle,
        sim_last_recharge_at: '2026-10-01',
        sim_last_recharge_amount: '10',
      }).payload,
    ).toEqual({ sim_last_recharge_at: '2026-10-01', sim_last_recharge_amount: 10 });
  });

  test('cambiar solo el crédito reenvía también la fecha', () => {
    expect(
      vehicleChanges(recharged, { ...recharged, sim_last_recharge_amount: '20' }).payload,
    ).toEqual({ sim_last_recharge_at: '2026-10-01', sim_last_recharge_amount: 20 });
  });

  test('acepta la coma decimal', () => {
    expect(
      vehicleChanges(vehicle, {
        ...vehicle,
        sim_last_recharge_at: '2026-10-01',
        sim_last_recharge_amount: '10,5',
      }).payload,
    ).toMatchObject({ sim_last_recharge_amount: 10.5 });
  });

  test('vaciar ambos los limpia explícitamente', () => {
    expect(
      vehicleChanges(recharged, {
        ...recharged,
        sim_last_recharge_at: '',
        sim_last_recharge_amount: '',
      }).payload,
    ).toEqual({ sim_last_recharge_at: null, sim_last_recharge_amount: null });
  });

  test('quitar el GPS no envía la SIM: el servidor la borra con el rastreador', () => {
    const { payload, detachesTracker } = vehicleChanges(recharged, {
      ...recharged,
      device_id: '',
    });
    expect(payload).toEqual({ device_id: null });
    expect(detachesTracker).toBe(true);
  });
});

describe('mototaxi: tipo y atributos', () => {
  const typed: VehicleFormValues = {
    ...vehicle,
    vehicle_type_uuid: 'type-a',
    attributes: { seats: 3 },
  };

  test('sin cambios no envía nada', () => {
    expect(vehicleChanges(typed, { ...typed, attributes: { seats: 3 } }).payload).toEqual({});
  });

  test('cambiar un atributo envía el objeto completo', () => {
    const { payload } = vehicleChanges(typed, {
      ...typed,
      attributes: { seats: 4, color: 'rojo' },
    });
    expect(payload).toEqual({ attributes: { seats: 4, color: 'rojo' } });
  });

  test('quitar el tipo lo limpia con null; los atributos nunca van como null', () => {
    const { payload } = vehicleChanges(typed, { ...typed, vehicle_type_uuid: '', attributes: {} });
    expect(payload).toEqual({ vehicle_type_uuid: null, attributes: {} });
  });

  test('el protocolo solo se envía si cambió', () => {
    expect(vehicleChanges(vehicle, { ...vehicle, tracker_type: 'SECUREMORE' }).payload).toEqual({
      tracker_type: 'SECUREMORE',
    });
    expect('tracker_type' in vehicleChanges(vehicle, vehicle).payload).toBe(false);
  });
});
