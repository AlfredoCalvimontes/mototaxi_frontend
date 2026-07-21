/**
 * Dirty-field serialisation for the two PATCH routes.
 *
 * These are deliberately **two functions with no shared helper**. The routes
 * disagree about what `null` means, and one helper emitting `null` for an
 * untouched field is harmless on a driver and destructive on a vehicle:
 *
 * - `PATCH /admin/drivers/{uuid}` — `null` is silently ignored. Nothing on a
 *   driver can be cleared through it.
 * - `PATCH /admin/mototaxis/{uuid}` — `null` **clears** the field.
 *   `{tracker_imei: null}` detaches the tracker and drops that IMEI from the
 *   GT06 allowlist (spec §7.2).
 *
 * Both routes forward only the keys present in the body (`model_fields_set`),
 * so both functions emit dirty fields only — never a whole object.
 */

import type { UpdateDriverPayload, UpdateMototaxiPayload } from '@/api/types';

/** Trims and turns an empty input into `null`, which each caller then judges. */
function normalise(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export type DriverFormValues = {
  name: string;
  phone_whatsapp: string;
  license_number: string;
};

export type DriverChanges = {
  payload: UpdateDriverPayload;
  /**
   * Fields the operator blanked that this route cannot clear. The form has to
   * say so: sending them would be accepted and silently do nothing, leaving
   * the operator believing a value was removed.
   */
  unclearable: (keyof DriverFormValues)[];
};

export function driverChanges(initial: DriverFormValues, current: DriverFormValues): DriverChanges {
  const payload: UpdateDriverPayload = {};
  const unclearable: (keyof DriverFormValues)[] = [];

  const name = normalise(current.name);
  if (name !== null && name !== initial.name) payload.name = name;
  else if (name === null && initial.name !== '') unclearable.push('name');

  const phone = normalise(current.phone_whatsapp);
  if (phone !== null && phone !== initial.phone_whatsapp) payload.phone_whatsapp = phone;
  else if (phone === null && initial.phone_whatsapp !== '') unclearable.push('phone_whatsapp');

  const license = normalise(current.license_number);
  if (license !== null && license !== initial.license_number) payload.license_number = license;
  else if (license === null && initial.license_number !== '') unclearable.push('license_number');

  return { payload, unclearable };
}

export type MototaxiFormValues = {
  plate_number: string;
  brand: string;
  model: string;
  tracker_imei: string;
  notes: string;
  last_maintenance_at: string;
};

export type MototaxiChanges = {
  payload: UpdateMototaxiPayload;
  /**
   * True when the payload detaches the tracker. The IMEI is not a field to tab
   * through: dropping it removes the vehicle from the GT06 allowlist, so the
   * form confirms it separately (plan §7.4).
   */
  detachesTracker: boolean;
};

export function mototaxiChanges(
  initial: MototaxiFormValues,
  current: MototaxiFormValues,
): MototaxiChanges {
  const payload: UpdateMototaxiPayload = {};

  // The plate is required by the schema, so blanking it is not a clear —
  // the form rejects it before we get here and it is simply not sent.
  const plate = normalise(current.plate_number);
  if (plate !== null && plate !== initial.plate_number) payload.plate_number = plate;

  // Everything below is nullable: an emptied input is an explicit clear.
  const brand = normalise(current.brand);
  if (brand !== (normalise(initial.brand) ?? null)) payload.brand = brand;

  const model = normalise(current.model);
  if (model !== (normalise(initial.model) ?? null)) payload.model = model;

  const imei = normalise(current.tracker_imei);
  if (imei !== (normalise(initial.tracker_imei) ?? null)) payload.tracker_imei = imei;

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
