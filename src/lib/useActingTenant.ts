import { useQuery } from '@tanstack/react-query';

import { getTenant } from '@/api/admin';
import type { Tenant } from '@/api/types';
import { useAuth } from '@/auth/context';

/**
 * The empresa the caller works in: their own, or the one a superadmin acts as.
 * Reads the single tenant, so it works for a business user too (the full tenant
 * list is superadmin-only and would 403). `null` while unknown or not readable.
 */
export function useActingTenant(): Tenant | null {
  const { user, actingAsTenant } = useAuth();
  const tenantId = user?.tenant_id ?? actingAsTenant;
  // Operators cannot read their empresa record (the backend keeps it to admins).
  const canRead = !!user && user.role !== 'OPERATOR' && user.role !== 'CUSTOMER';
  const query = useQuery({
    queryKey: ['tenant', tenantId, 'acting'],
    queryFn: () => getTenant(tenantId!),
    enabled: !!tenantId && canRead,
    staleTime: 60_000,
  });
  return query.data ?? null;
}

/** Whether the empresa the caller works in is the main business. */
export function useIsMainBusiness(): boolean {
  return useActingTenant()?.is_default === true;
}
