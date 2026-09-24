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
  mototaxis: 15_000,
  drivers: 30_000,
  dashboard: 60_000,
} as const;

export const queryKeys = {
  profile: ['profile'] as const,
  kpis: ['kpis'] as const,
  alerts: ['alerts'] as const,
  mototaxis: ['mototaxis'] as const,
  mototaxi: (uuid: UUID) => ['mototaxi', uuid] as const,
  drivers: (status?: DriverStatus) => ['drivers', status ?? 'all'] as const,
  driver: (uuid: UUID) => ['driver', uuid] as const,
  activeTrips: ['trips', 'active'] as const,
  tripHistory: (params: TripHistoryParams) => ['trips', 'history', params] as const,
  settings: ['settings'] as const,
  customers: (includeBlocked: boolean) => ['customers', includeBlocked] as const,
};
