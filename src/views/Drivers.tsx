import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { deleteDriver, listDrivers, listMototaxis } from '@/api/admin';
import { POLL, queryKeys } from '@/api/queries';
import type { Driver, MototaxiSummary } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { MaskedValue } from '@/components/MaskedValue';
import { StatusBadge, ToneBadge, WarningBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';
import { AssignMototaxiDialog } from '@/views/fleet/AssignMototaxiDialog';
import { DriverForm } from '@/views/fleet/DriverForm';
import { DriverStatusDialog } from '@/views/fleet/DriverStatusDialog';
import {
  EMPTY,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelative,
  maskCi,
  maskPhone,
} from '@/lib/format';
import { strings } from '@/lib/strings';
import { trackingState, type TrackingState } from '@/lib/tracking';

/** Set by the dashboard's "sin check-in" alert. */
const CHECKIN_PARAM = 'checkin';
const CHECKIN_PENDING = 'pendiente';

/** Which dialog is open, and for whom. `null` driver means "register new". */
type DriverDialog =
  | { kind: 'form'; driver: Driver | null }
  | { kind: 'status'; driver: Driver }
  | { kind: 'assign'; driver: Driver }
  | { kind: 'retire'; driver: Driver };

const TRACKING_BADGES: Record<
  TrackingState,
  { tone: 'good' | 'warn' | 'idle'; label: string; hint: string }
> = {
  noMototaxi: {
    tone: 'idle',
    label: strings.drivers.trackingNoMototaxi,
    hint: strings.drivers.trackingNoMototaxiHint,
  },
  tracker: {
    tone: 'good',
    label: strings.drivers.trackingTracker,
    hint: strings.drivers.trackingTrackerHint,
  },
  trackerStale: {
    tone: 'warn',
    label: strings.drivers.trackingTrackerStale,
    hint: strings.drivers.trackingTrackerStaleHint,
  },
  shared: {
    tone: 'good',
    label: strings.drivers.trackingShared,
    hint: strings.drivers.trackingSharedHint,
  },
  needsShare: {
    tone: 'warn',
    label: strings.drivers.trackingNeedsShare,
    hint: strings.drivers.trackingNeedsShareHint,
  },
};

export default function Drivers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyWithoutCheckin = searchParams.get(CHECKIN_PARAM) === CHECKIN_PENDING;
  const [dialog, setDialog] = useState<DriverDialog | null>(null);
  const queryClient = useQueryClient();

  const retire = useMutation({
    mutationFn: ({ driver, reason }: { driver: Driver; reason?: string }) =>
      deleteDriver(driver.driver_uuid, reason),
    onSuccess: () => {
      setDialog(null);
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const drivers = useQuery({
    queryKey: queryKeys.drivers(),
    queryFn: () => listDrivers(),
    refetchInterval: POLL.drivers,
  });

  const mototaxis = useQuery({
    queryKey: queryKeys.mototaxis,
    queryFn: listMototaxis,
    refetchInterval: POLL.mototaxis,
  });

  const units = useMemo(() => {
    const map = new Map<string, MototaxiSummary>();
    for (const unit of mototaxis.data ?? []) map.set(unit.mototaxi_uuid, unit);
    return map;
  }, [mototaxis.data]);

  const plates = useMemo(() => {
    const map = new Map<string, string>();
    for (const [uuid, unit] of units) map.set(uuid, unit.plate_number);
    return map;
  }, [units]);

  const unitOf = useCallback(
    (driver: Driver) =>
      driver.current_mototaxi_uuid ? units.get(driver.current_mototaxi_uuid) : undefined,
    [units],
  );

  const rows = useMemo(() => {
    const all = drivers.data ?? [];
    return onlyWithoutCheckin ? all.filter((driver) => !driver.has_checked_in_today) : all;
  }, [drivers.data, onlyWithoutCheckin]);

  const columns: Column<Driver>[] = useMemo(
    () => [
      {
        id: 'name',
        header: strings.drivers.name,
        sortValue: (driver) => driver.name,
        cell: (driver) => <span className="font-medium text-slate-900">{driver.name}</span>,
      },
      {
        id: 'status',
        header: strings.drivers.status,
        sortValue: (driver) => driver.status,
        cell: (driver) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge
              kind="driver"
              value={driver.status}
              title={
                driver.status === 'RESTING' && driver.resting_until
                  ? `${strings.drivers.restingUntil} ${formatDateTime(driver.resting_until)}`
                  : undefined
              }
            />
            {!driver.has_checked_in_today && (
              <WarningBadge title={strings.drivers.noCheckinHint}>
                {strings.drivers.noCheckinBadge}
              </WarningBadge>
            )}
          </div>
        ),
      },
      {
        id: 'mototaxi',
        header: strings.drivers.mototaxi,
        sortValue: (driver) =>
          driver.current_mototaxi_uuid ? (plates.get(driver.current_mototaxi_uuid) ?? '') : null,
        cell: (driver) =>
          driver.current_mototaxi_uuid ? (
            (plates.get(driver.current_mototaxi_uuid) ?? EMPTY)
          ) : (
            <WarningBadge title={strings.drivers.noMototaxiHint}>
              {strings.drivers.noMototaxiBadge}
            </WarningBadge>
          ),
      },
      {
        id: 'tracking',
        header: strings.drivers.tracking,
        sortValue: (driver) => trackingState(unitOf(driver)),
        cell: (driver) => {
          const unit = unitOf(driver);
          const badge = TRACKING_BADGES[trackingState(unit)];
          return (
            <div className="flex flex-col items-start gap-0.5">
              <ToneBadge tone={badge.tone} title={badge.hint}>
                {badge.label}
              </ToneBadge>
              {unit?.location_updated_at && (
                <span className="text-xs text-slate-500">
                  {formatRelative(unit.location_updated_at)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'phone',
        header: strings.drivers.phone,
        secondary: true,
        // Searchable by the full number even though only the mask is rendered.
        sortValue: (driver) => driver.phone_whatsapp,
        cell: (driver) => (
          <MaskedValue value={driver.phone_whatsapp} masked={maskPhone(driver.phone_whatsapp)} />
        ),
      },
      {
        id: 'ci',
        header: strings.drivers.ci,
        secondary: true,
        sortValue: (driver) => driver.ci,
        cell: (driver) => <MaskedValue value={driver.ci} masked={maskCi(driver.ci)} />,
      },
      {
        id: 'trips',
        header: strings.drivers.trips,
        align: 'right',
        sortValue: (driver) => driver.trips_completed,
        cell: (driver) => driver.trips_completed,
      },
      {
        id: 'acceptance',
        header: strings.drivers.acceptance,
        align: 'right',
        secondary: true,
        sortValue: (driver) => driver.acceptance_rate,
        cell: (driver) => formatPercent(driver.acceptance_rate),
      },
      {
        id: 'response',
        header: strings.drivers.responseTime,
        align: 'right',
        secondary: true,
        sortValue: (driver) => driver.average_response_seconds,
        cell: (driver) => formatDuration(driver.average_response_seconds),
      },
      {
        id: 'checkin',
        header: strings.drivers.checkin,
        sortValue: (driver) => driver.last_checkin_at ?? null,
        cell: (driver) =>
          driver.last_checkin_at ? formatDateTime(driver.last_checkin_at) : strings.common.never,
      },
      {
        id: 'actions',
        header: '',
        cell: (driver) => (
          <div className="flex flex-wrap justify-end gap-1">
            <RowAction onClick={() => setDialog({ kind: 'form', driver })}>
              {strings.common.edit}
            </RowAction>
            <RowAction onClick={() => setDialog({ kind: 'status', driver })}>
              {strings.fleet.changeStatus}
            </RowAction>
            <RowAction onClick={() => setDialog({ kind: 'assign', driver })}>
              {strings.fleet.assignMototaxi}
            </RowAction>
            {driver.status !== 'DISABLED' && (
              <RowAction danger onClick={() => setDialog({ kind: 'retire', driver })}>
                {strings.fleet.retire}
              </RowAction>
            )}
          </div>
        ),
      },
    ],
    [plates, unitOf],
  );

  if (drivers.isPending) return <TableSkeleton rows={5} />;
  if (drivers.isError) {
    return <ErrorState error={drivers.error} onRetry={() => void drivers.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{strings.drivers.heading}</h1>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'form', driver: null })}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {strings.fleet.newDriver}
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyWithoutCheckin}
            onChange={(e) =>
              setSearchParams(e.target.checked ? { [CHECKIN_PARAM]: CHECKIN_PENDING } : {}, {
                replace: true,
              })
            }
            className="rounded border-slate-300"
          />
          {strings.drivers.onlyWithoutCheckin}
        </label>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(driver) => driver.driver_uuid}
        caption={strings.drivers.heading}
        searchPlaceholder={strings.common.search}
        initialSort={{ columnId: 'name', direction: 'asc' }}
        rowClassName={(driver) =>
          driver.has_checked_in_today ? 'hover:bg-slate-50' : 'bg-amber-50/60'
        }
      />

      {dialog?.kind === 'form' && (
        <DriverForm driver={dialog.driver} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'status' && (
        <DriverStatusDialog driver={dialog.driver} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'assign' && (
        <AssignMototaxiDialog driver={dialog.driver} onClose={() => setDialog(null)} />
      )}

      <ConfirmDialog
        open={dialog?.kind === 'retire'}
        title={strings.fleet.retireTitle}
        body={dialog?.kind === 'retire' ? strings.fleet.retireBody(dialog.driver.name) : ''}
        confirmLabel={strings.fleet.retire}
        reasonLabel={strings.fleet.retireReason}
        pending={retire.isPending}
        error={retire.error}
        onConfirm={(reason) =>
          dialog?.kind === 'retire' && retire.mutate({ driver: dialog.driver, reason })
        }
        onClose={() => {
          retire.reset();
          setDialog(null);
        }}
      />
    </div>
  );
}

function RowAction({
  children,
  onClick,
  danger,
}: {
  children: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs font-medium whitespace-nowrap ${
        danger
          ? 'border-red-300 text-red-700 hover:bg-red-50'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
