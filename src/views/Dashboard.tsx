import { useQuery } from '@tanstack/react-query';

import { getAlerts, getKpis } from '@/api/admin';
import { POLL, queryKeys } from '@/api/queries';
import { AlertBanner } from '@/components/AlertBanner';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/KpiCard';
import { CardSkeleton } from '@/components/Skeleton';
import { EMPTY, formatDuration, formatRating } from '@/lib/format';
import { strings } from '@/lib/strings';

export default function Dashboard() {
  const kpis = useQuery({
    queryKey: queryKeys.kpis,
    queryFn: getKpis,
    refetchInterval: POLL.dashboard,
  });
  const alerts = useQuery({
    queryKey: queryKeys.alerts,
    queryFn: getAlerts,
    refetchInterval: POLL.dashboard,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{strings.dashboard.heading}</h1>

      {alerts.isPending ? (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
      ) : alerts.isError ? (
        <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
      ) : (
        <AlertBanner alerts={alerts.data} />
      )}

      {kpis.isPending ? (
        <CardSkeleton count={8} />
      ) : kpis.isError ? (
        <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label={strings.dashboard.tripsToday} value={kpis.data.trips_today} />
          <KpiCard label={strings.dashboard.completed} value={kpis.data.trips_completed_today} />
          <KpiCard
            label={strings.dashboard.cancelled}
            value={kpis.data.trips_cancelled_today}
            tone={kpis.data.trips_cancelled_today > 0 ? 'warn' : 'default'}
          />
          <KpiCard
            label={strings.dashboard.noDriver}
            value={kpis.data.trips_no_driver_today}
            // Demand that went unserved: the number the owner acts on.
            tone={kpis.data.trips_no_driver_today > 0 ? 'bad' : 'default'}
          />
          <KpiCard
            label={strings.dashboard.averageReach}
            value={formatDuration(kpis.data.average_reach_time_seconds)}
          />
          <KpiCard
            label={strings.dashboard.averageRating}
            value={formatRating(kpis.data.average_rating)}
          />
          <KpiCard
            label={strings.dashboard.driversAvailable}
            value={kpis.data.drivers_available}
            tone={kpis.data.drivers_available === 0 ? 'bad' : 'default'}
          />
          <KpiCard
            label={strings.drivers.noCheckinBadge}
            value={kpis.data.drivers_without_checkin || EMPTY}
            hint={kpis.data.drivers_without_checkin > 0 ? strings.drivers.noCheckinHint : undefined}
            tone={kpis.data.drivers_without_checkin > 0 ? 'warn' : 'default'}
          />
        </div>
      )}
    </div>
  );
}
