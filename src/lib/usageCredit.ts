import { daysUntil } from '@/lib/sim';
import type { Driver } from '@/api/types';

/** Amber from this many days before the credit runs out. */
export const USAGE_CREDIT_WARN_DAYS = 3;

export type UsageCreditState = 'off' | 'ok' | 'soon' | 'expired';

type CreditFields = Pick<
  Driver,
  'usage_credit_enabled' | 'usage_credit_expired' | 'usage_credit_expires_on'
>;

/**
 * Where a driver stands on the usage-credit scheme.
 *
 * `expired` comes from the server, which drains the balance by its own clock
 * and rate, so the panel never second-guesses it. Only the amber warning is
 * worked out here, on calendar dates in La Paz.
 */
export function usageCreditState(
  driver: CreditFields,
  today?: string,
): { state: UsageCreditState; daysLeft: number | null } {
  if (!driver.usage_credit_enabled) return { state: 'off', daysLeft: null };
  const daysLeft = driver.usage_credit_expires_on
    ? daysUntil(driver.usage_credit_expires_on, today)
    : null;
  if (driver.usage_credit_expired) return { state: 'expired', daysLeft };
  if (daysLeft !== null && daysLeft <= USAGE_CREDIT_WARN_DAYS) return { state: 'soon', daysLeft };
  return { state: 'ok', daysLeft };
}

/** «180», «-20», «12,5»: at most two decimals, comma as the separator. */
export function formatCredit(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(value);
}
