import { useSearchParams } from 'react-router-dom';

/** The header city selector writes this URL param; list views read it. */
export const CITY_PARAM = 'city';

/** The selected city, or `null` for "all cities". */
export function useCityScope(): string | null {
  const [searchParams] = useSearchParams();
  return searchParams.get(CITY_PARAM) || null;
}

/**
 * The params for a view's single-purpose filter checkbox: the filter is on
 * (`value`) or off (`null`), and the selected city survives either way —
 * replacing the whole query would silently drop the operator's city.
 */
export function filterParams(
  current: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams();
  const city = current.get(CITY_PARAM);
  if (city) next.set(CITY_PARAM, city);
  if (value !== null) next.set(key, value);
  return next;
}
