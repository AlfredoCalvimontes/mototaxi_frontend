import { useQuery } from '@tanstack/react-query';

import { listTenants } from '@/api/admin';
import type { Paginated, Tenant } from '@/api/types';

const PAGE_SIZE = 100;

/**
 * Every tenant, not just the first page: the names in the platform tables and
 * the switcher must resolve for tenants beyond the first 100.
 */
async function listEveryTenant(): Promise<Paginated<Tenant>> {
  const first = await listTenants({ page: 1, page_size: PAGE_SIZE });
  const rest = await Promise.all(
    Array.from({ length: Math.max(first.pages - 1, 0) }, (_, i) =>
      listTenants({ page: i + 2, page_size: PAGE_SIZE }),
    ),
  );
  return { ...first, items: [first, ...rest].flatMap((p) => p.items) };
}

/** Tenants for the switcher and the banner; one cached query serves both. */
export function useTenantList(enabled: boolean) {
  return useQuery({
    queryKey: ['tenants', 'switcher'],
    queryFn: listEveryTenant,
    enabled,
    staleTime: 60_000,
  });
}
