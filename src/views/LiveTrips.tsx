import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { forceCancelTrip, listActiveTrips } from '@/api/admin';
import { ApiError } from '@/api/client';
import { POLL, queryKeys } from '@/api/queries';
import type { TripSummary } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { MaskedValue } from '@/components/MaskedValue';
import { ReachTime } from '@/components/ReachTime';
import { TableSkeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { EMPTY, formatRelative, maskPhone } from '@/lib/format';
import { strings } from '@/lib/strings';

/** How the trip is named in the confirmation, so it is never generic. */
function tripLabel(trip: TripSummary): string {
  const who = trip.customer_phone ? maskPhone(trip.customer_phone) : strings.trips.customer;
  return trip.pickup_address ? `${who} (${trip.pickup_address})` : who;
}

export default function LiveTrips() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<TripSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const trips = useQuery({
    queryKey: queryKeys.activeTrips,
    queryFn: listActiveTrips,
    refetchInterval: POLL.activeTrips,
  });

  const cancel = useMutation({
    mutationFn: ({ trip, reason }: { trip: TripSummary; reason?: string }) =>
      forceCancelTrip(trip.trip_uuid, reason),
    onSuccess: () => {
      setTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.activeTrips });
    },
    onError: (error) => {
      // 409 is not a failure: the trip ended between render and click. Say so
      // plainly and refresh the board rather than showing a generic error.
      if (error instanceof ApiError && error.isConflict) {
        setTarget(null);
        setNotice(strings.trips.alreadyEnded);
        void queryClient.invalidateQueries({ queryKey: queryKeys.activeTrips });
      }
    },
  });

  const columns: Column<TripSummary>[] = useMemo(
    () => [
      {
        id: 'status',
        header: strings.trips.tripStatus,
        sortValue: (trip) => trip.status,
        cell: (trip) => <StatusBadge kind="trip" value={trip.status} />,
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
        id: 'destination',
        header: strings.trips.destination,
        secondary: true,
        sortValue: (trip) => trip.destination_address,
        cell: (trip) => trip.destination_address ?? EMPTY,
      },
      {
        id: 'reach',
        header: strings.trips.reachTime,
        align: 'right',
        sortValue: (trip) => trip.reach_time_seconds,
        cell: (trip) => <ReachTime trip={trip} />,
      },
      {
        id: 'created',
        header: strings.trips.requestedAgo,
        sortValue: (trip) => trip.created_at,
        cell: (trip) => formatRelative(trip.created_at),
      },
      {
        id: 'actions',
        header: '',
        cell: (trip) => (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              cancel.reset();
              setTarget(trip);
            }}
            className="rounded border border-red-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-red-700 hover:bg-red-50"
          >
            {strings.trips.forceCancel}
          </button>
        ),
      },
    ],
    [cancel],
  );

  if (trips.isPending) return <TableSkeleton rows={4} />;
  if (trips.isError) return <ErrorState error={trips.error} onRetry={() => void trips.refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{strings.trips.heading}</h1>

      {notice && (
        <p
          role="status"
          className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        >
          {notice}
        </p>
      )}

      <DataTable
        rows={trips.data}
        columns={columns}
        rowKey={(trip) => trip.trip_uuid}
        caption={strings.trips.heading}
        emptyMessage={strings.trips.noActiveTrips}
        initialSort={{ columnId: 'created', direction: 'asc' }}
      />

      <ConfirmDialog
        open={target !== null}
        title={strings.trips.forceCancelTitle}
        body={target ? strings.trips.forceCancelBody(tripLabel(target)) : ''}
        confirmLabel={strings.trips.forceCancel}
        reasonLabel={strings.trips.forceCancelReason}
        pending={cancel.isPending}
        // A 409 is reported as a notice on the board, not as a dialog error.
        error={cancel.error instanceof ApiError && cancel.error.isConflict ? null : cancel.error}
        onConfirm={(reason) => target && cancel.mutate({ trip: target, reason })}
        onClose={() => {
          cancel.reset();
          setTarget(null);
        }}
      />
    </div>
  );
}
