import { todayInLaPaz } from '@/lib/format';

/** Yellow from a week before the credit runs out. */
export const SIM_WARN_DAYS = 7;
/** Red from three days before, and after the date has passed. */
export const SIM_URGENT_DAYS = 3;

export type SimRechargeState = 'none' | 'ok' | 'soon' | 'urgent' | 'overdue';

const DAY_MS = 86_400_000;

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) / DAY_MS;
}

/**
 * How close a tracker's SIM is to running out of credit.
 *
 * `nextRecharge` is the server's date (last top-up plus three days per unit of
 * credit). Days are counted on calendar dates in La Paz, so the colour changes
 * at local midnight rather than at some UTC hour.
 */
export function simRechargeState(
  nextRecharge: string | null,
  today: string = todayInLaPaz(),
): { state: SimRechargeState; daysLeft: number | null } {
  if (!nextRecharge) return { state: 'none', daysLeft: null };
  const daysLeft = dayNumber(nextRecharge) - dayNumber(today);
  if (daysLeft < 0) return { state: 'overdue', daysLeft };
  if (daysLeft <= SIM_URGENT_DAYS) return { state: 'urgent', daysLeft };
  if (daysLeft <= SIM_WARN_DAYS) return { state: 'soon', daysLeft };
  return { state: 'ok', daysLeft };
}
