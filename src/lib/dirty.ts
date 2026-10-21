/**
 * Dirty-field serialisation for the two PATCH routes.
 *
 * These are deliberately **two functions with no shared helper**. The routes
 * disagree about what `null` means, and one helper emitting `null` for an
 * untouched field is harmless on a driver and destructive on a vehicle:
 *
 * - `PATCH /admin/drivers/{uuid}` — `null` is silently ignored. Nothing on a
 *   driver can be cleared through it.
 * - `PATCH /admin/vehicles/{uuid}` — `null` **clears** the field.
 *   `{tracker_imei: null}` detaches the tracker and drops that IMEI from the
 *   GT06 allowlist (spec §7.2).
 *
 * Both routes forward only the keys present in the body (`model_fields_set`),
 * so both functions emit dirty fields only — never a whole object.
 */

import type { UpdateDriverPayload, UpdateVehiclePayload } from '@/api/types';

/** Trims and turns an empty input into `null`, which each caller then judges. */
function normalise(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export type DriverFormValues = {
  name: string;
  phone_whatsapp: string;
  license_number: string;
  usage_credit_enabled: boolean;
};

/** The text fields only: the credit switch is a boolean and can always be turned off. */
type DriverTextField = Exclude<keyof DriverFormValues, 'usage_credit_enabled'>;

export type DriverChanges = {
  payload: UpdateDriverPayload;
  /**
   * Fields the operator blanked that this route cannot clear. The form has to
   * say so: sending them would be accepted and silently do nothing, leaving
   * the operator believing a value was removed.
   */
  unclearable: DriverTextField[];
};

export function driverChanges(initial: DriverFormValues, current: DriverFormValues): DriverChanges {
  const payload: UpdateDriverPayload = {};
  const unclearable: DriverTextField[] = [];

  const name = normalise(current.name);
  if (name !== null && name !== initial.name) payload.name = name;
  else if (name === null && initial.name !== '') unclearable.push('name');

  const phone = normalise(current.phone_whatsapp);
  if (phone !== null && phone !== initial.phone_whatsapp) payload.phone_whatsapp = phone;
  else if (phone === null && initial.phone_whatsapp !== '') unclearable.push('phone_whatsapp');

  const license = normalise(current.license_number);
  if (license !== null && license !== initial.license_number) payload.license_number = license;
  else if (license === null && initial.license_number !== '') unclearable.push('license_number');

  if (current.usage_credit_enabled !== initial.usage_credit_enabled) {
    payload.usage_credit_enabled = current.usage_credit_enabled;
  }

  return { payload, unclearable };
}

export type VehicleFormValues = {
  plate_number: string;
  alias: string;
  brand: string;
  model: string;
  tracker_imei: string;
  sim_last_recharge_at: string;
  sim_last_recharge_amount: string;
  notes: string;
  last_maintenance_at: string;
};

export type VehicleChanges = {
  payload: UpdateVehiclePayload;
  /**
   * True when the payload detaches the tracker. The IMEI is not a field to tab
   * through: dropping it removes the vehicle from the GT06 allowlist, so the
   * form confirms it separately (plan §7.4).
   */
  detachesTracker: boolean;
};

/** «10,5» and «10.5» both mean ten and a half; anything unreadable is `NaN`. */
export function parseCredit(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  return trimmed === '' ? null : Number(trimmed);
}

/** The two halves of a SIM recharge travel together, so a change to either sends both. */
function simRechargeChange(
  initial: VehicleFormValues,
  current: VehicleFormValues,
): Pick<UpdateVehiclePayload, 'sim_last_recharge_at' | 'sim_last_recharge_amount'> {
  const at = normalise(current.sim_last_recharge_at);
  const amount = parseCredit(current.sim_last_recharge_amount);
  const unchanged =
    at === (normalise(initial.sim_last_recharge_at) ?? null) &&
    amount === parseCredit(initial.sim_last_recharge_amount);
  return unchanged ? {} : { sim_last_recharge_at: at, sim_last_recharge_amount: amount };
}

export function vehicleChanges(
  initial: VehicleFormValues,
  current: VehicleFormValues,
): VehicleChanges {
  const payload: UpdateVehiclePayload = {};

  // The plate is required by the schema, so blanking it is not a clear —
  // the form rejects it before we get here and it is simply not sent.
  const plate = normalise(current.plate_number);
  if (plate !== null && plate !== initial.plate_number) payload.plate_number = plate;

  // Everything below is nullable: an emptied input is an explicit clear.
  const alias = normalise(current.alias);
  if (alias !== (normalise(initial.alias) ?? null)) payload.alias = alias;

  const brand = normalise(current.brand);
  if (brand !== (normalise(initial.brand) ?? null)) payload.brand = brand;

  const model = normalise(current.model);
  if (model !== (normalise(initial.model) ?? null)) payload.model = model;

  const imei = normalise(current.tracker_imei);
  if (imei !== (normalise(initial.tracker_imei) ?? null)) payload.tracker_imei = imei;

  // The SIM belongs to the tracker: without one there is nothing to send (the
  // server drops the record itself when a tracker is detached).
  if (imei !== null) Object.assign(payload, simRechargeChange(initial, current));

  const notes = normalise(current.notes);
  if (notes !== (normalise(initial.notes) ?? null)) payload.notes = notes;

  const maintenance = normalise(current.last_maintenance_at);
  if (maintenance !== (normalise(initial.last_maintenance_at) ?? null)) {
    payload.last_maintenance_at = maintenance;
  }

  return {
    payload,
    detachesTracker: payload.tracker_imei === null && initial.tracker_imei.trim() !== '',
  };
}

export function hasChanges(payload: object): boolean {
  return Object.keys(payload).length > 0;
}
