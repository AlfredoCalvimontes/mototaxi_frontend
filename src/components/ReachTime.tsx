import type { TripSummary } from '@/api/types';
import { EMPTY, formatDuration } from '@/lib/format';
import { strings } from '@/lib/strings';

/**
 * A `STRAIGHT_LINE` reach time came from the fallback, not from routing
 * (spec §6.4), so it is marked as an approximation. Presenting both sources
 * identically would let an operator quote a straight-line guess as an ETA.
 */
export function ReachTime({ trip }: { trip: TripSummary }) {
  if (trip.reach_time_seconds === null) return <span>{EMPTY}</span>;

  const estimated = trip.reach_time_source === 'STRAIGHT_LINE';
  return (
    <span className="whitespace-nowrap">
      {formatDuration(trip.reach_time_seconds)}
      {estimated && (
        <span
          title={strings.trips.estimatedHint}
          className="ml-1 text-xs text-amber-700 underline decoration-dotted"
        >
          ({strings.trips.estimated})
        </span>
      )}
    </span>
  );
}
