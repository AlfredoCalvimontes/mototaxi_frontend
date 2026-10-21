import { useQuery } from '@tanstack/react-query';

import { listCities } from '@/api/admin';
import { useAuth } from '@/auth/context';

/**
 * The cities of the tenant the caller works in: their own, or the one a
 * superadmin is acting as. Operators cannot list cities (the route is closed to
 * them), so for them the query stays off and the city UI hides itself.
 */
export function useCities() {
  const { user, actingAsTenant } = useAuth();
  const tenantId = user?.tenant_id ?? actingAsTenant;
  const enabled = !!tenantId && !!user && user.role !== 'OPERATOR' && user.role !== 'CUSTOMER';

  const query = useQuery({
    queryKey: ['cities', tenantId, 'selector'],
    queryFn: () => listCities(tenantId!, { page_size: 100 }),
    enabled,
  });

  const cities = query.data?.items ?? [];
  const byId = new Map(cities.map((c) => [c.city_id, c]));
  return { cities, byId, enabled, isPending: enabled && query.isPending };
}
