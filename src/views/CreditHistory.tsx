import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { listCreditTransactions, listDrivers } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { UUID } from '@/api/types';
import { CreditLedgerFilterBar } from '@/components/CreditLedgerFilterBar';
import { CreditLedgerTable } from '@/components/CreditLedgerTable';
import { ErrorState } from '@/components/ErrorState';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/Skeleton';
import {
  creditFilterParams,
  EMPTY_CREDIT_FILTERS,
  type CreditFilterState,
} from '@/lib/creditLedger';
import { strings } from '@/lib/strings';

/**
 * Every credit change in the company, newest first, for auditing payments.
 * Filters: driver, kind of change, and a date range.
 */
export default function CreditHistory() {
  const [filters, setFilters] = useState<CreditFilterState>(EMPTY_CREDIT_FILTERS);
  const [driverUuid, setDriverUuid] = useState<UUID | ''>('');

  const params = {
    ...creditFilterParams(filters),
    ...(driverUuid && { driver_uuid: driverUuid }),
  };

  const ledger = useQuery({
    queryKey: queryKeys.creditLedgerTenant(params),
    queryFn: () => listCreditTransactions(params),
  });

  const drivers = useQuery({
    queryKey: queryKeys.drivers(),
    queryFn: () => listDrivers(),
  });

  const driverNames = useMemo(
    () => new Map((drivers.data ?? []).map((driver) => [driver.driver_uuid, driver.name])),
    [drivers.data],
  );

  const data = ledger.data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{strings.creditLedger.heading}</h1>

      <CreditLedgerFilterBar
        value={filters}
        onChange={(next) => {
          setFilters(next);
        }}
      >
        <label className="text-sm">
          <span className="block text-slate-600">{strings.creditLedger.driver}</span>
          <select
            value={driverUuid}
            onChange={(e) => {
              setDriverUuid(e.target.value);
              setFilters({ ...filters, page: 1 });
            }}
            className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">{strings.creditLedger.allDrivers}</option>
            {(drivers.data ?? []).map((driver) => (
              <option key={driver.driver_uuid} value={driver.driver_uuid}>
                {driver.name}
              </option>
            ))}
          </select>
        </label>
      </CreditLedgerFilterBar>

      {ledger.isError ? (
        <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
      ) : data === undefined ? (
        <TableSkeleton rows={8} />
      ) : (
        <>
          <CreditLedgerTable
            rows={data.items}
            driverNames={driverNames}
            caption={strings.creditLedger.heading}
          />
          <Pager
            page={data.page}
            pages={data.pages}
            onPage={(page) => setFilters({ ...filters, page })}
          />
        </>
      )}
    </div>
  );
}
