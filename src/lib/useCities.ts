import { useQuery } from '@tanstack/react-query';

import { listAllCities, listCities } from '@/api/admin';
import { useAuth } from '@/auth/context';

/**
 * The cities the caller works with: their tenant's (or the one a superadmin is
 * acting as). A superadmin who has not picked an empresa gets the whole
 * platform catalog instead, so the city selector works at that level too.
 * Operators cannot list cities (the route is closed to them), so for them the
 * query stays off and the city UI hides itself.
 */
export function useCities() {
  const { user, actingAsTenant } = useAuth();
  const tenantId = user?.tenant_id ?? actingAsTenant;
  const platformWide = user?.role === 'SUPERADMIN' && !tenantId;
  const enabled =
    !!user && user.role !== 'OPERATOR' && user.role !== 'CUSTOMER' && (!!tenantId || platformWide);

  const query = useQuery({
    queryKey: ['cities', platformWide ? 'platform' : tenantId, 'selector'],
    queryFn: () =>
      platformWide ? listAllCities({ page_size: 100 }) : listCities(tenantId!, { page_size: 100 }),
    enabled,
  });

  const cities = query.data?.items ?? [];
  const byId = new Map(cities.map((c) => [c.city_id, c]));
  return { cities, byId, enabled, platformWide, isPending: enabled && query.isPending };
}
