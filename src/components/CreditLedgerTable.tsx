import type { CreditTransaction, UUID } from '@/api/types';
import { EMPTY } from '@/lib/format';
import {
  creditActorLabel,
  creditKindLabel,
  describeCreditRow,
  formatCreditDate,
  formatSignedCredit,
} from '@/lib/creditLedger';
import { strings } from '@/lib/strings';
import { formatCredit } from '@/lib/usageCredit';

/**
 * One page of ledger rows as a plain table. Not the shared `DataTable`: the rows
 * come one page at a time from the server, so client-side sorting and search
 * would only act on the page in view.
 */
export function CreditLedgerTable({
  rows,
  driverNames,
  caption,
}: {
  rows: CreditTransaction[];
  /** Given on the tenant-wide history, where a row must say which driver it is. */
  driverNames?: Map<UUID, string>;
  caption: string;
}) {
  const showDriver = driverNames !== undefined;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {strings.creditLedger.date}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {strings.creditLedger.kind}
            </th>
            {showDriver && (
              <th scope="col" className="px-3 py-2 font-medium">
                {strings.creditLedger.driver}
              </th>
            )}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {strings.creditLedger.amount}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {strings.creditLedger.balanceAfter}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {strings.creditLedger.detail}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {strings.creditLedger.by}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={showDriver ? 7 : 6} className="px-3 py-6 text-center text-slate-500">
                {strings.creditLedger.empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.transaction_uuid} className="align-top">
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                {formatCreditDate(row.created_at)}
              </td>
              <td className="px-3 py-2">{creditKindLabel(row.kind)}</td>
              {showDriver && (
                <td className="px-3 py-2">{driverNames?.get(row.driver_uuid) ?? EMPTY}</td>
              )}
              <td
                className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${
                  row.amount < 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {formatSignedCredit(row.amount)}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                {formatCredit(row.balance_after)}
              </td>
              <td className="px-3 py-2 text-slate-700">{describeCreditRow(row)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                {creditActorLabel(row)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
