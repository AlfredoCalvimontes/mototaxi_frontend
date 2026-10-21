import { useQuery } from '@tanstack/react-query';

import {
  getAlerts,
  getKpis,
  getKpisByVehicleType,
  getUsage,
  listDrivers,
  listVehicleTypes,
  listVehicles,
} from '@/api/admin';
import { POLL, queryKeys } from '@/api/queries';
import { useAuth } from '@/auth/context';
import { AlertBanner, type PanelAlerts } from '@/components/AlertBanner';
import { ErrorState } from '@/components/ErrorState';
import { KpiCard } from '@/components/KpiCard';
import { CardSkeleton } from '@/components/Skeleton';
import { DataTable, type Column } from '@/components/DataTable';
import type { TripKpiGroup } from '@/api/types';
import { EMPTY, formatDuration, formatRating } from '@/lib/format';
import { simRechargeState } from '@/lib/sim';
import { strings } from '@/lib/strings';

/** Today's demand split by the vehicle type the customer asked for. */
function ByVehicleType() {
  const groups = useQuery({
    queryKey: ['kpis', 'by-vehicle-type'],
    queryFn: () => getKpisByVehicleType(24),
    refetchInterval: POLL.dashboard,
  });
  const types = useQuery({ queryKey: queryKeys.vehicleTypes, queryFn: () => listVehicleTypes() });

  // A split of one row says nothing; show it once there is something to compare.
  if (!groups.data || groups.data.length < 2) return null;

  const names = new Map((types.data ?? []).map((x) => [x.vehicle_type_uuid, x.display_name]));
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? id) : strings.dashboard.byTypeAny);

  const columns: Column<TripKpiGroup>[] = [
    {
      id: 'type',
      header: strings.dashboard.byTypeType,
      sortValue: (g) => nameOf(g.group_uuid),
      cell: (g) => <span className="font-medium text-slate-900">{nameOf(g.group_uuid)}</span>,
    },
    {
      id: 'trips',
      header: strings.platform.trips,
      align: 'right',
      sortValue: (g) => g.trips,
      cell: (g) => g.trips,
    },
    {
      id: 'completed',
      header: strings.platform.completed,
      align: 'right',
      cell: (g) => g.completed,
    },
    {
      id: 'cancelled',
      header: strings.platform.cancelled,
      align: 'right',
      cell: (g) => g.cancelled,
    },
    { id: 'noDriver', header: strings.platform.noDriver, align: 'right', cell: (g) => g.no_driver },
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-slate-900">{strings.dashboard.byTypeHeading}</h2>
      <DataTable
        rows={groups.data}
        columns={columns}
        rowKey={(g) => g.group_uuid ?? 'any'}
        caption={strings.dashboard.byTypeHeading}
        initialSort={{ columnId: 'trips', direction: 'desc' }}
      />
    </section>
  );
}

/** The company's own numbers for the last 30 days; the server returns only its row. */
function OwnUsage({ tenantId }: { tenantId: string }) {
  const usage = useQuery({ queryKey: ['usage', 'own', tenantId], queryFn: () => getUsage() });
  const mine = usage.data?.find((row) => row.tenant_uuid === tenantId);
  if (!mine) return null;

  const t = strings.dashboard;
  return (
    <section aria-label={t.usageHeading} className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-900">{t.usageHeading}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label={t.usageDrivers} value={mine.active_drivers} />
        <KpiCard label={t.usageVehicles} value={mine.vehicles} />
        <KpiCard label={t.usageTrips} value={mine.trips} />
        <KpiCard label={t.usageInbound} value={mine.inbound_messages} />
        <KpiCard label={t.usageOutbound} value={mine.outbound_messages} />
      </div>
      <p className="text-xs text-slate-500">{t.usageHint}</p>
    </section>
  );
}

export default function Dashboard() {
  const { user, actingAsTenant } = useAuth();
  const ownTenant = user?.tenant_id ?? actingAsTenant;
  const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'TENANT_ADMIN';
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

  // Already polled by the fleet views; here they only feed the credit alerts.
  const vehicles = useQuery({
    queryKey: queryKeys.vehiclesIn(null),
    queryFn: () => listVehicles(),
    refetchInterval: POLL.vehicles,
  });
  const drivers = useQuery({
    queryKey: queryKeys.drivers(),
    queryFn: () => listDrivers(),
    refetchInterval: POLL.drivers,
  });

  const panelAlerts: PanelAlerts | null = alerts.data
    ? {
        ...alerts.data,
        trackers_without_credit: (vehicles.data ?? []).filter(
          (unit) =>
            unit.has_tracker && simRechargeState(unit.sim_next_recharge_at).state === 'overdue',
        ).length,
        drivers_without_credit: (drivers.data ?? []).filter((driver) => driver.usage_credit_expired)
          .length,
      }
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{strings.dashboard.heading}</h1>

      {alerts.isPending ? (
        <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
      ) : alerts.isError ? (
        <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
      ) : (
        <AlertBanner alerts={panelAlerts ?? alerts.data} />
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
      {isAdmin && <ByVehicleType />}
      {isAdmin && ownTenant && <OwnUsage tenantId={ownTenant} />}
    </div>
  );
}
