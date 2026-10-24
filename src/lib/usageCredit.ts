import type { Driver } from '@/api/types';

/** Amber from this many hours before the credit runs out (three days). */
export const USAGE_CREDIT_WARN_HOURS = 72;

export type UsageCreditState = 'off' | 'ok' | 'soon' | 'expired';

const HOUR_MS = 3_600_000;

type CreditFields = Pick<
  Driver,
  'usage_credit_enabled' | 'usage_credit_expired' | 'usage_credit_expires_at'
>;

/**
 * Where a driver stands on the usage-credit scheme.
 *
 * `expired` comes from the server, which drains the balance by its own clock
 * and rate, so the panel never second-guesses it. Only the amber warning is
 * worked out here, from the expiry instant. `hoursLeft` rounds up, so a credit
 * with ten minutes left still reads «1 h»; it is negative once past.
 */
export function usageCreditState(
  driver: CreditFields,
  now: Date = new Date(),
): { state: UsageCreditState; hoursLeft: number | null } {
  if (!driver.usage_credit_enabled) return { state: 'off', hoursLeft: null };
  const expiry = driver.usage_credit_expires_at
    ? new Date(driver.usage_credit_expires_at).getTime()
    : Number.NaN;
  const hoursLeft = Number.isNaN(expiry) ? null : Math.ceil((expiry - now.getTime()) / HOUR_MS);
  if (driver.usage_credit_expired) return { state: 'expired', hoursLeft };
  if (hoursLeft !== null && hoursLeft <= USAGE_CREDIT_WARN_HOURS) {
    return { state: 'soon', hoursLeft };
  }
  return { state: 'ok', hoursLeft };
}

/** «180», «-20», «12,5»: at most two decimals, comma as the separator. */
export function formatCredit(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(value);
}
