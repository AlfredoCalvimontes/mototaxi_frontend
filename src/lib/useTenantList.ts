import { useQuery } from '@tanstack/react-query';

import { listTenants } from '@/api/admin';

/** Tenants for the switcher and the banner; one cached query serves both. */
export function useTenantList(enabled: boolean) {
  return useQuery({
    queryKey: ['tenants', 'switcher'],
    queryFn: () => listTenants({ page_size: 100 }),
    enabled,
    staleTime: 60_000,
  });
}
