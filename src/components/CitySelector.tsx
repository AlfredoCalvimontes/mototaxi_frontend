import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/auth/context';
import { CITY_PARAM } from '@/lib/cityScope';
import { strings } from '@/lib/strings';
import { useCities } from '@/lib/useCities';

/**
 * Header city scope. A city admin is fixed to their granted cities; a tenant
 * admin (or a superadmin acting as a tenant) can pick any or "all". The choice
 * lives in the `city` URL param, like the other list filters.
 *
 * An operator gets no selector: the cities route is closed to them, so their
 * scope cannot be resolved to a name.
 */
export function CitySelector() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get(CITY_PARAM) ?? '';

  const { cities, enabled } = useCities();

  if (!enabled || !user) return null;

  const options = cities.filter(
    (c) =>
      c.is_active && (user.role !== 'CITY_ADMIN' || (user.city_uuids ?? []).includes(c.city_id)),
  );

  function select(cityId: string) {
    const next = new URLSearchParams(searchParams);
    if (cityId) next.set(CITY_PARAM, cityId);
    else next.delete(CITY_PARAM);
    setSearchParams(next, { replace: true });
  }

  // A city admin with exactly one city has nothing to pick.
  if (user.role === 'CITY_ADMIN' && options.length <= 1) {
    return <span className="text-xs text-slate-500">{options[0]?.name ?? ''}</span>;
  }

  return (
    <select
      aria-label={strings.tenancy.cityFieldLabel}
      value={selected}
      onChange={(e) => select(e.target.value)}
      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
    >
      <option value="">{strings.tenancy.allCities}</option>
      {options.map((c) => (
        <option key={c.city_id} value={c.city_id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
