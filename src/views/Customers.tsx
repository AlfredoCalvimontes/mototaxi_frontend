import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { blockCustomer, listCustomers, unblockCustomer } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { CustomerSummary } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { CheckFilter, DateTimeRange, FilterBar, SelectFilter } from '@/components/Filters';
import { MaskedValue, RevealAllButton } from '@/components/MaskedValue';
import { useRevealGroup } from '@/components/revealGroup';
import { TableSkeleton } from '@/components/Skeleton';
import { EMPTY, formatDateTime, formatRating, maskPhone } from '@/lib/format';
import { useCityScope } from '@/lib/cityScope';
import { inWindow } from '@/lib/filters';
import { strings } from '@/lib/strings';

type PendingAction = { customer: CustomerSummary; action: 'block' | 'unblock' };

/** Names the customer in the confirmation; falls back to the masked phone. */
function customerLabel(customer: CustomerSummary): string {
  return customer.name ?? maskPhone(customer.phone_whatsapp);
}

export default function Customers() {
  const queryClient = useQueryClient();
  const cityScope = useCityScope();
  // Everything is on screen by default: blocked customers and full numbers.
  const [includeBlocked, setIncludeBlocked] = useState(true);
  const phoneGroup = useRevealGroup(true);
  const [stateFilter, setStateFilter] = useState('');
  const [cancelFilter, setCancelFilter] = useState('');
  const [tripsFilter, setTripsFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [msgFrom, setMsgFrom] = useState('');
  const [msgTo, setMsgTo] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);

  const customers = useQuery({
    queryKey: queryKeys.customers(includeBlocked, cityScope),
    queryFn: () => listCustomers(includeBlocked, cityScope),
  });

  const mutation = useMutation({
    mutationFn: ({ customer, action, reason }: PendingAction & { reason?: string }) =>
      action === 'block'
        ? blockCustomer(customer.customer_uuid, reason)
        : unblockCustomer(customer.customer_uuid),
    onSuccess: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const columns: Column<CustomerSummary>[] = useMemo(
    () => [
      {
        id: 'name',
        header: strings.customers.name,
        sortValue: (customer) => customer.name,
        cell: (customer) => customer.name ?? EMPTY,
      },
      {
        id: 'phone',
        header: strings.customers.phone,
        headerAction: <RevealAllButton group={phoneGroup} label={strings.customers.phone} />,
        // Searchable by the full number even though it renders masked.
        sortValue: (customer) => customer.phone_whatsapp,
        cell: (customer) => (
          <MaskedValue
            value={customer.phone_whatsapp}
            masked={maskPhone(customer.phone_whatsapp)}
            group={phoneGroup}
          />
        ),
      },
      {
        id: 'trips',
        header: strings.customers.trips,
        align: 'right',
        sortValue: (customer) => customer.trip_count,
        cell: (customer) => customer.trip_count,
      },
      {
        id: 'cancellations',
        header: strings.customers.cancellations,
        align: 'right',
        sortValue: (customer) => customer.cancel_count,
        // Repeated cancellations are the reason blocking exists (spec §4.2).
        cell: (customer) => (
          <span className={customer.cancel_count >= 5 ? 'font-semibold text-amber-700' : undefined}>
            {customer.cancel_count}
          </span>
        ),
      },
      {
        id: 'rating',
        header: strings.customers.ratingGiven,
        align: 'right',
        secondary: true,
        sortValue: (customer) => customer.average_rating_given,
        cell: (customer) => formatRating(customer.average_rating_given),
      },
      {
        id: 'lastMessage',
        header: strings.customers.lastMessage,
        secondary: true,
        sortValue: (customer) => customer.last_message_at ?? null,
        cell: (customer) =>
          customer.last_message_at
            ? formatDateTime(customer.last_message_at)
            : strings.common.never,
      },
      {
        id: 'actions',
        header: '',
        cell: (customer) => (
          <button
            type="button"
            onClick={() => {
              mutation.reset();
              setPending({ customer, action: customer.is_blocked ? 'unblock' : 'block' });
            }}
            className={`rounded border px-2 py-1 text-xs font-medium whitespace-nowrap ${
              customer.is_blocked
                ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                : 'border-red-300 text-red-700 hover:bg-red-50'
            }`}
          >
            {customer.is_blocked ? strings.customers.unblock : strings.customers.block}
          </button>
        ),
      },
    ],
    [mutation, phoneGroup],
  );

  const rows = useMemo(
    () =>
      (customers.data ?? []).filter(
        (c) =>
          (!stateFilter || (stateFilter === 'blocked' ? c.is_blocked : !c.is_blocked)) &&
          (!cancelFilter || c.cancel_count >= Number(cancelFilter)) &&
          (!tripsFilter || c.trip_count >= Number(tripsFilter)) &&
          (!ratingFilter ||
            (ratingFilter === 'none'
              ? c.average_rating_given === null
              : c.average_rating_given !== null &&
                c.average_rating_given >= Number(ratingFilter))) &&
          inWindow(c.last_message_at, msgFrom, msgTo),
      ),
    [customers.data, stateFilter, cancelFilter, tripsFilter, ratingFilter, msgFrom, msgTo],
  );
  const anyFilter = !!(
    stateFilter ||
    cancelFilter ||
    tripsFilter ||
    ratingFilter ||
    msgFrom ||
    msgTo
  );
  function clearFilters() {
    setStateFilter('');
    setCancelFilter('');
    setTripsFilter('');
    setRatingFilter('');
    setMsgFrom('');
    setMsgTo('');
  }

  if (customers.isPending) return <TableSkeleton rows={5} />;
  if (customers.isError) {
    return <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />;
  }

  const blocking = pending?.action === 'block';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{strings.customers.heading}</h1>
        <CheckFilter
          label={strings.customers.showBlocked}
          checked={includeBlocked}
          onChange={setIncludeBlocked}
        />
      </div>

      <FilterBar
        active={anyFilter}
        onClear={clearFilters}
        summary={strings.filters.results(rows.length, customers.data.length)}
      >
        <SelectFilter
          label={strings.filters.status}
          value={stateFilter}
          onChange={setStateFilter}
          allLabel={strings.filters.allStatuses}
          options={[
            { value: 'active', label: strings.customers.stateActive },
            { value: 'blocked', label: strings.customers.blocked },
          ]}
        />
        <SelectFilter
          label={strings.customers.trips}
          value={tripsFilter}
          onChange={setTripsFilter}
          options={[1, 5, 10, 20].map((n) => ({ value: String(n), label: `${n} o más` }))}
        />
        <SelectFilter
          label={strings.customers.cancellations}
          value={cancelFilter}
          onChange={setCancelFilter}
          options={[1, 3, 5].map((n) => ({ value: String(n), label: `${n} o más` }))}
        />
        <SelectFilter
          label={strings.customers.ratingGiven}
          value={ratingFilter}
          onChange={setRatingFilter}
          options={[
            { value: '4', label: '4 ★ o más' },
            { value: '3', label: '3 ★ o más' },
            { value: '1', label: '1 ★ o más' },
            { value: 'none', label: strings.customers.noRating },
          ]}
        />
        <DateTimeRange from={msgFrom} to={msgTo} onFrom={setMsgFrom} onTo={setMsgTo} />
        <span className="pb-1 text-xs text-slate-500">{strings.customers.lastMessage}</span>
      </FilterBar>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(customer) => customer.customer_uuid}
        caption={strings.customers.heading}
        searchPlaceholder={strings.common.search}
        initialSort={{ columnId: 'trips', direction: 'desc' }}
        rowClassName={(customer) => (customer.is_blocked ? 'bg-red-50/60' : 'hover:bg-slate-50')}
      />

      <ConfirmDialog
        open={pending !== null}
        title={blocking ? strings.customers.blockTitle : strings.customers.unblockTitle}
        body={
          pending
            ? blocking
              ? strings.customers.blockBody(customerLabel(pending.customer))
              : strings.customers.unblockBody(customerLabel(pending.customer))
            : ''
        }
        confirmLabel={blocking ? strings.customers.block : strings.customers.unblock}
        // Unblocking restores service; only blocking is the destructive way.
        destructive={blocking}
        reasonLabel={blocking ? strings.customers.blockReason : undefined}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(reason) => pending && mutation.mutate({ ...pending, reason })}
        onClose={() => {
          mutation.reset();
          setPending(null);
        }}
      />
    </div>
  );
}
