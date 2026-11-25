/**
 * Small helpers the list views share for client-side filtering. The lists are
 * short (one fleet, one day), so they are loaded whole and narrowed here.
 */

/** Lower-cased, accent-free text, so «Perez» finds «Pérez». */
export function norm(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Whether any of the *fields* contains the search text (empty search matches all). */
export function matchesText(fields: (string | null | undefined)[], query: string): boolean {
  const needle = norm(query).trim();
  if (!needle) return true;
  return fields.some((field) => norm(field).includes(needle));
}

/**
 * A `datetime-local` value («2026-11-24T08:30») read as La Paz wall time, which
 * is how the operator thinks of it (UTC−4, no daylight saving). `null` for an
 * empty or unparsable value.
 */
export function localInputToDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}:00-04:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ISO instant of the *last millisecond* of the typed minute, for an inclusive
 * upper bound: «23:59» means «up to and including 23:59:59».
 */
export function localInputEndIso(value: string): string | undefined {
  const date = localInputToDate(value);
  return date ? new Date(date.getTime() + 59_999).toISOString() : undefined;
}

/** ISO instant for a `datetime-local` value, for API query params. */
export function localInputToIso(value: string): string | undefined {
  return localInputToDate(value)?.toISOString();
}

/**
 * Whether *iso* falls inside the window. Either end may be empty (open); the
 * end is inclusive to the minute the operator typed.
 */
export function inWindow(iso: string | null | undefined, from: string, to: string): boolean {
  const start = localInputToDate(from);
  const end = localInputToDate(to);
  if (!start && !end) return true;
  if (!iso) return false;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return false;
  if (start && at < start.getTime()) return false;
  if (end && at > end.getTime() + 59_999) return false;
  return true;
}
