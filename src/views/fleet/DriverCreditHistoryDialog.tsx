import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getDriverCreditLedger } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { Driver } from '@/api/types';
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
import { formatDateTime, EMPTY } from '@/lib/format';
import { strings } from '@/lib/strings';
import { formatCredit } from '@/lib/usageCredit';

/**
 * A driver's credit history: where the balance stands, why it is what it is,
 * and every change behind it. Read-only; changes are made from the drivers table.
 */
export function DriverCreditHistoryDialog({
  driver,
  onClose,
}: {
  driver: Driver;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<CreditFilterState>(EMPTY_CREDIT_FILTERS);
  const params = creditFilterParams(filters);

  const ledger = useQuery({
    queryKey: queryKeys.creditLedgerDriver(driver.driver_uuid, params),
    queryFn: () => getDriverCreditLedger(driver.driver_uuid, params),
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data = ledger.data;
  const summary = data?.summary;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-history-title"
        className="w-full max-w-5xl space-y-4 rounded-lg bg-white p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="credit-history-title" className="text-base font-semibold text-slate-900">
            {strings.creditLedger.driverHeading(driver.name)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.common.close}
            className="rounded px-2 text-xl leading-none text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>

        {summary && !summary.usage_credit_enabled && (
          <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {strings.creditLedger.notOnScheme}
          </p>
        )}

        {summary && summary.usage_credit_enabled && (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label={strings.creditLedger.summaryBalanceNow}
              value={formatCredit(summary.balance_now) || EMPTY}
              tone={summary.usage_credit_expired ? 'bad' : undefined}
            />
            <Stat
              label={strings.creditLedger.summarySettled}
              value={formatCredit(summary.settled_balance)}
            />
            <Stat
              label={strings.creditLedger.summaryToppedUp}
              value={formatCredit(summary.total_topped_up)}
            />
            <Stat
              label={strings.creditLedger.summaryDrained}
              value={formatCredit(summary.total_drained)}
            />
            <Stat
              label={strings.creditLedger.summaryDeducted}
              value={formatCredit(summary.total_deducted)}
            />
            <Stat
              label={strings.creditLedger.summaryExpires}
              value={formatDateTime(summary.usage_credit_expires_at)}
              tone={summary.usage_credit_expired ? 'bad' : undefined}
            />
          </dl>
        )}

        <CreditLedgerFilterBar value={filters} onChange={setFilters} />

        {ledger.isError ? (
          <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
        ) : data === undefined ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <CreditLedgerTable rows={data.items} caption={strings.creditLedger.heading} />
            <Pager
              page={data.page}
              pages={data.pages}
              onPage={(page) => setFilters({ ...filters, page })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="rounded border border-slate-200 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={`font-semibold tabular-nums ${tone === 'bad' ? 'text-red-700' : 'text-slate-900'}`}
      >
        {value}
      </dd>
    </div>
  );
}
