import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { downloadTripHistoryCsv, listTripHistory } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { TripSummary } from '@/api/types';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { MaskedValue } from '@/components/MaskedValue';
import { ReachTime } from '@/components/ReachTime';
import { TableSkeleton } from '@/components/Skeleton';
import { StatusBadge, WarningBadge } from '@/components/StatusBadge';
import { errorText } from '@/lib/errors';
import {
  EMPTY,
  formatDateTime,
  formatRating,
  laPazDayEndIso,
  laPazDayStartIso,
  maskPhone,
  todayInLaPaz,
} from '@/lib/format';
import { strings } from '@/lib/strings';

/** The endpoint offers no offset, so the limit is the only lever. */
const LIMIT_OPTIONS = [200, 500, 1000] as const;

/** Set by the dashboard's auto-completed alert. */
const REVIEW_PARAM = 'cierre';
const REVIEW_VALUE = 'automatico';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function TripHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyAutoCompleted = searchParams.get(REVIEW_PARAM) === REVIEW_VALUE;

  const today = todayInLaPaz();
  const [since, setSince] = useState(today);
  const [until, setUntil] = useState(today);
  const [limit, setLimit] = useState<number>(LIMIT_OPTIONS[0]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  // Local dates become explicit instants: the API compares TIMESTAMPTZ, and a
  // bare date would be read as midnight UTC — four hours off from La Paz.
  const params = useMemo(
    () => ({
      since: laPazDayStartIso(since),
      until: laPazDayEndIso(until),
      limit,
    }),
    [since, until, limit],
  );

  const history = useQuery({
    queryKey: queryKeys.tripHistory(params),
    queryFn: () => listTripHistory(params),
  });

  const rows = useMemo(() => {
    const all = history.data ?? [];
    return onlyAutoCompleted ? all.filter((trip) => trip.completion_source === 'AUTO') : all;
  }, [history.data, onlyAutoCompleted]);

  // The API returns no total, so a full page is the only signal that rows were
  // left behind. Better to say so than to let the operator read a partial
  // window as the whole story.
  const truncated = (history.data?.length ?? 0) >= limit;

  const columns: Column<TripSummary>[] = useMemo(
    () => [
      {
        id: 'status',
        header: strings.trips.tripStatus,
        sortValue: (trip) => trip.status,
        cell: (trip) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge kind="trip" value={trip.status} />
            {trip.completion_source === 'AUTO' && (
              <WarningBadge title={strings.trips.autoCompletedHint}>
                {strings.trips.autoCompleted}
              </WarningBadge>
            )}
          </div>
        ),
      },
      {
        id: 'customer',
        header: strings.trips.customer,
        sortValue: (trip) => trip.customer_phone,
        cell: (trip) =>
          trip.customer_phone ? (
            <MaskedValue value={trip.customer_phone} masked={maskPhone(trip.customer_phone)} />
          ) : (
            EMPTY
          ),
      },
      {
        id: 'driver',
        header: strings.trips.driver,
        sortValue: (trip) => trip.driver_name,
        cell: (trip) => trip.driver_name ?? EMPTY,
      },
      {
        id: 'plate',
        header: strings.trips.plate,
        secondary: true,
        sortValue: (trip) => trip.plate_number,
        cell: (trip) => trip.plate_number ?? EMPTY,
      },
      {
        id: 'pickup',
        header: strings.trips.pickup,
        secondary: true,
        sortValue: (trip) => trip.pickup_address,
        cell: (trip) => trip.pickup_address ?? EMPTY,
      },
      {
        id: 'reach',
        header: strings.trips.reachTime,
        align: 'right',
        secondary: true,
        sortValue: (trip) => trip.reach_time_seconds,
        cell: (trip) => <ReachTime trip={trip} />,
      },
      {
        id: 'rating',
        header: strings.trips.rating,
        align: 'right',
        sortValue: (trip) => trip.rating,
        cell: (trip) => formatRating(trip.rating),
      },
      {
        id: 'cancelledBy',
        header: strings.trips.cancelledBy,
        secondary: true,
        sortValue: (trip) => trip.cancelled_by,
        cell: (trip) =>
          trip.cancelled_by
            ? (strings.status.cancelledBy[
                trip.cancelled_by as keyof typeof strings.status.cancelledBy
              ] ?? trip.cancelled_by)
            : EMPTY,
      },
      {
        id: 'created',
        header: strings.trips.createdAt,
        sortValue: (trip) => trip.created_at,
        cell: (trip) => formatDateTime(trip.created_at),
      },
      {
        id: 'ended',
        header: strings.trips.endedAt,
        secondary: true,
        sortValue: (trip) => trip.ended_at,
        cell: (trip) => formatDateTime(trip.ended_at),
      },
    ],
    [],
  );

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await downloadTripHistoryCsv(params);
      triggerDownload(blob, `viajes_${since}_${until}.csv`);
    } catch (caught) {
      setExportError(caught);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{strings.trips.historyHeading}</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-sm">
          <span className="block text-slate-600">{strings.trips.since}</span>
          <input
            type="date"
            value={since}
            max={until}
            onChange={(e) => setSince(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">{strings.trips.until}</span>
          <input
            type="date"
            value={until}
            min={since}
            onChange={(e) => setUntil(e.target.value)}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">{strings.trips.limit}</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-1 rounded border border-slate-300 px-2 py-1"
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyAutoCompleted}
            onChange={(e) =>
              setSearchParams(e.target.checked ? { [REVIEW_PARAM]: REVIEW_VALUE } : {}, {
                replace: true,
              })
            }
            className="rounded border-slate-300"
          />
          {strings.trips.autoCompleted}
        </label>

        <div className="ml-auto text-right">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {exporting ? strings.trips.exporting : strings.trips.exportCsv}
          </button>
          <p className="mt-1 text-xs text-slate-500">{strings.trips.exportHint}</p>
        </div>
      </div>

      {exportError != null && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorText(exportError)}
        </p>
      )}

      {truncated && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {strings.trips.limitReached(limit)}
        </p>
      )}

      {history.isPending ? (
        <TableSkeleton rows={5} />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(trip) => trip.trip_uuid}
          caption={strings.trips.historyHeading}
          emptyMessage={strings.trips.noHistory}
          searchPlaceholder={strings.common.search}
          initialSort={{ columnId: 'created', direction: 'desc' }}
          rowClassName={(trip) =>
            trip.completion_source === 'AUTO' ? 'bg-amber-50/60' : 'hover:bg-slate-50'
          }
        />
      )}
    </div>
  );
}
