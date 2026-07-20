import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listDrivers, listMototaxis } from '@/api/admin';
import { POLL, queryKeys } from '@/api/queries';
import type { Driver } from '@/api/types';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { MaskedValue } from '@/components/MaskedValue';
import { StatusBadge, WarningBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/Skeleton';
import {
  EMPTY,
  formatDateTime,
  formatDuration,
  formatPercent,
  maskCi,
  maskPhone,
} from '@/lib/format';
import { strings } from '@/lib/strings';

/** Set by the dashboard's "sin check-in" alert. */
const CHECKIN_PARAM = 'checkin';
const CHECKIN_PENDING = 'pendiente';

export default function Drivers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyWithoutCheckin = searchParams.get(CHECKIN_PARAM) === CHECKIN_PENDING;

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

  const plates = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of mototaxis.data ?? []) map.set(unit.mototaxi_uuid, unit.plate_number);
    return map;
  }, [mototaxis.data]);

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
          driver.current_mototaxi_uuid
            ? (plates.get(driver.current_mototaxi_uuid) ?? EMPTY)
            : EMPTY,
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
    ],
    [plates],
  );

  if (drivers.isPending) return <TableSkeleton rows={5} />;
  if (drivers.isError) {
    return <ErrorState error={drivers.error} onRetry={() => void drivers.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{strings.drivers.heading}</h1>
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
    </div>
  );
}
