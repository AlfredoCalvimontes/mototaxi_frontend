import { useTenantList } from '@/lib/useTenantList';
import { useAuth } from '@/auth/context';
import { strings } from '@/lib/strings';

/**
 * Superadmin "act as". Picking a tenant makes every request carry
 * `X-Tenant-Id` (see `AuthProvider`); picking none goes back to the read-only
 * cross-tenant view.
 */
export function TenantSwitcher() {
  const { user, actingAsTenant, setActingAsTenant } = useAuth();
  const isSuper = user?.role === 'SUPERADMIN';
  const tenants = useTenantList(isSuper);

  if (!isSuper) return null;

  return (
    <select
      aria-label={strings.tenancy.actAs}
      value={actingAsTenant ?? ''}
      onChange={(e) => setActingAsTenant(e.target.value || null)}
      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
    >
      <option value="">{strings.tenancy.pickTenant}</option>
      {(tenants.data?.items ?? [])
        .filter((tenant) => tenant.is_active)
        .map((tenant) => (
          <option key={tenant.tenant_id} value={tenant.tenant_id}>
            {tenant.name}
          </option>
        ))}
    </select>
  );
}
