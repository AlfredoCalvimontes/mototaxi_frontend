/** Fixtures shaped exactly like the verified backend responses. */

import type {
  Alerts,
  CustomerSummary,
  Driver,
  KPIs,
  RuntimeSetting,
  Mototaxi,
  MototaxiSummary,
  TripSummary,
  UserProfile,
} from '@/api/types';

export const adminProfile: UserProfile = {
  user_uuid: '11111111-1111-4111-8111-111111111111',
  email: 'admin@mototaxis.bo',
  name: 'Ana',
  first_lastname: 'Gutiérrez',
  role: 'ADMIN',
  is_active: true,
};

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
  description: 'How long a location shared by hand keeps a mototaxi dispatchable',
  updated_at: null,
};

export const mototaxiSummary: MototaxiSummary = {
  mototaxi_uuid: '55555555-5555-4555-8555-555555555555',
  plate_number: 'ABC123',
  status: 'AVAILABLE',
  lat: -21.26235,
  lon: -63.46903,
  location_updated_at: '2026-07-20T14:29:00Z',
  location_source: 'TRACKER',
  has_tracker: true,
  is_tracker_stale: false,
  current_driver_uuid: '66666666-6666-4666-8666-666666666666',
};

export const staleMototaxiSummary: MototaxiSummary = {
  ...mototaxiSummary,
  mototaxi_uuid: '77777777-7777-4777-8777-777777777777',
  plate_number: 'XYZ789',
  location_updated_at: '2026-07-20T13:00:00Z',
  is_tracker_stale: true,
  current_driver_uuid: null,
};

export const mototaxiDetail: Mototaxi = {
  mototaxi_uuid: mototaxiSummary.mototaxi_uuid,
  plate_number: 'ABC123',
  brand: 'Honda',
  model: 'CG 125',
  tracker_imei: '860123456789012',
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

export const driver: Driver = {
  driver_uuid: '66666666-6666-4666-8666-666666666666',
  name: 'Marco Peña',
  ci: '7654321 TJ',
  phone_whatsapp: '+59171234567',
  license_number: 'LIC-4421',
  status: 'AVAILABLE',
  current_mototaxi_uuid: mototaxiSummary.mototaxi_uuid,
  offer_accepted_count: 42,
  offer_declined_count: 3,
  offer_timeout_count: 1,
  trips_completed: 40,
  average_response_seconds: 18.5,
  acceptance_rate: 0.91,
  resting_until: null,
  last_checkin_at: '2026-07-20T11:00:00Z',
  has_checked_in_today: true,
  created_at: '2026-05-02T09:00:00Z',
};

/** No check-in today: receives no offers, so the panel must surface it (spec §10.5). */
export const driverWithoutCheckin: Driver = {
  ...driver,
  driver_uuid: '88888888-8888-4888-8888-888888888888',
  name: 'Lucía Vargas',
  ci: '1234567 TJ',
  phone_whatsapp: '+59176543210',
  status: 'OFFLINE',
  current_mototaxi_uuid: null,
  last_checkin_at: '2026-07-18T12:00:00Z',
  has_checked_in_today: false,
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
