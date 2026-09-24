import type { MototaxiSummary } from '@/api/types';

/**
 * How a driver is being located right now, from their assigned moto.
 *
 * - `tracker`: a GPS tracker is fitted and reporting.
 * - `trackerStale`: a tracker is fitted but silent.
 * - `shared`: no tracker, but the driver shared a fresh WhatsApp location.
 * - `needsShare`: no tracker and no fresh position — the driver must share one.
 * - `noMototaxi`: nothing assigned, so nothing to locate.
 */
export type TrackingState = 'noMototaxi' | 'tracker' | 'trackerStale' | 'shared' | 'needsShare';

export function trackingState(unit: MototaxiSummary | undefined): TrackingState {
  if (!unit) return 'noMototaxi';
  if (unit.has_tracker) return unit.is_tracker_stale ? 'trackerStale' : 'tracker';
  const hasFreshPosition = unit.location_updated_at !== null && !unit.is_tracker_stale;
  return hasFreshPosition ? 'shared' : 'needsShare';
}
