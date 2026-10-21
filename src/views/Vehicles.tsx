import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listDrivers, listVehicles } from '@/api/admin';
import { POLL, queryKeys } from '@/api/queries';
import type { VehicleSummary } from '@/api/types';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge, ToneBadge, WarningBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';
import { EMPTY, formatCoords, formatDate, formatRelative, vehicleLabel } from '@/lib/format';
import { usePersistentFlag } from '@/lib/persistentFlag';
import { simRechargeState } from '@/lib/sim';
import { filterParams, useCityScope } from '@/lib/cityScope';
import { useCities } from '@/lib/useCities';
import { strings } from '@/lib/strings';
import { MoveToCityDialog } from '@/views/fleet/MoveToCityDialog';
import { VehicleEditLoader } from '@/views/fleet/VehicleEditLoader';
import { VehicleForm } from '@/views/fleet/VehicleForm';
import { VehicleStatusDialog } from '@/views/fleet/VehicleStatusDialog';

// Leaflet and its CSS are the heaviest thing in the bundle and only one view
// needs them, so the map loads on demand.
const FleetMap = lazy(() =>
  import('@/components/FleetMap').then((module) => ({ default: module.FleetMap })),
);

/** Set by the dashboard's stale-tracker alert. */
const STALE_PARAM = 'gps';
const STALE_VALUE = 'sin-senal';
/** Set by the dashboard's SIM-credit alert. */
const SIM_PARAM = 'sim';
const SIM_VALUE = 'vencida';

type VehicleDialog =
  | { kind: 'create' }
  | { kind: 'edit'; uuid: string }
  | { kind: 'status'; vehicle: VehicleSummary }
  | { kind: 'city'; vehicle: VehicleSummary };

/** The SIM columns, hidden together by one toggle. */
const SIM_COLUMN_IDS = new Set(['simLastRecharge', 'simAmount', 'simNext']);
const HIDE_SIM_KEY = 'mototaxi.hideSimColumns';

const SIM_TEXT = {
  ok: '',
  soon: 'font-medium text-amber-700',
  urgent: 'font-semibold text-red-700',
  overdue: 'font-semibold text-red-700',
} as const;

const SIM_BADGES = {
  ok: { tone: 'good' },
  soon: { tone: 'warn' },
  urgent: { tone: 'bad' },
  overdue: { tone: 'bad' },
} as const;

/** The next top-up date, coloured as it nears: yellow within a week, red within three days. */
function SimNextRecharge({ unit }: { unit: VehicleSummary }) {
  if (!unit.has_tracker || !unit.sim_next_recharge_at) return null;
  const { state, daysLeft } = simRechargeState(unit.sim_next_recharge_at);
  if (state === 'none' || daysLeft === null) return null;
  const label =
    state === 'overdue'
      ? strings.vehicles.simOverdue(-daysLeft)
      : state === 'urgent'
        ? strings.vehicles.simUrgent(daysLeft)
        : state === 'soon'
          ? strings.vehicles.simSoon(daysLeft)
          : strings.vehicles.simOk(daysLeft);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`tabular-nums ${SIM_TEXT[state]}`}>
        {formatDate(unit.sim_next_recharge_at)}
      </span>
      <ToneBadge tone={SIM_BADGES[state].tone} title={strings.vehicles.simHint}>
        {label}
      </ToneBadge>
    </div>
  );
}

export default function Vehicles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyStale = searchParams.get(STALE_PARAM) === STALE_VALUE;
  const onlyNoSimCredit = searchParams.get(SIM_PARAM) === SIM_VALUE;
  const [dialog, setDialog] = useState<VehicleDialog | null>(null);
  const cityScope = useCityScope();
  const { cities } = useCities();
  const [hideSim, toggleHideSim] = usePersistentFlag(HIDE_SIM_KEY, false);

  const vehicles = useQuery({
    queryKey: queryKeys.vehicles,
    queryFn: listVehicles,
    refetchInterval: POLL.vehicles,
  });

  // The summary carries a driver uuid, not a name; the drivers list is already
  // polled elsewhere, so this resolves names without a per-row request.
  const drivers = useQuery({
    queryKey: queryKeys.drivers(),
    queryFn: () => listDrivers(),
    refetchInterval: POLL.drivers,
  });

  const driverNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const driver of drivers.data ?? []) map.set(driver.driver_uuid, driver.name);
    return map;
  }, [drivers.data]);

  const driverNameOf = (unit: VehicleSummary) =>
    unit.current_driver_uuid ? (driverNames.get(unit.current_driver_uuid) ?? null) : null;

  const hasCities = cities.length > 0;
  // The vehicle list carries no city, so the selection can only scope the
  // perimeters drawn on the map, not the rows.
  const geofences = cities
    .filter((c) => c.is_active && c.geofence_geojson && (!cityScope || c.city_id === cityScope))
    .map((c) => c.geofence_geojson!);

  const rows = useMemo(() => {
    const all = vehicles.data ?? [];
    return all.filter(
      (unit) =>
        (!onlyStale || unit.is_tracker_stale) &&
        (!onlyNoSimCredit ||
          (unit.has_tracker && simRechargeState(unit.sim_next_recharge_at).state === 'overdue')),
    );
  }, [vehicles.data, onlyStale, onlyNoSimCredit]);

  const columns: Column<VehicleSummary>[] = useMemo(
    () => [
      {
        id: 'plate',
        header: strings.vehicles.plate,
        sortValue: (unit) => unit.plate_number,
        searchValue: (unit) => `${unit.alias ?? ''} ${unit.plate_number}`,
        cell: (unit) => (
          <div className="leading-tight">
            {unit.alias && <div className="font-semibold text-slate-900">{unit.alias}</div>}
            <span className={unit.alias ? 'text-xs text-slate-500' : 'font-medium text-slate-900'}>
              {unit.plate_number}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        header: strings.vehicles.status,
        sortValue: (unit) => unit.status,
        cell: (unit) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge kind="vehicle" value={unit.status} />
            {unit.is_tracker_stale && (
              <WarningBadge title={strings.vehicles.staleHint}>
                {strings.vehicles.staleTracker}
              </WarningBadge>
            )}
          </div>
        ),
      },
      {
        id: 'driver',
        header: strings.vehicles.driver,
        sortValue: (unit) =>
          unit.current_driver_uuid ? (driverNames.get(unit.current_driver_uuid) ?? '') : null,
        cell: (unit) =>
          unit.current_driver_uuid ? (driverNames.get(unit.current_driver_uuid) ?? EMPTY) : EMPTY,
      },
      {
        id: 'position',
        header: strings.vehicles.position,
        secondary: true,
        sortValue: (unit) => formatCoords(unit.lat, unit.lon),
        cell: (unit) => (
          <span className="text-xs text-slate-600">{formatCoords(unit.lat, unit.lon)}</span>
        ),
      },
      {
        id: 'lastUpdate',
        header: strings.vehicles.lastUpdate,
        // Sorting by the raw timestamp, not by the rendered "hace 3 min".
        sortValue: (unit) => unit.location_updated_at ?? null,
        cell: (unit) =>
          unit.location_updated_at ? (
            <div className="flex flex-col">
              <span>{formatRelative(unit.location_updated_at)}</span>
              {unit.location_source && (
                <span className="text-xs text-slate-500">
                  {strings.drivers.sources[unit.location_source] ?? unit.location_source}
                </span>
              )}
            </div>
          ) : (
            strings.vehicles.noPosition
          ),
      },
      {
        id: 'simLastRecharge',
        header: strings.vehicles.simLastRecharge,
        secondary: true,
        sortValue: (unit) => unit.sim_last_recharge_at ?? null,
        // Empty — not a dash — when there is no tracker, so no SIM: it does not apply.
        cell: (unit) => (unit.has_tracker ? formatDate(unit.sim_last_recharge_at) : ''),
      },
      {
        id: 'simAmount',
        header: strings.vehicles.simAmount,
        align: 'right',
        secondary: true,
        sortValue: (unit) => unit.sim_last_recharge_amount ?? null,
        cell: (unit) =>
          unit.has_tracker && unit.sim_last_recharge_amount !== null
            ? unit.sim_last_recharge_amount
            : '',
      },
      {
        id: 'simNext',
        header: strings.vehicles.simNextRecharge,
        secondary: true,
        sortValue: (unit) => unit.sim_next_recharge_at ?? null,
        cell: (unit) => <SimNextRecharge unit={unit} />,
      },
      {
        id: 'actions',
        header: '',
        cell: (unit) => (
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() => setDialog({ kind: 'edit', uuid: unit.vehicle_uuid })}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
            >
              {strings.common.edit}
            </button>
            {hasCities && (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'city', vehicle: unit })}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
              >
                {strings.tenancy.moveToCity}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialog({ kind: 'status', vehicle: unit })}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
            >
              {strings.fleet.vehicleStatus}
              <StatusBadge kind="vehicle" value={unit.status} />
            </button>
          </div>
        ),
      },
    ],
    [driverNames, hasCities],
  );

  if (vehicles.isPending) return <TableSkeleton rows={5} />;
  if (vehicles.isError) {
    return <ErrorState error={vehicles.error} onRetry={() => void vehicles.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{strings.vehicles.heading}</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'create' })}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {strings.fleet.newVehicle}
        </button>
        <button
          type="button"
          onClick={toggleHideSim}
          aria-pressed={hideSim}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {hideSim ? strings.vehicles.showSim : strings.vehicles.hideSim}
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyStale}
            onChange={(e) =>
              // Kept in the URL so the dashboard alert can link straight here.
              setSearchParams(
                filterParams(searchParams, STALE_PARAM, e.target.checked ? STALE_VALUE : null),
                {
                  replace: true,
                },
              )
            }
            className="rounded border-slate-300"
          />
          {strings.vehicles.staleTracker}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyNoSimCredit}
            onChange={(e) =>
              setSearchParams(
                filterParams(searchParams, SIM_PARAM, e.target.checked ? SIM_VALUE : null),
                {
                  replace: true,
                },
              )
            }
            className="rounded border-slate-300"
          />
          {strings.vehicles.noSimCredit}
        </label>
      </div>

      <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-slate-100" />}>
        <FleetMap units={rows} geofences={geofences} />
      </Suspense>

      <DataTable
        rows={rows}
        columns={hideSim ? columns.filter((column) => !SIM_COLUMN_IDS.has(column.id)) : columns}
        rowKey={(unit) => unit.vehicle_uuid}
        caption={strings.vehicles.heading}
        searchPlaceholder={strings.common.search}
        initialSort={{ columnId: 'plate', direction: 'asc' }}
        rowClassName={(unit) => (unit.is_tracker_stale ? 'bg-amber-50/60' : 'hover:bg-slate-50')}
      />

      {dialog?.kind === 'create' && <VehicleForm vehicle={null} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && (
        <VehicleEditLoader uuid={dialog.uuid} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'city' && (
        <MoveToCityDialog
          kind="vehicle"
          uuid={dialog.vehicle.vehicle_uuid}
          label={vehicleLabel(dialog.vehicle)}
          currentCityUuid={null}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'status' && (
        <VehicleStatusDialog
          vehicle={dialog.vehicle}
          driverName={driverNameOf(dialog.vehicle)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
