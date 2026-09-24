/**
 * Transcribed from the backend Pydantic schemas, verified 2026-07-20 against
 * `presentation/rest/v1/schemas/{dispatch,fleet,users}.py`.
 *
 * Timestamps are UTC ISO strings; render them through `lib/format.ts`, which
 * pins the display zone to America/La_Paz.
 */

export type UUID = string;
/** UTC ISO-8601, e.g. `2026-07-20T18:30:00Z`. */
export type IsoDateTime = string;
/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

export type DriverStatus = 'AVAILABLE' | 'IN_TRIP' | 'RESTING' | 'OFFLINE' | 'DISABLED';
export type MototaxiStatus = 'AVAILABLE' | 'DISABLED' | 'OUT_OF_SERVICE';

export type TripStatus =
  | 'REQUESTED'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_TRIP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_DRIVER';

export type ReachTimeSource = 'OSRM' | 'STRAIGHT_LINE';
export type CompletionSource = 'DRIVER' | 'AUTO';
export type CancelledBy = 'CUSTOMER' | 'DRIVER' | 'SYSTEM' | 'ADMIN';

/** Trip statuses that can still change — the live board's filter. */
export const ACTIVE_TRIP_STATUSES: readonly TripStatus[] = [
  'REQUESTED',
  'OFFERED',
  'ACCEPTED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_TRIP',
];

// --- dispatch admin -------------------------------------------------------

export type TripSummary = {
  trip_uuid: UUID;
  /** Widened to `str` server-side; treat unknown values as displayable. */
  status: TripStatus | string;
  customer_phone: string | null;
  driver_name: string | null;
  plate_number: string | null;
  pickup_address: string | null;
  destination_address: string | null;
  reach_time_seconds: number | null;
  reach_time_source: ReachTimeSource | string | null;
  completion_source: CompletionSource | string | null;
  cancelled_by: CancelledBy | string | null;
  rating: number | null;
  created_at: IsoDateTime;
  ended_at: IsoDateTime | null;
};

export type MototaxiSummary = {
  mototaxi_uuid: UUID;
  plate_number: string;
  status: MototaxiStatus | string;
  lat: number | null;
  lon: number | null;
  location_updated_at: IsoDateTime | null;
  /** How the position arrived: `TRACKER`, `WHATSAPP`… `null` until one does. */
  location_source: string | null;
  /** A GPS tracker is fitted. `false`: the driver must share a WhatsApp location. */
  has_tracker: boolean;
  /** Position older than the dispatch freshness window (spec §7.4). */
  is_tracker_stale: boolean;
  current_driver_uuid: UUID | null;
};

/** A setting the manager can change at runtime (`GET /admin/settings`). */
export type RuntimeSetting = {
  key: string;
  value: number;
  /** The shipped value, for "restore default". */
  default: number;
  minimum: number;
  maximum: number;
  unit: string;
  /** English description stored with the value; the UI shows its own Spanish text. */
  description: string;
  /** `null` until someone changes it from the default. */
  updated_at: IsoDateTime | null;
};

export type CustomerSummary = {
  customer_uuid: UUID;
  phone_whatsapp: string;
  name: string | null;
  trip_count: number;
  cancel_count: number;
  average_rating_given: number | null;
  is_blocked: boolean;
  last_message_at: IsoDateTime | null;
};

export type KPIs = {
  trips_today: number;
  trips_completed_today: number;
  trips_cancelled_today: number;
  trips_no_driver_today: number;
  average_reach_time_seconds: number | null;
  average_rating: number | null;
  drivers_available: number;
  drivers_without_checkin: number;
};

export type Alerts = {
  failed_actions: number;
  stale_trackers: number;
  overdue_trips: number;
  auto_completed_trips: number;
  drivers_without_checkin: number;
};

// --- fleet ----------------------------------------------------------------

export type Driver = {
  driver_uuid: UUID;
  name: string;
  ci: string;
  phone_whatsapp: string;
  license_number: string | null;
  status: DriverStatus;
  current_mototaxi_uuid: UUID | null;
  offer_accepted_count: number;
  offer_declined_count: number;
  offer_timeout_count: number;
  trips_completed: number;
  average_response_seconds: number | null;
  acceptance_rate: number | null;
  resting_until: IsoDateTime | null;
  last_checkin_at: IsoDateTime | null;
  has_checked_in_today: boolean;
  created_at: IsoDateTime;
};

/** Detail shape. The list endpoint returns {@link MototaxiSummary} — do not unify. */
export type Mototaxi = {
  mototaxi_uuid: UUID;
  plate_number: string;
  brand: string | null;
  model: string | null;
  tracker_imei: string | null;
  status: MototaxiStatus;
  lat: number | null;
  lon: number | null;
  location_updated_at: IsoDateTime | null;
  location_source: string | null;
  current_driver_uuid: UUID | null;
  is_tracker_stale: boolean;
  notes: string | null;
  last_maintenance_at: IsoDate | null;
  created_at: IsoDateTime;
};

export type CreateDriverPayload = {
  name: string;
  ci: string;
  phone_whatsapp: string;
  license_number?: string | null;
  mototaxi_uuid?: UUID | null;
};

/**
 * `ci` is deliberately absent: the backend does not accept it on edit.
 *
 * Omitted keys are left untouched and an explicit `null` is **silently
 * ignored** — nothing on a driver can be cleared through this route. This is
 * the opposite of {@link UpdateMototaxiPayload}; see `lib/dirty.ts`.
 */
export type UpdateDriverPayload = {
  name?: string;
  phone_whatsapp?: string;
  license_number?: string | null;
};

export type ChangeDriverStatusPayload = {
  status: DriverStatus;
  reason?: string | null;
  /** Rejected with 422 unless `status === 'RESTING'`. */
  resting_until?: IsoDateTime | null;
};

/** `mototaxi_uuid` is required: `null` detaches, an empty body is a 422. */
export type AssignMototaxiPayload = { mototaxi_uuid: UUID | null };

export type CreateMototaxiPayload = {
  plate_number: string;
  brand?: string | null;
  model?: string | null;
  tracker_imei?: string | null;
  notes?: string | null;
};

/**
 * Omitted keys are left untouched; an explicit `null` **clears** the field.
 * `{tracker_imei: null}` detaches the tracker and drops the IMEI from the GT06
 * allowlist (spec §7.2) — never emit it for a merely untouched input.
 */
export type UpdateMototaxiPayload = {
  plate_number?: string;
  brand?: string | null;
  model?: string | null;
  tracker_imei?: string | null;
  notes?: string | null;
  last_maintenance_at?: IsoDate | null;
};

export type ChangeMototaxiStatusPayload = { status: MototaxiStatus };

// --- auth -----------------------------------------------------------------

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

/** Only the fields the panel actually reads off `GET /users/me`. */
export type UserProfile = {
  user_uuid: UUID;
  email: string | null;
  name: string;
  first_lastname: string;
  role: string;
  is_active: boolean;
};
