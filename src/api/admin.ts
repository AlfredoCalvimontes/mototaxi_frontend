/** One typed function per admin endpoint. Paths mirror the routers exactly. */

import { request } from '@/api/client';
import type {
  AddUsageCreditPayload,
  Alerts,
  AuditEntry,
  AuditLogParams,
  City,
  CreateCityPayload,
  CreateTenantPayload,
  GrantCityAccessPayload,
  MoveToCityPayload,
  Paginated,
  PaginationParams,
  SetWhatsAppConfigPayload,
  Tenant,
  TenantUsage,
  TripKpiGroup,
  UpdateCityPayload,
  UpdateTenantPayload,
  UserCityAccess,
  WhatsAppConfig,
  AssignVehiclePayload,
  ChangeDriverStatusPayload,
  ChangeVehicleStatusPayload,
  CreateDriverPayload,
  CreateVehiclePayload,
  CreateVehicleTypePayload,
  CustomerSummary,
  Driver,
  DriverStatus,
  KPIs,
  Vehicle,
  DriverPositionCheck,
  PhoneKey,
  RuntimeSetting,
  VehicleSummary,
  TripSummary,
  UUID,
  UpdateDriverPayload,
  UpdateVehiclePayload,
  UpdateVehicleTypePayload,
  VehicleType,
} from '@/api/types';

/**
 * Every dynamic path segment goes through here. Route params are decoded by the
 * router, so a crafted `..%2F` would otherwise reach the URL as a real `../`.
 */
const seg = encodeURIComponent;

export type TripHistoryParams = {
  since?: string;
  until?: string;
  /** Server caps this at 1000; default 200. */
  limit?: number;
  /** Only trips in this city; omitted = every city. */
  city_uuid?: string;
};

// --- dispatch board -------------------------------------------------------

export function listVehicles(cityUuid?: UUID | null): Promise<VehicleSummary[]> {
  return request<VehicleSummary[]>('/admin/vehicles', {
    query: { city_uuid: cityUuid ?? undefined },
  });
}

export function listActiveTrips(cityUuid?: UUID | null): Promise<TripSummary[]> {
  return request<TripSummary[]>('/admin/trips/active', {
    query: { city_uuid: cityUuid ?? undefined },
  });
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
  return request<void>(`/admin/trips/${seg(tripUuid)}/cancel`, {
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

export function listCustomers(
  includeBlocked = false,
  cityUuid?: UUID | null,
): Promise<CustomerSummary[]> {
  return request<CustomerSummary[]>('/admin/customers', {
    query: { include_blocked: includeBlocked, city_uuid: cityUuid ?? undefined },
  });
}

export function blockCustomer(customerUuid: UUID, reason?: string): Promise<void> {
  return request<void>(`/admin/customers/${seg(customerUuid)}/block`, {
    method: 'POST',
    query: { reason },
  });
}

export function unblockCustomer(customerUuid: UUID): Promise<void> {
  return request<void>(`/admin/customers/${seg(customerUuid)}/unblock`, { method: 'POST' });
}

// --- drivers --------------------------------------------------------------

export function listDrivers(status?: DriverStatus, cityUuid?: UUID | null): Promise<Driver[]> {
  return request<Driver[]>('/admin/drivers', {
    query: { status, city_uuid: cityUuid ?? undefined },
  });
}

export function getDriver(driverUuid: UUID): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${seg(driverUuid)}`);
}

export function createDriver(payload: CreateDriverPayload): Promise<Driver> {
  return request<Driver>('/admin/drivers', { method: 'POST', json: payload });
}

/** Send dirty fields only — a `null` here is ignored, never a clear. */
export function updateDriver(driverUuid: UUID, payload: UpdateDriverPayload): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${seg(driverUuid)}`, { method: 'PATCH', json: payload });
}

/** Adds credit to a driver on the scheme; a negative amount takes some back. */
export function addUsageCredit(driverUuid: UUID, payload: AddUsageCreditPayload): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${seg(driverUuid)}/usage-credit`, {
    method: 'POST',
    json: payload,
  });
}

/** The only route out of `DISABLED`. */
export function changeDriverStatus(
  driverUuid: UUID,
  payload: ChangeDriverStatusPayload,
): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${seg(driverUuid)}/status`, {
    method: 'PATCH',
    json: payload,
  });
}

export function assignVehicle(driverUuid: UUID, payload: AssignVehiclePayload): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${seg(driverUuid)}/vehicle`, {
    method: 'PATCH',
    json: payload,
  });
}

/** Soft delete: disables the driver, preserving their metrics (spec §10.4). */
export function deleteDriver(driverUuid: UUID, reason?: string): Promise<void> {
  return request<void>(`/admin/drivers/${seg(driverUuid)}`, {
    method: 'DELETE',
    query: { reason },
  });
}

// --- vehicles ------------------------------------------------------------

export function getVehicle(vehicleUuid: UUID): Promise<Vehicle> {
  return request<Vehicle>(`/admin/vehicles/${seg(vehicleUuid)}`);
}

export function createVehicle(payload: CreateVehiclePayload): Promise<Vehicle> {
  return request<Vehicle>('/admin/vehicles', { method: 'POST', json: payload });
}

/** Send dirty fields only — an explicit `null` **clears** the field here. */
export function updateVehicle(vehicleUuid: UUID, payload: UpdateVehiclePayload): Promise<Vehicle> {
  return request<Vehicle>(`/admin/vehicles/${seg(vehicleUuid)}`, {
    method: 'PATCH',
    json: payload,
  });
}

export function changeVehicleStatus(
  vehicleUuid: UUID,
  payload: ChangeVehicleStatusPayload,
): Promise<Vehicle> {
  return request<Vehicle>(`/admin/vehicles/${seg(vehicleUuid)}/status`, {
    method: 'PATCH',
    json: payload,
  });
}

/** Issues — or rotates — the key the driver's phone reports GPS with. Shown once. */
export function issueDriverPhoneKey(driverUuid: UUID): Promise<PhoneKey> {
  return request<PhoneKey>(`/admin/drivers/${seg(driverUuid)}/phone-key`, { method: 'POST' });
}

export function revokeDriverPhoneKey(driverUuid: UUID): Promise<null> {
  return request<null>(`/admin/drivers/${seg(driverUuid)}/phone-key`, { method: 'DELETE' });
}

/** The driver's own trace set beside their unit's, to spot a gap between them. */
export function getDriverPositionCheck(
  driverUuid: UUID,
  windowHours = 24,
): Promise<DriverPositionCheck> {
  return request<DriverPositionCheck>(`/admin/drivers/${seg(driverUuid)}/position-check`, {
    query: { window_hours: windowHours },
  });
}

export function listSettings(): Promise<RuntimeSetting[]> {
  return request<RuntimeSetting[]>('/admin/settings');
}

export function updateSetting(key: string, value: number): Promise<RuntimeSetting> {
  return request<RuntimeSetting>(`/admin/settings/${seg(key)}`, { method: 'PUT', json: { value } });
}

/**
 * Drops the caller's own value (the tenant's, or the platform default for a
 * superadmin with no tenant) so it falls back to what it inherits.
 */
export function resetSetting(key: string): Promise<RuntimeSetting> {
  return request<RuntimeSetting>(`/admin/settings/${seg(key)}`, { method: 'DELETE' });
}

// --- vehicle types ----------------------------------------------------------

/** Global types first, then the caller's own. */
export function listVehicleTypes(activeOnly = false): Promise<VehicleType[]> {
  return request<VehicleType[]>('/admin/vehicle-types', {
    query: { active_only: activeOnly || undefined },
  });
}

export function createVehicleType(payload: CreateVehicleTypePayload): Promise<VehicleType> {
  return request<VehicleType>('/admin/vehicle-types', { method: 'POST', json: payload });
}

/** Schema edits are additive-only once vehicles use the type; the server answers 4xx otherwise. */
export function updateVehicleType(
  vehicleTypeUuid: UUID,
  payload: UpdateVehicleTypePayload,
): Promise<VehicleType> {
  return request<VehicleType>(`/admin/vehicle-types/${seg(vehicleTypeUuid)}`, {
    method: 'PATCH',
    json: payload,
  });
}

// --- tenants (superadmin lists and provisions; a tenant admin reaches their own) ---

export function listTenants(params: PaginationParams = {}): Promise<Paginated<Tenant>> {
  return request<Paginated<Tenant>>('/admin/tenants', { query: { ...params } });
}

export function getTenant(tenantId: UUID): Promise<Tenant> {
  return request<Tenant>(`/admin/tenants/${seg(tenantId)}`);
}

export function createTenant(payload: CreateTenantPayload): Promise<Tenant> {
  return request<Tenant>('/admin/tenants', { method: 'POST', json: payload });
}

export function updateTenant(tenantId: UUID, payload: UpdateTenantPayload): Promise<Tenant> {
  return request<Tenant>(`/admin/tenants/${seg(tenantId)}`, { method: 'PATCH', json: payload });
}

/** Superadmin-only. Deactivating blocks login and webhook processing tenant-wide. */
export function setTenantActive(tenantId: UUID, active: boolean): Promise<Tenant> {
  return request<Tenant>(
    `/admin/tenants/${seg(tenantId)}/${seg(active ? 'activate' : 'deactivate')}`,
    {
      method: 'POST',
    },
  );
}

// --- cities ---------------------------------------------------------------

export function listCities(
  tenantId: UUID,
  params: PaginationParams = {},
): Promise<Paginated<City>> {
  return request<Paginated<City>>(`/admin/tenants/${seg(tenantId)}/cities`, {
    query: { ...params },
  });
}

export function createCity(tenantId: UUID, payload: CreateCityPayload): Promise<City> {
  return request<City>(`/admin/tenants/${seg(tenantId)}/cities`, { method: 'POST', json: payload });
}

export function getCity(cityId: UUID): Promise<City> {
  return request<City>(`/admin/cities/${seg(cityId)}`);
}

export function updateCity(cityId: UUID, payload: UpdateCityPayload): Promise<City> {
  return request<City>(`/admin/cities/${seg(cityId)}`, { method: 'PATCH', json: payload });
}

export function setCityActive(cityId: UUID, active: boolean): Promise<City> {
  return request<City>(`/admin/cities/${seg(cityId)}/${seg(active ? 'activate' : 'deactivate')}`, {
    method: 'POST',
  });
}

export function listCityAccess(cityId: UUID): Promise<UserCityAccess[]> {
  return request<UserCityAccess[]>(`/admin/cities/${seg(cityId)}/access`);
}

export function grantCityAccess(
  cityId: UUID,
  payload: GrantCityAccessPayload,
): Promise<UserCityAccess> {
  return request<UserCityAccess>(`/admin/cities/${seg(cityId)}/access`, {
    method: 'POST',
    json: payload,
  });
}

export function revokeCityAccess(cityId: UUID, userId: UUID): Promise<void> {
  return request<void>(`/admin/cities/${seg(cityId)}/access/${seg(userId)}`, { method: 'DELETE' });
}

/** A driver leaves their vehicle when they change city; the server refuses it while in a trip. */
export function moveDriverToCity(driverUuid: UUID, payload: MoveToCityPayload): Promise<Driver> {
  return request<Driver>(`/admin/drivers/${seg(driverUuid)}/city`, {
    method: 'PATCH',
    json: payload,
  });
}

export function moveVehicleToCity(vehicleUuid: UUID, payload: MoveToCityPayload): Promise<Vehicle> {
  return request<Vehicle>(`/admin/vehicles/${seg(vehicleUuid)}/city`, {
    method: 'PATCH',
    json: payload,
  });
}

// --- WhatsApp number (superadmin) -------------------------------------------

/** Every tenant's number — just one when acting as a tenant. */
export function listWhatsAppConfigs(): Promise<WhatsAppConfig[]> {
  return request<WhatsAppConfig[]>('/admin/whatsapp-config');
}

/** The acted-as tenant's number. 404 until one is configured. */
export function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  return request<WhatsAppConfig>('/admin/whatsapp-config/current');
}

/** Create or replace the acted-as tenant's number. Omit the token to keep the stored one. */
export function setWhatsAppConfig(payload: SetWhatsAppConfigPayload): Promise<WhatsAppConfig> {
  return request<WhatsAppConfig>('/admin/whatsapp-config', { method: 'PUT', json: payload });
}

export function deleteWhatsAppConfig(): Promise<void> {
  return request<void>('/admin/whatsapp-config', { method: 'DELETE' });
}

// --- platform operations ------------------------------------------------------

export function getUsage(params: { since?: string; until?: string } = {}): Promise<TenantUsage[]> {
  return request<TenantUsage[]>('/admin/usage', { query: { ...params } });
}

export function listAuditLogs(params: AuditLogParams = {}): Promise<Paginated<AuditEntry>> {
  return request<Paginated<AuditEntry>>('/admin/audit-logs', { query: { ...params } });
}

export function getKpisByTenant(hours?: number): Promise<TripKpiGroup[]> {
  return request<TripKpiGroup[]>('/admin/kpis/by-tenant', { query: { hours } });
}

export function getKpisByVehicleType(hours?: number): Promise<TripKpiGroup[]> {
  return request<TripKpiGroup[]>('/admin/kpis/by-vehicle-type', {
    query: { hours },
  });
}
