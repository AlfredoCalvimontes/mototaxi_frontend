/**
 * Reading the credit ledger: labels, signs and the one-line description of a
 * row. Shared by the driver's history and the tenant-wide history so both say
 * the same thing about the same row.
 */

import type { CreditKind, CreditTransaction } from '@/api/types';
import { formatDateTime, laPazDayEndIso, laPazDayStartIso } from '@/lib/format';
import { strings } from '@/lib/strings';
import { formatCredit } from '@/lib/usageCredit';

const kinds = strings.creditLedger.kinds;

export function creditKindLabel(kind: CreditKind): string {
  return kinds[kind];
}

/** `+120`, `−60`, or a bare `0` for a row that moved nothing. */
export function formatSignedCredit(amount: number): string {
  if (amount === 0) return formatCredit(0);
  const magnitude = formatCredit(Math.abs(amount));
  return amount > 0 ? `+${magnitude}` : `−${magnitude}`;
}

/** Who made the change: a named administrator, or the system for drains and plan moves. */
export function creditActorLabel(row: CreditTransaction): string {
  return row.actor_user_uuid ? strings.creditLedger.administrator : strings.creditLedger.system;
}

/** Rates travel as decimal strings (`60.00`); show them as the panel shows credit. */
function formatRate(value: string): string {
  const number = Number(value);
  return value === '' || Number.isNaN(number) ? '—' : formatCredit(number);
}

function detailText(detail: Record<string, unknown> | null, key: string): string {
  const value = detail?.[key];
  return typeof value === 'string' ? value : '';
}

/** What the row says, in one line. Manual rows show their note; system rows say what happened. */
export function describeCreditRow(row: CreditTransaction): string {
  switch (row.kind) {
    case 'TOPUP':
    case 'MANUAL_DEDUCTION': {
      const note = row.note ?? '';
      if (row.requested_amount === null || row.requested_amount === row.amount) return note;
      const asked = strings.creditLedger.requested(formatCredit(Math.abs(row.requested_amount)));
      return `${note} · ${asked}`;
    }
    case 'DRAIN':
      return row.rate_applied === null
        ? ''
        : strings.creditLedger.drainDetail(formatCredit(row.rate_applied));
    case 'PLAN_CHANGE':
      return strings.creditLedger.planChangeDetail(row.usage_plan_name ?? '—');
    case 'REPRICE':
      return strings.creditLedger.repriceDetail(
        formatRate(detailText(row.detail, 'from_rate')),
        formatRate(detailText(row.detail, 'to_rate')),
      );
    case 'CLEARED':
      return strings.creditLedger.clearedDetail;
    case 'OPENING':
      return strings.creditLedger.openingDetail;
  }
}

export function formatCreditDate(value: string): string {
  return formatDateTime(value);
}

/**
 * The inclusive upper bound for a local day, as an instant: the last millisecond
 * of that day in La Paz. The API's `created_to` is inclusive, so the next day's
 * midnight would leak one row in.
 */
export function laPazDayLastInstantIso(startOfNextDayIso: string | undefined): string | undefined {
  if (!startOfNextDayIso) return undefined;
  return new Date(Date.parse(startOfNextDayIso) - 1).toISOString();
}

/** Rows per page; the API default is 20 too, so the pager and the server agree. */
export const CREDIT_PAGE_SIZE = 20;

/** What the filter bar edits. Dates are local days in La Paz; `''` means no bound. */
export type CreditFilterState = {
  kind: CreditKind | '';
  from: string;
  to: string;
  page: number;
};

export const EMPTY_CREDIT_FILTERS: CreditFilterState = { kind: '', from: '', to: '', page: 1 };

/** The query parameters for the API, from what is on screen. */
export function creditFilterParams(state: CreditFilterState): {
  kind?: CreditKind;
  created_from?: string;
  created_to?: string;
  page: number;
  page_size: number;
} {
  const from = laPazDayStartIso(state.from);
  const to = laPazDayLastInstantIso(laPazDayEndIso(state.to));
  return {
    page: state.page,
    page_size: CREDIT_PAGE_SIZE,
    ...(state.kind && { kind: state.kind }),
    ...(from && { created_from: from }),
    ...(to && { created_to: to }),
  };
}
