import type { UserProfile } from '@/api/types';
import { ADMIN, STAFF } from '@/auth/roles';
import { strings } from '@/lib/strings';

export type NavItem = { to: string; label: string; end: boolean };

/**
 * The top menu, in the order the Super Admin asked for. Each entry is shown to
 * the roles that can use it, and a business sees only its own empresa's entries
 * (no Empresas list, no platform-wide cities).
 */
export function navItemsFor(user: UserProfile | null, actingAsTenant: string | null): NavItem[] {
  if (!user) return [];
  const role = user.role;
  const tenantId = user.tenant_id ?? actingAsTenant;
  const platformWide = role === 'SUPERADMIN' && !actingAsTenant;
  const items: NavItem[] = [{ to: '/', label: strings.nav.dashboard, end: true }];
  items.push({ to: '/viajes', label: strings.nav.liveTrips, end: false });
  // Fleet pages are tenant-admin only until city scoping lands (P4).
  if (role === 'TENANT_ADMIN' || role === 'SUPERADMIN') {
    items.push({ to: '/vehiculos', label: strings.nav.vehicles, end: false });
    items.push({ to: '/conductores', label: strings.nav.drivers, end: false });
  }
  items.push({ to: '/clientes', label: strings.nav.customers, end: false });
  if (ADMIN.includes(role)) {
    items.push({ to: '/whatsapp', label: strings.nav.whatsapp, end: false });
    items.push({ to: '/vehiculos/tipos', label: strings.nav.vehicleTypes, end: false });
    items.push({ to: '/planes', label: strings.nav.usagePlans, end: false });
    items.push({ to: '/usuarios', label: strings.nav.staffUsers, end: false });
  }
  if (platformWide) {
    items.push({ to: '/tenants', label: strings.nav.tenants, end: true });
    items.push({ to: '/cities', label: strings.nav.cities, end: true });
  } else {
    if (tenantId && (role === 'TENANT_ADMIN' || role === 'SUPERADMIN')) {
      items.push({ to: `/tenants/${tenantId}`, label: strings.nav.myTenant, end: true });
    }
    if (tenantId && role !== 'OPERATOR') {
      items.push({ to: `/tenants/${tenantId}/cities`, label: strings.nav.cities, end: false });
    }
  }
  if (STAFF.includes(role)) items.push({ to: '/reportes', label: strings.nav.reports, end: false });
  if (ADMIN.includes(role))
    items.push({ to: '/configuracion', label: strings.nav.settings, end: false });
  return items;
}
