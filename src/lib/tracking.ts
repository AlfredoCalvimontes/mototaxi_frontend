import type { MototaxiSummary } from '@/api/types';

/**
 * How a driver is being located right now, from their assigned moto.
 *
 * - `tracker`: a GPS tracker is fitted and reporting.
 * - `trackerStale`: a tracker is fitted but silent (and nothing else is covering).
 * - `phone`: the driver's phone is reporting — the tracker is absent or silent.
 * - `shared`: the driver shared a fresh WhatsApp location.
 * - `needsShare`: no tracker and no fresh position — the driver must share one.
 * - `noMototaxi`: nothing assigned, so nothing to locate.
 */
export type TrackingState =
  'noMototaxi' | 'tracker' | 'trackerStale' | 'phone' | 'shared' | 'needsShare';

export function trackingState(unit: MototaxiSummary | undefined): TrackingState {
  if (!unit) return 'noMototaxi';
  const hasFreshPosition = unit.location_updated_at !== null && !unit.is_tracker_stale;
  if (!hasFreshPosition) return unit.has_tracker ? 'trackerStale' : 'needsShare';
  // The unit's position is whichever source is best and live: a phone or a
  // shared point can be covering for a silent tracker, or be the only source.
  if (unit.location_source === 'PHONE') return 'phone';
  if (unit.location_source === 'WHATSAPP' || unit.location_source === 'GOOGLE_MAPS') {
    return 'shared';
  }
  return unit.has_tracker ? 'tracker' : 'shared';
}
