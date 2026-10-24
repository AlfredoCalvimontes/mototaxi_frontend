/** Fixtures shaped exactly like the verified backend responses. */

import type {
  DriverPositionCheck,
  Alerts,
  CustomerSummary,
  Driver,
  KPIs,
  RuntimeSetting,
  UsagePlan,
  Vehicle,
  VehicleSummary,
  TripSummary,
  UserProfile,
  VehicleType,
  City,
  Tenant,
  UserCityAccess,
  WhatsAppConfig,
  TenantUsage,
  AuditEntry,
  TripKpiGroup,
} from '@/api/types';

export const adminProfile: UserProfile = {
  user_uuid: '11111111-1111-4111-8111-111111111111',
  email: 'admin@mototaxis.bo',
  name: 'Ana',
  first_lastname: 'Gutiérrez',
  role: 'TENANT_ADMIN',
  is_active: true,
  tenant_id: '33333333-3333-4333-8333-333333333333',
  city_uuids: [],
};

export const superadminProfile: UserProfile = {
  ...adminProfile,
  role: 'SUPERADMIN',
  tenant_id: null,
};

export const cityAdminProfile: UserProfile = {
  ...adminProfile,
  role: 'CITY_ADMIN',
  city_uuids: ['44444444-4444-4444-8444-444444444444'],
};

export const operatorProfile: UserProfile = { ...cityAdminProfile, role: 'OPERATOR' };

export const activeTrip: TripSummary = {
  trip_uuid: '22222222-2222-4222-8222-222222222222',
  status: 'EN_ROUTE',
  customer_phone: '+59171234567',
  driver_name: 'Marco Peña',
  plate_number: 'ABC123',
  pickup_address: 'Av. Méndez Arcos 120',
  destination_address: 'Mercado Central',
  reach_time_seconds: 240,
  reach_time_source: 'OSRM',
  completion_source: null,
  cancelled_by: null,
  rating: null,
  created_at: '2026-07-20T14:00:00Z',
  ended_at: null,
  city_uuid: null,
  requested_vehicle_type_uuid: null,
  vehicle_type_uuid: null,
};

/** Estimated reach time — the UI must mark this as an estimate (plan §5.6). */
export const searchingTrip: TripSummary = {
  ...activeTrip,
  trip_uuid: '33333333-3333-4333-8333-333333333333',
  status: 'REQUESTED',
  driver_name: null,
  plate_number: null,
  reach_time_seconds: 420,
  reach_time_source: 'STRAIGHT_LINE',
  created_at: '2026-07-20T14:20:00Z',
};

/** Closed without driver confirmation — flagged for review in history. */
export const autoCompletedTrip: TripSummary = {
  ...activeTrip,
  trip_uuid: '44444444-4444-4444-8444-444444444444',
  status: 'COMPLETED',
  completion_source: 'AUTO',
  rating: 4,
  created_at: '2026-07-19T11:00:00Z',
  ended_at: '2026-07-19T11:35:00Z',
};

export const sharedLocationSetting: RuntimeSetting = {
  key: 'shared_location_freshness_minutes',
  value: 30,
  default: 30,
  minimum: 5,
  maximum: 480,
  unit: 'minutes',
  description: 'How long a location shared by hand keeps a vehicle dispatchable',
  updated_at: null,
  source: 'default',
};

export const simDaysSetting: RuntimeSetting = {
  key: 'sim_days_per_ten_credit',
  value: 30,
  default: 30,
  minimum: 5,
  maximum: 365,
  unit: 'days',
  description: 'How many days ten units of credit keep a tracker SIM alive',
  updated_at: null,
  source: 'default',
};

export const vehicleSummary: VehicleSummary = {
  vehicle_uuid: '55555555-5555-4555-8555-555555555555',
  plate_number: 'ABC123',
  alias: null,
  status: 'AVAILABLE',
  lat: -21.26235,
  lon: -63.46903,
  location_updated_at: '2026-07-20T14:29:00Z',
  location_source: 'TRACKER',
  has_tracker: true,
  sim_last_recharge_at: null,
  sim_last_recharge_amount: null,
  sim_next_recharge_at: null,
  is_tracker_stale: false,
  current_driver_uuid: '66666666-6666-4666-8666-666666666666',
  city_uuid: null,
  vehicle_type_uuid: null,
};

export const staleVehicleSummary: VehicleSummary = {
  ...vehicleSummary,
  vehicle_uuid: '77777777-7777-4777-8777-777777777777',
  plate_number: 'XYZ789',
  location_updated_at: '2026-07-20T13:00:00Z',
  is_tracker_stale: true,
  current_driver_uuid: null,
};

export const vehicleDetail: Vehicle = {
  vehicle_uuid: vehicleSummary.vehicle_uuid,
  plate_number: 'ABC123',
  alias: null,
  brand: 'Honda',
  model: 'CG 125',
  device_id: '860123456789012',
  tracker_type: 'GT06',
  vehicle_type_uuid: null,
  attributes: {},
  city_uuid: null,
  sim_last_recharge_at: null,
  sim_last_recharge_amount: null,
  sim_next_recharge_at: null,
  status: 'AVAILABLE',
  lat: -21.26235,
  lon: -63.46903,
  location_updated_at: '2026-07-20T14:29:00Z',
  location_source: 'TRACKER',
  current_driver_uuid: '66666666-6666-4666-8666-666666666666',
  is_tracker_stale: false,
  notes: null,
  last_maintenance_at: '2026-06-01',
  created_at: '2026-05-01T10:00:00Z',
};

export const freePlan: UsagePlan = {
  usage_plan_uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  name: 'Acuerdo personalizado',
  daily_credit: 0,
  includes_vehicle_rental: false,
  description: null,
  is_active: true,
  created_at: '2026-05-01T09:00:00Z',
  driver_count: null,
  affected_drivers: null,
};

export const rentalPlan: UsagePlan = {
  ...freePlan,
  usage_plan_uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  name: 'Alquiler de moto',
  daily_credit: 60,
  includes_vehicle_rental: true,
};

export const driver: Driver = {
  driver_uuid: '66666666-6666-4666-8666-666666666666',
  name: 'Marco Peña',
  ci: '7654321 TJ',
  phone_whatsapp: '+59171234567',
  license_number: 'LIC-4421',
  status: 'AVAILABLE',
  current_vehicle_uuid: vehicleSummary.vehicle_uuid,
  offer_accepted_count: 42,
  offer_declined_count: 3,
  offer_timeout_count: 1,
  trips_completed: 40,
  average_response_seconds: 18.5,
  acceptance_rate: 0.91,
  resting_until: null,
  last_checkin_at: '2026-07-20T11:00:00Z',
  has_checked_in_today: true,
  has_phone_key: false,
  lat: null,
  lon: null,
  location_updated_at: null,
  location_source: null,
  usage_credit_enabled: false,
  usage_credit_balance: null,
  usage_credit_expires_at: null,
  usage_credit_expired: false,
  usage_plan_uuid: freePlan.usage_plan_uuid,
  usage_plan_name: freePlan.name,
  usage_daily_credit: 0,
  includes_vehicle_rental: false,
  created_at: '2026-05-02T09:00:00Z',
  city_uuid: null,
};

/** No check-in today: receives no offers, so the panel must surface it (spec §10.5). */
export const driverWithoutCheckin: Driver = {
  ...driver,
  driver_uuid: '88888888-8888-4888-8888-888888888888',
  name: 'Lucía Vargas',
  ci: '1234567 TJ',
  phone_whatsapp: '+59176543210',
  status: 'OFFLINE',
  current_vehicle_uuid: null,
  last_checkin_at: '2026-07-18T12:00:00Z',
  has_checked_in_today: false,
};

/** On the credit scheme with credit left, but not much: the last days show amber. */
export const driverWithCredit: Driver = {
  ...driver,
  driver_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Rafael Soria',
  ci: '5551234 TJ',
  phone_whatsapp: '+59170001234',
  usage_plan_uuid: rentalPlan.usage_plan_uuid,
  usage_plan_name: rentalPlan.name,
  usage_daily_credit: 60,
  includes_vehicle_rental: true,
  usage_credit_enabled: true,
  usage_credit_balance: 180,
  usage_credit_expires_at: '2099-01-01T14:00:00Z',
  usage_credit_expired: false,
};

/** Out of credit: no trips, and the panel paints the row red. */
export const driverCreditExpired: Driver = {
  ...driverWithCredit,
  driver_uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Elena Cruz',
  ci: '4441234 TJ',
  phone_whatsapp: '+59170005678',
  usage_credit_balance: 0,
  usage_credit_expires_at: '2026-10-01T14:00:00Z',
  usage_credit_expired: true,
};

export const customer: CustomerSummary = {
  customer_uuid: '99999999-9999-4999-8999-999999999999',
  phone_whatsapp: '+59171112222',
  name: 'Rosa Flores',
  trip_count: 12,
  cancel_count: 1,
  average_rating_given: 4.5,
  is_blocked: false,
  last_message_at: '2026-07-20T13:45:00Z',
  city_uuid: null,
};

export const blockedCustomer: CustomerSummary = {
  ...customer,
  customer_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: null,
  phone_whatsapp: '+59173334444',
  cancel_count: 9,
  is_blocked: true,
};

export const kpis: KPIs = {
  trips_today: 34,
  trips_completed_today: 28,
  trips_cancelled_today: 4,
  trips_no_driver_today: 2,
  average_reach_time_seconds: 265.4,
  average_rating: 4.6,
  drivers_available: 6,
  drivers_without_checkin: 2,
};

export const alerts: Alerts = {
  failed_actions: 1,
  stale_trackers: 1,
  overdue_trips: 0,
  auto_completed_trips: 2,
  drivers_without_checkin: 2,
};

export const noAlerts: Alerts = {
  failed_actions: 0,
  stale_trackers: 0,
  overdue_trips: 0,
  auto_completed_trips: 0,
  drivers_without_checkin: 0,
};

export const positionCheck: DriverPositionCheck = {
  driver_uuid: driver.driver_uuid,
  vehicle_uuid: vehicleSummary.vehicle_uuid,
  driver_fix: {
    lat: -21.2625,
    lon: -63.469,
    source: 'PHONE',
    recorded_at: '2026-07-20T14:29:30Z',
    flag: null,
  },
  vehicle_fix: {
    lat: -21.26235,
    lon: -63.46903,
    source: 'TRACKER',
    recorded_at: '2026-07-20T14:29:00Z',
    flag: null,
  },
  tracker_fix: {
    lat: -21.26235,
    lon: -63.46903,
    source: 'TRACKER',
    recorded_at: '2026-07-20T14:29:00Z',
    flag: null,
  },
  driver_to_vehicle_m: 18,
  driver_to_tracker_m: 18,
  seconds_apart: 30,
  diverges: false,
  flagged_fixes: 0,
  driver_trace: [
    {
      lat: -21.2625,
      lon: -63.469,
      source: 'PHONE',
      recorded_at: '2026-07-20T14:29:30Z',
      flag: null,
    },
  ],
  tracker_trace: [],
};

export const globalMotoType: VehicleType = {
  vehicle_type_uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenant_uuid: null,
  code: 'moto',
  display_name: 'Mototaxi',
  attribute_schema: [{ key: 'seats', type: 'int', required: true, label: 'Asientos' }],
  is_active: true,
  is_global: true,
  created_at: '2026-10-01T10:00:00Z',
};

export const ownVanType: VehicleType = {
  vehicle_type_uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  tenant_uuid: adminProfile.tenant_id ?? null,
  code: 'minivan',
  display_name: 'Minivan',
  attribute_schema: [],
  is_active: true,
  is_global: false,
  created_at: '2026-10-02T10:00:00Z',
};

export const tenant: Tenant = {
  tenant_id: adminProfile.tenant_id as string,
  name: 'Mototaxi Seguro',
  slug: 'mototaxi-seguro',
  is_active: true,
  contact_email: 'info@mototaxiseguro.bo',
  contact_phone: '+59171111111',
  deactivated_at: null,
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
};

export const otherTenant: Tenant = {
  ...tenant,
  tenant_id: '99999999-9999-4999-8999-999999999999',
  name: 'Taxi Sur',
  slug: 'taxi-sur',
};

export const city: City = {
  city_id: '44444444-4444-4444-8444-444444444444',
  tenant_id: tenant.tenant_id,
  name: 'Villa Montes',
  timezone: 'America/La_Paz',
  geofence_wkt: 'POLYGON((-63.5 -21.3, -63.4 -21.3, -63.4 -21.2, -63.5 -21.3))',
  geofence_geojson: {
    type: 'Polygon',
    coordinates: [
      [
        [-63.5, -21.3],
        [-63.4, -21.3],
        [-63.4, -21.2],
        [-63.5, -21.3],
      ],
    ],
  },
  is_active: true,
  created_at: '2026-01-02T10:00:00Z',
  updated_at: '2026-01-02T10:00:00Z',
};

export const secondCity: City = {
  ...city,
  city_id: '55555555-5555-4555-8555-555555555555',
  name: 'Yacuiba',
  geofence_wkt: null,
  geofence_geojson: null,
};

export const cityGrant: UserCityAccess = {
  user_city_access_id: '88888888-8888-4888-8888-888888888888',
  user_id: cityAdminProfile.user_uuid,
  city_id: city.city_id,
  created_at: '2026-02-01T10:00:00Z',
};

export const whatsappConfig: WhatsAppConfig = {
  tenant_uuid: tenant.tenant_id,
  phone_number_id: '1090000000000001',
  waba_id: '1590190706485878',
  display_phone_number: '+591 7000 0001',
  is_active: true,
  updated_at: '2026-10-10T12:00:00Z',
};

export const usageRows: TenantUsage[] = [
  {
    tenant_uuid: tenant.tenant_id,
    active_drivers: 12,
    vehicles: 14,
    trips: 340,
    inbound_messages: 1200,
    outbound_messages: 1500,
  },
  {
    tenant_uuid: otherTenant.tenant_id,
    active_drivers: 3,
    vehicles: 3,
    trips: 40,
    inbound_messages: 90,
    outbound_messages: 120,
  },
];

export const kpiGroups: TripKpiGroup[] = [
  {
    group_uuid: tenant.tenant_id,
    trips: 50,
    completed: 40,
    cancelled: 6,
    no_driver: 4,
    average_reach_time_seconds: 300,
    average_rating: 4.6,
  },
  {
    group_uuid: otherTenant.tenant_id,
    trips: 8,
    completed: 7,
    cancelled: 1,
    no_driver: 0,
    average_reach_time_seconds: null,
    average_rating: null,
  },
];

export const auditEntry: AuditEntry = {
  audit_log_uuid: 'abababab-abab-4bab-8bab-abababababab',
  tenant_uuid: tenant.tenant_id,
  table_name: 'drivers',
  entity_id: '66666666-6666-4666-8666-666666666666',
  action: 'UPDATE',
  actor_id: superadminProfile.user_uuid,
  actor_ip: '10.0.0.1',
  before: { name: 'Marco' },
  after: { name: 'Marco Peña' },
  created_at: '2026-10-15T15:00:00Z',
};
