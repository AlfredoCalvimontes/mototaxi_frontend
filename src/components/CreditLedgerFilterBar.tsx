import type { ReactNode } from 'react';

import type { CreditKind } from '@/api/types';
import { creditKindLabel, EMPTY_CREDIT_FILTERS, type CreditFilterState } from '@/lib/creditLedger';
import { strings } from '@/lib/strings';

const KINDS: CreditKind[] = [
  'TOPUP',
  'MANUAL_DEDUCTION',
  'DRAIN',
  'PLAN_CHANGE',
  'REPRICE',
  'CLEARED',
  'OPENING',
];

const FIELD = 'mt-1 rounded border border-slate-300 px-2 py-1 text-sm';

/**
 * Kind and date filters for a ledger. Any change goes back to the first page,
 * so the pager never points past the end of a shorter result.
 */
export function CreditLedgerFilterBar({
  value,
  onChange,
  children,
}: {
  value: CreditFilterState;
  onChange: (next: CreditFilterState) => void;
  /** Extra filters on the same row, such as the driver picker on the tenant page. */
  children?: ReactNode;
}) {
  const active = value.kind !== '' || value.from !== '' || value.to !== '';
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
      {children}
      <label className="text-sm">
        <span className="block text-slate-600">{strings.creditLedger.kind}</span>
        <select
          value={value.kind}
          onChange={(e) => onChange({ ...value, kind: e.target.value as CreditKind | '', page: 1 })}
          className={FIELD}
        >
          <option value="">{strings.creditLedger.allKinds}</option>
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {creditKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-slate-600">{strings.creditLedger.from}</span>
        <input
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value, page: 1 })}
          className={FIELD}
        />
      </label>
      <label className="text-sm">
        <span className="block text-slate-600">{strings.creditLedger.to}</span>
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value, page: 1 })}
          className={FIELD}
        />
      </label>
      {active && (
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_CREDIT_FILTERS })}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {strings.creditLedger.clear}
        </button>
      )}
    </div>
  );
}
