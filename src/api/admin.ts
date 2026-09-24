/** One typed function per admin endpoint. Paths mirror the routers exactly. */

import { request } from '@/api/client';
import type {
  Alerts,
  AssignMototaxiPayload,
  ChangeDriverStatusPayload,
  ChangeMototaxiStatusPayload,
  CreateDriverPayload,
  CreateMototaxiPayload,
  CustomerSummary,
  Driver,
  DriverStatus,
  KPIs,
  Mototaxi,
  RuntimeSetting,
  MototaxiSummary,
  TripSummary,
  UUID,
  UpdateDriverPayload,
  UpdateMototaxiPayload,
} from '@/api/types';

export type TripHistoryParams = {
  since?: string;
  until?: string;
  /** Server caps this at 1000; default 200. */
  limit?: number;
};

// --- dispatch board -------------------------------------------------------

export function listMototaxis(): Promise<MototaxiSummary[]> {
  return request<MototaxiSummary[]>('/admin/mototaxis');
}

export function listActiveTrips(): Promise<TripSummary[]> {
  return request<TripSummary[]>('/admin/trips/active');
}

export function listTripHistory(params: TripHistoryParams = {}): Promise<TripSummary[]> {
  return request<TripSummary[]>('/admin/trips/history', { query: { ...params } });
}

/**
 * Returns the CSV as a blob. This is the deliberate export action that is
 * allowed to carry unmasked phone numbers (spec §12.1).
 */
export async function downloadTripHistoryCsv(params: TripHistoryParams = {}): Promise<Blob> {
  const response = await request<Response>('/admin/trips/history.csv', {
    query: { ...params },
    raw: true,
  });
  return response.blob();
}

/** 409 means the trip already terminated — refetch the board, do not error out. */
export function forceCancelTrip(tripUuid: UUID, reason?: string): Promise<void> {
  return request<void>(`/admin/trips/${tripUuid}/cancel`, {
    method: 'POST',
    query: { reason },
  });
}

export function getKpis(): Promise<KPIs> {
  return request<KPIs>('/admin/kpis');
}

export function getAlerts(): Promise<Alerts> {
  return request<Alerts>('/admin/alerts');
}

// --- customers ------------------------------------------------------------

export function listCustomers(includeBlocked = false): Promise<CustomerSummary[]> {
  return request<CustomerSummary[]>('/admin/customers', {
    query: { include_blocked: includeBlocked },
  });
}

export function blockCustomer(customerUuid: UUID, reason?: string): Promise<void> {
  return request<void>(`/admin/customers/${customerUuid}/block`, {
    method: 'POST',
    query: { reason },
  });
}

export function unblockCustomer(customerUuid: UUID): Promise<void> {
  return request<void>(`/admin/customers/${customerUuid}/unblock`, { method: 'POST' });
}

// --- drivers --------------------------------------------------------------

export function listDrivers(status?: DriverStatus): Promise<Driver[]> {
  return request<Driver[]>('/admin/drivers', { query: { status } });
}

export function getDriver(driverUuid: UUID): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${driverUuid}`);
}

export function createDriver(payload: CreateDriverPayload): Promise<Driver> {
  return request<Driver>('/admin/drivers', { method: 'POST', json: payload });
}

/** Send dirty fields only — a `null` here is ignored, never a clear. */
export function updateDriver(driverUuid: UUID, payload: UpdateDriverPayload): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${driverUuid}`, { method: 'PATCH', json: payload });
}

/** The only route out of `DISABLED`. */
export function changeDriverStatus(
  driverUuid: UUID,
  payload: ChangeDriverStatusPayload,
): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${driverUuid}/status`, { method: 'PATCH', json: payload });
}

export function assignMototaxi(driverUuid: UUID, payload: AssignMototaxiPayload): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${driverUuid}/mototaxi`, {
    method: 'PATCH',
    json: payload,
  });
}

/** Soft delete: disables the driver, preserving their metrics (spec §10.4). */
export function deleteDriver(driverUuid: UUID, reason?: string): Promise<void> {
  return request<void>(`/admin/drivers/${driverUuid}`, { method: 'DELETE', query: { reason } });
}

// --- mototaxis ------------------------------------------------------------

export function getMototaxi(mototaxiUuid: UUID): Promise<Mototaxi> {
  return request<Mototaxi>(`/admin/mototaxis/${mototaxiUuid}`);
}

export function createMototaxi(payload: CreateMototaxiPayload): Promise<Mototaxi> {
  return request<Mototaxi>('/admin/mototaxis', { method: 'POST', json: payload });
}

/** Send dirty fields only — an explicit `null` **clears** the field here. */
export function updateMototaxi(
  mototaxiUuid: UUID,
  payload: UpdateMototaxiPayload,
): Promise<Mototaxi> {
  return request<Mototaxi>(`/admin/mototaxis/${mototaxiUuid}`, { method: 'PATCH', json: payload });
}

export function changeMototaxiStatus(
  mototaxiUuid: UUID,
  payload: ChangeMototaxiStatusPayload,
): Promise<Mototaxi> {
  return request<Mototaxi>(`/admin/mototaxis/${mototaxiUuid}/status`, {
    method: 'PATCH',
    json: payload,
  });
}

export function listSettings(): Promise<RuntimeSetting[]> {
  return request<RuntimeSetting[]>('/admin/settings');
}

export function updateSetting(key: string, value: number): Promise<RuntimeSetting> {
  return request<RuntimeSetting>(`/admin/settings/${key}`, { method: 'PUT', json: { value } });
}
