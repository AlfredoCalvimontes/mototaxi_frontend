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
import { EMPTY, formatDateTime, formatRating, maskPhone, todayInLaPaz } from '@/lib/format';
import { localInputEndIso, localInputToIso } from '@/lib/filters';
import {
  CheckFilter,
  DateTimeRange,
  FilterBar,
  SearchSelectFilter,
  SelectFilter,
} from '@/components/Filters';
import { filterParams, useCityScope } from '@/lib/cityScope';
import { strings } from '@/lib/strings';
import { tripTypeLabel, useVehicleTypeNames } from '@/lib/useVehicleTypes';

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
  const cityScope = useCityScope();
  const onlyAutoCompleted = searchParams.get(REVIEW_PARAM) === REVIEW_VALUE;

  // The window is date + time, La Paz wall clock; it starts as «today, all day».
  const today = todayInLaPaz();
  const [since, setSince] = useState(`${today}T00:00`);
  const [until, setUntil] = useState(`${today}T23:59`);
  const [statusFilter, setStatusFilter] = useState('');
  const [cancelledByFilter, setCancelledByFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [limit, setLimit] = useState<number>(LIMIT_OPTIONS[0]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  // The typed La Paz date and time become explicit instants: the API compares
  // TIMESTAMPTZ, and a bare value would be read as UTC — four hours off.
  const params = useMemo(
    () => ({
      since: localInputToIso(since),
      until: localInputEndIso(until),
      limit,
      ...(cityScope && { city_uuid: cityScope }),
    }),
    [since, until, limit, cityScope],
  );

  const history = useQuery({
    queryKey: queryKeys.tripHistory(params),
    queryFn: () => listTripHistory(params),
  });

  const rows = useMemo(() => {
    const all = history.data ?? [];
    return all.filter(
      (trip) =>
        (!onlyAutoCompleted || trip.completion_source === 'AUTO') &&
        (!statusFilter || trip.status === statusFilter) &&
        (!cancelledByFilter || trip.cancelled_by === cancelledByFilter) &&
        (!driverFilter ||
          (driverFilter === 'none' ? !trip.driver_name : trip.driver_name === driverFilter)) &&
        (!typeFilter ||
          (typeFilter === 'any'
            ? !trip.requested_vehicle_type_uuid
            : trip.requested_vehicle_type_uuid === typeFilter)) &&
        (!ratingFilter ||
          (ratingFilter === 'none'
            ? trip.rating === null
            : trip.rating !== null && trip.rating >= Number(ratingFilter))),
    );
  }, [
    history.data,
    onlyAutoCompleted,
    statusFilter,
    cancelledByFilter,
    driverFilter,
    typeFilter,
    ratingFilter,
  ]);

  const driverNames = useMemo(
    () => [
      ...new Set((history.data ?? []).map((t) => t.driver_name).filter((n): n is string => !!n)),
    ],
    [history.data],
  );
  const anyFilter =
    onlyAutoCompleted ||
    !!(statusFilter || cancelledByFilter || driverFilter || typeFilter || ratingFilter);
  function clearFilters() {
    setStatusFilter('');
    setCancelledByFilter('');
    setDriverFilter('');
    setTypeFilter('');
    setRatingFilter('');
    setSearchParams(filterParams(searchParams, REVIEW_PARAM, null), { replace: true });
  }

  // The API returns no total, so a full page is the only signal that rows were
  // left behind. Better to say so than to let the operator read a partial
  // window as the whole story.
  const truncated = (history.data?.length ?? 0) >= limit;

  const typeNames = useVehicleTypeNames();
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
                {strings.trips.autoCompletedBadge}
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
        id: 'type',
        header: strings.trips.vehicleType,
        secondary: true,
        sortValue: (trip) => tripTypeLabel(trip, typeNames),
        cell: (trip) => tripTypeLabel(trip, typeNames),
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
    [typeNames],
  );

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await downloadTripHistoryCsv(params);
      triggerDownload(blob, `viajes_${since.replace(':', '')}_${until.replace(':', '')}.csv`);
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
        <DateTimeRange from={since} to={until} onFrom={setSince} onTo={setUntil} />
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

      <FilterBar
        active={anyFilter}
        onClear={clearFilters}
        summary={strings.filters.results(rows.length, history.data?.length ?? 0)}
      >
        <SelectFilter
          label={strings.filters.status}
          value={statusFilter}
          onChange={setStatusFilter}
          allLabel={strings.filters.allStatuses}
          options={(['COMPLETED', 'CANCELLED', 'NO_DRIVER'] as const).map((v) => ({
            value: v,
            label: strings.status.trip[v],
          }))}
        />
        <SelectFilter
          label={strings.trips.cancelledBy}
          value={cancelledByFilter}
          onChange={setCancelledByFilter}
          options={(['CUSTOMER', 'DRIVER', 'SYSTEM', 'ADMIN'] as const).map((v) => ({
            value: v,
            label: strings.status.cancelledBy[v],
          }))}
        />
        <SearchSelectFilter
          label={strings.trips.driver}
          value={driverFilter}
          onChange={setDriverFilter}
          options={[
            { value: 'none', label: strings.fleet.noDriver },
            ...driverNames.map((name) => ({ value: name, label: name })),
          ]}
        />
        <SelectFilter
          label={strings.trips.vehicleType}
          value={typeFilter}
          onChange={setTypeFilter}
          allLabel={strings.filters.allTypes}
          options={[
            { value: 'any', label: strings.trips.anyType },
            ...[...typeNames].map(([value, label]) => ({ value, label })),
          ]}
        />
        <SelectFilter
          label={strings.trips.rating}
          value={ratingFilter}
          onChange={setRatingFilter}
          options={[
            { value: '4', label: '4 ★ o más' },
            { value: '3', label: '3 ★ o más' },
            { value: '1', label: '1 ★ o más' },
            { value: 'none', label: strings.customers.noRating },
          ]}
        />
        <CheckFilter
          label={strings.trips.autoCompleted}
          checked={onlyAutoCompleted}
          onChange={(checked) =>
            setSearchParams(
              filterParams(searchParams, REVIEW_PARAM, checked ? REVIEW_VALUE : null),
              {
                replace: true,
              },
            )
          }
        />
      </FilterBar>

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
