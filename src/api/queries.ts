/**
 * Query keys and poll intervals in one place (plan §4).
 *
 * Polling is paused while the tab is hidden — ten motorcycles do not justify a
 * background tab issuing requests all night.
 */

import type { DriverStatus, UUID } from '@/api/types';
import type { TripHistoryParams } from '@/api/admin';

export const POLL = {
  activeTrips: 10_000,
  vehicles: 15_000,
  drivers: 30_000,
  dashboard: 60_000,
} as const;

export const queryKeys = {
  profile: ['profile'] as const,
  kpis: ['kpis'] as const,
  alerts: ['alerts'] as const,
  /** Prefix of every vehicle list: invalidate with this. */
  vehicles: ['vehicles'] as const,
  vehiclesIn: (city: UUID | null) => ['vehicles', city ?? 'all'] as const,
  vehicle: (uuid: UUID) => ['vehicle', uuid] as const,
  vehicleTypes: ['vehicle-types'] as const,
  usagePlans: ['usage-plans'] as const,
  usagePlan: (uuid: UUID) => ['usage-plans', uuid] as const,
  drivers: (status?: DriverStatus, city: UUID | null = null) =>
    ['drivers', status ?? 'all', city ?? 'all'] as const,
  driver: (uuid: UUID) => ['driver', uuid] as const,
  positionCheck: (uuid: UUID) => ['position-check', uuid] as const,
  activeTrips: ['trips', 'active'] as const,
  activeTripsIn: (city: UUID | null) => ['trips', 'active', city ?? 'all'] as const,
  tripHistory: (params: TripHistoryParams) => ['trips', 'history', params] as const,
  /** Prefix of every credit ledger query: invalidate with this after a change. */
  creditLedger: ['credit-ledger'] as const,
  creditLedgerDriver: (driver: UUID, filters: object) =>
    ['credit-ledger', 'driver', driver, filters] as const,
  creditLedgerTenant: (filters: object) => ['credit-ledger', 'tenant', filters] as const,
  settings: ['settings'] as const,
  customers: (includeBlocked: boolean, city: UUID | null = null) =>
    ['customers', includeBlocked, city ?? 'all'] as const,
};
