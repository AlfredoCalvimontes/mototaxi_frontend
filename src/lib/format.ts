/**
 * Display helpers.
 *
 * Every timestamp renders in America/La_Paz regardless of where the browser
 * is. The API returns UTC; showing an operator's local zone would silently
 * misreport when a trip happened.
 */

export const DISPLAY_TIME_ZONE = 'America/La_Paz';

const dateTimeFormatter = new Intl.DateTimeFormat('es-BO', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat('es-BO', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('es-BO', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const EMPTY = '—';

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parse(value);
  return date ? dateTimeFormatter.format(date) : EMPTY;
}

export function formatTime(value: string | null | undefined): string {
  const date = parse(value);
  return date ? timeFormatter.format(date) : EMPTY;
}

export function formatDate(value: string | null | undefined): string {
  const date = parse(value);
  return date ? dateFormatter.format(date) : EMPTY;
}

/** `265` → `4 min 25 s`. Reach times and averages are always seconds. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return EMPTY;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

/** How long ago, in words. Used for "GPS actualizado hace 3 min". */
export function formatRelative(value: string | null | undefined, now = new Date()): string {
  const date = parse(value);
  if (!date) return EMPTY;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return 'en el futuro';
  if (seconds < 60) return 'hace segundos';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

/**
 * `+59171234567` → `+591····4567`.
 *
 * Spec §12.1: tables must not put full numbers on screen in bulk. The reveal
 * control and the CSV export are the two deliberate ways to see one.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return EMPTY;
  const trimmed = phone.trim();
  if (trimmed.length <= 8) return trimmed;
  const head = trimmed.startsWith('+') ? trimmed.slice(0, 4) : trimmed.slice(0, 3);
  const tail = trimmed.slice(-4);
  return `${head}····${tail}`;
}

/**
 * Same rule as phones — the driver list carries CI on every poll.
 *
 * Bolivian CIs are often written with a department suffix (`7654321 TJ`).
 * Spaces are dropped before slicing, so the reveal is four real characters
 * rather than a space padding out the tail.
 */
export function maskCi(ci: string | null | undefined): string {
  if (!ci) return EMPTY;
  const compact = ci.replace(/\s+/g, '');
  if (compact.length <= 4) return compact;
  return `····${compact.slice(-4)}`;
}

export function formatRating(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : `${value.toFixed(1)} ★`;
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : `${Math.round(value * 100)} %`;
}

export function formatCoords(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return EMPTY;
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** `YYYY-MM-DD` for *today* in La Paz — the history view's default range. */
export function todayInLaPaz(now = new Date()): string {
  // en-CA gives ISO-ordered parts, so this is a date-only ISO string.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function daysAgoInLaPaz(days: number, now = new Date()): string {
  return todayInLaPaz(new Date(now.getTime() - days * 86_400_000));
}

/**
 * Villa Montes is UTC-4 year round, with no DST (spec §2), so the offset is a
 * constant rather than something to derive per date.
 */
const LA_PAZ_UTC_OFFSET = '-04:00';

/**
 * Turns a local calendar date into the exact UTC instant it starts at.
 *
 * The history endpoint takes `datetime`, so a bare `YYYY-MM-DD` would arrive
 * without a zone and be compared as midnight UTC — four hours off, quietly
 * pulling in the tail of the previous local evening and dropping the last four
 * hours of the day the operator asked for.
 */
export function laPazDayStartIso(day: string): string | undefined {
  const start = laPazMidnight(day);
  return start ? start.toISOString() : undefined;
}

/** Exclusive upper bound: the start of the day after `day`. */
export function laPazDayEndIso(day: string): string | undefined {
  const start = laPazMidnight(day);
  return start ? new Date(start.getTime() + 86_400_000).toISOString() : undefined;
}

/**
 * Returns `null` rather than an invalid Date. A cleared date input yields an
 * empty string, and `toISOString()` on the resulting Invalid Date throws — from
 * inside render, which takes the whole view down. An absent bound is a fine
 * query; a crash is not.
 */
function laPazMidnight(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00${LA_PAZ_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}
