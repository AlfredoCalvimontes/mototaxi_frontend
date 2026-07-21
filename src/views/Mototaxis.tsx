import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listDrivers, listMototaxis } from '@/api/admin';
import { POLL, queryKeys } from '@/api/queries';
import type { MototaxiSummary } from '@/api/types';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge, WarningBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';
import { EMPTY, formatCoords, formatRelative } from '@/lib/format';
import { strings } from '@/lib/strings';
import { MototaxiEditLoader } from '@/views/fleet/MototaxiEditLoader';
import { MototaxiForm } from '@/views/fleet/MototaxiForm';
import { MototaxiStatusDialog } from '@/views/fleet/MototaxiStatusDialog';

// Leaflet and its CSS are the heaviest thing in the bundle and only one view
// needs them, so the map loads on demand.
const FleetMap = lazy(() =>
  import('@/components/FleetMap').then((module) => ({ default: module.FleetMap })),
);

/** Set by the dashboard's stale-tracker alert. */
const STALE_PARAM = 'gps';
const STALE_VALUE = 'sin-senal';

type MototaxiDialog =
  | { kind: 'create' }
  | { kind: 'edit'; uuid: string }
  | { kind: 'status'; mototaxi: MototaxiSummary };

export default function Mototaxis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyStale = searchParams.get(STALE_PARAM) === STALE_VALUE;
  const [dialog, setDialog] = useState<MototaxiDialog | null>(null);

  const mototaxis = useQuery({
    queryKey: queryKeys.mototaxis,
    queryFn: listMototaxis,
    refetchInterval: POLL.mototaxis,
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

  const rows = useMemo(() => {
    const all = mototaxis.data ?? [];
    return onlyStale ? all.filter((unit) => unit.is_tracker_stale) : all;
  }, [mototaxis.data, onlyStale]);

  const columns: Column<MototaxiSummary>[] = useMemo(
    () => [
      {
        id: 'plate',
        header: strings.mototaxis.plate,
        sortValue: (unit) => unit.plate_number,
        cell: (unit) => <span className="font-medium text-slate-900">{unit.plate_number}</span>,
      },
      {
        id: 'status',
        header: strings.mototaxis.status,
        sortValue: (unit) => unit.status,
        cell: (unit) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge kind="mototaxi" value={unit.status} />
            {unit.is_tracker_stale && (
              <WarningBadge title={strings.mototaxis.staleHint}>
                {strings.mototaxis.staleTracker}
              </WarningBadge>
            )}
          </div>
        ),
      },
      {
        id: 'driver',
        header: strings.mototaxis.driver,
        sortValue: (unit) =>
          unit.current_driver_uuid ? (driverNames.get(unit.current_driver_uuid) ?? '') : null,
        cell: (unit) =>
          unit.current_driver_uuid ? (driverNames.get(unit.current_driver_uuid) ?? EMPTY) : EMPTY,
      },
      {
        id: 'position',
        header: strings.mototaxis.position,
        secondary: true,
        sortValue: (unit) => formatCoords(unit.lat, unit.lon),
        cell: (unit) => (
          <span className="text-xs text-slate-600">{formatCoords(unit.lat, unit.lon)}</span>
        ),
      },
      {
        id: 'lastUpdate',
        header: strings.mototaxis.lastUpdate,
        // Sorting by the raw timestamp, not by the rendered "hace 3 min".
        sortValue: (unit) => unit.location_updated_at ?? null,
        cell: (unit) =>
          unit.location_updated_at
            ? formatRelative(unit.location_updated_at)
            : strings.mototaxis.noPosition,
      },
      {
        id: 'actions',
        header: '',
        cell: (unit) => (
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() => setDialog({ kind: 'edit', uuid: unit.mototaxi_uuid })}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
            >
              {strings.common.edit}
            </button>
            <button
              type="button"
              onClick={() => setDialog({ kind: 'status', mototaxi: unit })}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
            >
              {strings.fleet.vehicleStatus}
            </button>
          </div>
        ),
      },
    ],
    [driverNames],
  );

  if (mototaxis.isPending) return <TableSkeleton rows={5} />;
  if (mototaxis.isError) {
    return <ErrorState error={mototaxis.error} onRetry={() => void mototaxis.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{strings.mototaxis.heading}</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'create' })}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {strings.fleet.newMototaxi}
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyStale}
            onChange={(e) =>
              // Kept in the URL so the dashboard alert can link straight here.
              setSearchParams(e.target.checked ? { [STALE_PARAM]: STALE_VALUE } : {}, {
                replace: true,
              })
            }
            className="rounded border-slate-300"
          />
          {strings.mototaxis.staleTracker}
        </label>
      </div>

      <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-slate-100" />}>
        <FleetMap units={rows} />
      </Suspense>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(unit) => unit.mototaxi_uuid}
        caption={strings.mototaxis.heading}
        searchPlaceholder={strings.common.search}
        initialSort={{ columnId: 'plate', direction: 'asc' }}
        rowClassName={(unit) => (unit.is_tracker_stale ? 'bg-amber-50/60' : 'hover:bg-slate-50')}
      />

      {dialog?.kind === 'create' && (
        <MototaxiForm mototaxi={null} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'edit' && (
        <MototaxiEditLoader uuid={dialog.uuid} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'status' && (
        <MototaxiStatusDialog mototaxi={dialog.mototaxi} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
