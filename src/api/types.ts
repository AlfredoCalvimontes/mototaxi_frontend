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
export type VehicleStatus = 'AVAILABLE' | 'DISABLED' | 'OUT_OF_SERVICE';
/** The device protocol, not where a position came from. Only GT06 has a listener. */
export type TrackerType = 'GT06' | 'SECUREMORE';

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
  city_uuid: UUID | null;
  /** What the customer asked for; `null` = any type. */
  requested_vehicle_type_uuid: UUID | null;
  /** The assigned vehicle's type; `null` until one is assigned. */
  vehicle_type_uuid: UUID | null;
};

export type VehicleSummary = {
  vehicle_uuid: UUID;
  plate_number: string;
  alias: string | null;
  status: VehicleStatus | string;
  lat: number | null;
  lon: number | null;
  location_updated_at: IsoDateTime | null;
  /** How the position arrived: `TRACKER`, `WHATSAPP`… `null` until one does. */
  location_source: string | null;
  /** A GPS tracker is fitted. `false`: the driver must share a WhatsApp location. */
  has_tracker: boolean;
  /** Last top-up of the tracker's SIM; `null` without a tracker or before the first one. */
  sim_last_recharge_at: IsoDate | null;
  /** Credit that top-up added. */
  sim_last_recharge_amount: number | null;
  /** When the credit should run out: ten units last a month. */
  sim_next_recharge_at: IsoDate | null;
  /** Position older than the dispatch freshness window (spec §7.4). */
  is_tracker_stale: boolean;
  current_driver_uuid: UUID | null;
  city_uuid: UUID | null;
  vehicle_type_uuid: UUID | null;
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
  /** Where the effective value comes from. */
  source: 'tenant' | 'global' | 'default';
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
  city_uuid: UUID | null;
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
  current_vehicle_uuid: UUID | null;
  offer_accepted_count: number;
  offer_declined_count: number;
  offer_timeout_count: number;
  trips_completed: number;
  average_response_seconds: number | null;
  acceptance_rate: number | null;
  resting_until: IsoDateTime | null;
  last_checkin_at: IsoDateTime | null;
  has_checked_in_today: boolean;
  /** A phone GPS key is issued, so this driver's phone can report. It follows them between units. */
  has_phone_key: boolean;
  /** The driver's own last position (phone or WhatsApp), apart from their unit's. */
  lat: number | null;
  lon: number | null;
  location_updated_at: IsoDateTime | null;
  location_source: string | null;
  /** On the credit scheme: may be offered trips only while the credit lasts. */
  usage_credit_enabled: boolean;
  /** Drained to this moment; never below zero. `null` off the scheme. */
  usage_credit_balance: number | null;
  /** The instant the balance runs out (UTC). `null` off the scheme. */
  usage_credit_expires_at: IsoDateTime | null;
  usage_credit_expired: boolean;
  created_at: IsoDateTime;
  /** Owning city. `null` until an admin assigns one. */
  city_uuid: UUID | null;
};

/** Detail shape. The list endpoint returns {@link VehicleSummary} — do not unify. */
export type Vehicle = {
  vehicle_uuid: UUID;
  plate_number: string;
  alias: string | null;
  brand: string | null;
  model: string | null;
  device_id: string | null;
  tracker_type: TrackerType;
  vehicle_type_uuid: UUID | null;
  /** Validated server-side against the type's `attribute_schema`. */
  attributes: Record<string, unknown>;
  /** Owning city. `null` until an admin assigns one. */
  city_uuid: UUID | null;
  sim_last_recharge_at: IsoDate | null;
  sim_last_recharge_amount: number | null;
  sim_next_recharge_at: IsoDate | null;
  status: VehicleStatus;
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
  vehicle_uuid?: UUID | null;
  /** Starts with an empty balance, so credit has to be added before the first trip. */
  usage_credit_enabled?: boolean;
  city_uuid?: UUID | null;
};

/**
 * `ci` is deliberately absent: the backend does not accept it on edit.
 *
 * Omitted keys are left untouched and an explicit `null` is **silently
 * ignored** — nothing on a driver can be cleared through this route. This is
 * the opposite of {@link UpdateVehiclePayload}; see `lib/dirty.ts`.
 */
export type UpdateDriverPayload = {
  name?: string;
  phone_whatsapp?: string;
  license_number?: string | null;
  /** `false` takes the driver off the scheme and discards their balance. */
  usage_credit_enabled?: boolean;
};

/** Negative takes credit back; zero is refused (422). */
export type AddUsageCreditPayload = { amount: number };

export type ChangeDriverStatusPayload = {
  status: DriverStatus;
  reason?: string | null;
  /** Rejected with 422 unless `status === 'RESTING'`. */
  resting_until?: IsoDateTime | null;
};

/** `vehicle_uuid` is required: `null` detaches, an empty body is a 422. */
export type AssignVehiclePayload = { vehicle_uuid: UUID | null };

export type CreateVehiclePayload = {
  plate_number: string;
  alias?: string | null;
  brand?: string | null;
  model?: string | null;
  device_id?: string | null;
  tracker_type?: TrackerType;
  vehicle_type_uuid?: UUID | null;
  attributes?: Record<string, unknown>;
  city_uuid?: UUID | null;
  /** Sent together or not at all; both `null` clears the record. Needs a tracker. */
  sim_last_recharge_at?: IsoDate | null;
  sim_last_recharge_amount?: number | null;
  notes?: string | null;
};

/**
 * Omitted keys are left untouched; an explicit `null` **clears** the field.
 * `{device_id: null}` detaches the tracker and drops the IMEI from the GT06
 * allowlist (spec §7.2) — never emit it for a merely untouched input.
 */
export type UpdateVehiclePayload = {
  plate_number?: string;
  alias?: string | null;
  brand?: string | null;
  model?: string | null;
  device_id?: string | null;
  /** Cannot be `null`: omit it to leave it as is. */
  tracker_type?: TrackerType;
  vehicle_type_uuid?: UUID | null;
  /** Cannot be `null`: send `{}` to empty it. Replaces the whole object. */
  attributes?: Record<string, unknown>;
  sim_last_recharge_at?: IsoDate | null;
  sim_last_recharge_amount?: number | null;
  notes?: string | null;
  last_maintenance_at?: IsoDate | null;
};

export type ChangeVehicleStatusPayload = { status: VehicleStatus };

/** `city_uuid` is required: this is always a deliberate move, never a clear. */
export type MoveToCityPayload = { city_uuid: UUID };

// --- vehicle types ----------------------------------------------------------

/** What the backend's `ATTRIBUTE_TYPES` accepts. */
export type AttributeType = 'string' | 'int' | 'float' | 'bool';

export type AttributeSchemaField = {
  key: string;
  type: AttributeType;
  required: boolean;
  label: string;
};

export type VehicleType = {
  vehicle_type_uuid: UUID;
  /** `null` for a global type, which only a superadmin edits. */
  tenant_uuid: UUID | null;
  code: string;
  display_name: string;
  attribute_schema: AttributeSchemaField[];
  is_active: boolean;
  is_global: boolean;
  created_at: IsoDateTime;
};

export type CreateVehicleTypePayload = {
  code: string;
  display_name: string;
  attribute_schema: AttributeSchemaField[];
  /** Superadmin only; anyone else gets 403. */
  is_global?: boolean;
};

/** The code is not editable. A field left out is unchanged. */
export type UpdateVehicleTypePayload = {
  display_name?: string;
  attribute_schema?: AttributeSchemaField[];
  is_active?: boolean;
};

// --- auth -----------------------------------------------------------------

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

/**
 * Mirrors the backend `UserRole`, highest to lowest privilege. `CUSTOMER` is
 * WhatsApp-only and never signs in to this panel.
 */
export type UserRole = 'SUPERADMIN' | 'TENANT_ADMIN' | 'CITY_ADMIN' | 'OPERATOR' | 'CUSTOMER';

/** Only the fields the panel actually reads off `GET /users/me`. */
export type UserProfile = {
  user_uuid: UUID;
  email: string | null;
  name: string;
  first_lastname: string;
  role: UserRole;
  is_active: boolean;
  /** Owning tenant; `null` for a superadmin. Absent until backend P7 adds it to `/users/me`. */
  tenant_id?: UUID | null;
  /** Cities a CITY_ADMIN/OPERATOR may act in. Absent until backend P7. */
  city_uuids?: UUID[];
};

/** Returned once by `POST /admin/drivers/{uuid}/phone-key`; only a hash is stored. */
export type PhoneKey = { phone_key: string };

/** One fix in a driver or unit trace. */
export type PositionFix = {
  lat: number;
  lon: number;
  source: string;
  recorded_at: IsoDateTime;
  /** Why the fix was not believed (`DIVERGES_FROM_TRACKER`, …); `null` when it was. */
  flag: string | null;
};

/** `GET /admin/drivers/{uuid}/position-check`: the driver's trace beside their unit's. */
export type DriverPositionCheck = {
  driver_uuid: UUID;
  vehicle_uuid: UUID | null;
  driver_fix: PositionFix | null;
  vehicle_fix: PositionFix | null;
  tracker_fix: PositionFix | null;
  driver_to_vehicle_m: number | null;
  driver_to_tracker_m: number | null;
  seconds_apart: number | null;
  /** Far from the tracker while taken within the comparison window. */
  diverges: boolean;
  flagged_fixes: number;
  driver_trace: PositionFix[];
  tracker_trace: PositionFix[];
};

// --- tenancy ----------------------------------------------------------------

export type PaginationParams = { page?: number; page_size?: number };

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type Tenant = {
  tenant_id: UUID;
  name: string;
  slug: string;
  is_active: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  deactivated_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
};

/** Superadmin provisions tenants; `slug` is fixed once created. */
export type CreateTenantPayload = {
  name: string;
  slug: string;
  contact_email?: string | null;
  contact_phone?: string | null;
};

/**
 * `null` is a silent no-op on this route (the use case treats it as "leave
 * unchanged"), so nothing here can be cleared. See `lib/dirty.ts`.
 */
export type UpdateTenantPayload = {
  name?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
};

export type City = {
  city_id: UUID;
  tenant_id: UUID;
  name: string;
  timezone: string;
  /** Service perimeter, WKT SRID 4326. `null` = no geofence drawn. */
  geofence_wkt: string | null;
  /** The same polygon as GeoJSON, derived by the server; `null` if absent or unparseable. */
  geofence_geojson: GeoJsonPolygon | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
};

export type GeoJsonPolygon = {
  type: 'Polygon';
  /** `[lon, lat]` rings; the first is the outline. */
  coordinates: number[][][];
};

export type CreateCityPayload = {
  name: string;
  timezone: string;
  geofence_wkt?: string | null;
};

/** Same `null`-is-ignored rule as {@link UpdateTenantPayload}. */
export type UpdateCityPayload = {
  name?: string;
  timezone?: string;
  geofence_wkt?: string | null;
};

/** One grant scoping a CITY_ADMIN/OPERATOR user to a city. */
export type UserCityAccess = {
  user_city_access_id: UUID;
  user_id: UUID;
  city_id: UUID;
  created_at: IsoDateTime;
};

export type GrantCityAccessPayload = { user_id: UUID };

// --- platform operations (superadmin) ---------------------------------------

/** Never carries the token: it is write-only from here. */
export type WhatsAppConfig = {
  tenant_uuid: UUID;
  phone_number_id: string;
  waba_id: string | null;
  display_phone_number: string | null;
  is_active: boolean;
  updated_at: IsoDateTime;
};

/** `access_token` omitted on an update keeps the stored one. */
export type SetWhatsAppConfigPayload = {
  phone_number_id: string;
  access_token?: string | null;
  waba_id?: string | null;
  display_phone_number?: string | null;
  is_active?: boolean;
};

export type TenantUsage = {
  tenant_uuid: UUID;
  active_drivers: number;
  vehicles: number;
  trips: number;
  inbound_messages: number;
  outbound_messages: number;
};

export type AuditEntry = {
  audit_log_uuid: UUID;
  tenant_uuid: UUID | null;
  table_name: string;
  entity_id: UUID;
  action: string;
  actor_id: UUID | null;
  actor_ip: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: IsoDateTime;
};

export type AuditLogParams = PaginationParams & {
  tenant_id?: UUID;
  table_name?: string;
  entity_id?: UUID;
  actor_id?: UUID;
  since?: IsoDateTime;
  until?: IsoDateTime;
};

/** `group_uuid` is the tenant, or the requested vehicle type (`null` = any type). */
export type TripKpiGroup = {
  group_uuid: UUID | null;
  trips: number;
  completed: number;
  cancelled: number;
  no_driver: number;
  average_reach_time_seconds: number | null;
  average_rating: number | null;
};
