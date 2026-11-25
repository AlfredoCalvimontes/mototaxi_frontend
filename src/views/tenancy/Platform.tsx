import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getKpisByTenant, getUsage, listAuditLogs } from '@/api/admin';
import type { AuditEntry, TenantUsage, TripKpiGroup } from '@/api/types';
import { useAuth } from '@/auth/context';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, SelectField } from '@/components/Field';
import { FilterBar, SelectFilter } from '@/components/Filters';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/Skeleton';
import { EMPTY, formatDateTime, formatDuration, formatRating } from '@/lib/format';
import { strings } from '@/lib/strings';
import { useActingTenantName } from '@/lib/useActingTenantName';
import { useCities } from '@/lib/useCities';
import { useTenantList } from '@/lib/useTenantList';

const t = strings.platform;

/**
 * Who the Platform view is about. A superadmin with no empresa picked sees every
 * empresa and can filter by one; acting as an empresa, the view is that empresa's
 * own numbers, so the empresa filter and the audit trail (platform-wide) are hidden.
 */
function usePlatformContext() {
  const { user, actingAsTenant } = useAuth();
  const platformWide = user?.role === 'SUPERADMIN' && !actingAsTenant;
  // Empresas list is superadmin-only; it is only needed for names and the empresa filter.
  const tenants = useTenantList(platformWide);
  const names = useMemo(
    () => new Map((tenants.data?.items ?? []).map((x) => [x.tenant_id, x.name])),
    [tenants.data],
  );
  // Acting as an empresa, the list is not loaded: its own name is the only one shown.
  const ownName = useActingTenantName();
  const nameOf = (id: string | null) => {
    if (!id) return EMPTY;
    if (!platformWide && id === actingAsTenant) return ownName ?? EMPTY;
    return names.get(id) ?? (platformWide ? id : EMPTY);
  };
  const { cities } = useCities();
  return { platformWide, tenants: tenants.data?.items ?? [], nameOf, cities };
}

/** One section's own filters. Each section has its own, so they never fight. */
type Scope = { tenant: string; city: string };

function ScopeFilters({
  scope,
  onScope,
  platformWide,
  tenants,
  cities,
}: {
  scope: Scope;
  onScope: (next: Scope) => void;
  platformWide: boolean;
  tenants: { tenant_id: string; name: string }[];
  cities: { city_id: string; name: string; tenant_id: string }[];
}) {
  const cityOptions = cities
    .filter((c) => !scope.tenant || c.tenant_id === scope.tenant)
    .map((c) => ({ value: c.city_id, label: c.name }));
  return (
    <>
      {platformWide && (
        <SelectFilter
          label={strings.filters.tenant}
          value={scope.tenant}
          // A city of another empresa stops applying once the empresa changes.
          onChange={(tenant) => onScope({ tenant, city: '' })}
          allLabel={t.allTenants}
          options={tenants.map((x) => ({ value: x.tenant_id, label: x.name }))}
        />
      )}
      <SelectFilter
        label={strings.filters.city}
        value={scope.city}
        onChange={(city) => onScope({ ...scope, city })}
        allLabel={strings.filters.allCities}
        options={cityOptions}
      />
    </>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-base font-semibold text-slate-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

function KpiByTenant({ ctx }: { ctx: ReturnType<typeof usePlatformContext> }) {
  const [hours, setHours] = useState('24');
  const [scope, setScope] = useState<Scope>({ tenant: '', city: '' });
  const kpis = useQuery({
    queryKey: ['kpis', 'by-tenant', hours, scope.city],
    queryFn: () => getKpisByTenant(Number(hours), scope.city || null),
  });
  const rows = (kpis.data ?? []).filter((g) => !scope.tenant || g.group_uuid === scope.tenant);

  const columns: Column<TripKpiGroup>[] = [
    {
      id: 'tenant',
      header: t.tenant,
      sortValue: (g) => ctx.nameOf(g.group_uuid),
      cell: (g) => <span className="font-medium text-slate-900">{ctx.nameOf(g.group_uuid)}</span>,
    },
    {
      id: 'trips',
      header: t.trips,
      align: 'right',
      sortValue: (g) => g.trips,
      cell: (g) => g.trips,
    },
    { id: 'completed', header: t.completed, align: 'right', cell: (g) => g.completed },
    {
      id: 'cancelled',
      header: t.cancelled,
      align: 'right',
      secondary: true,
      cell: (g) => g.cancelled,
    },
    {
      id: 'noDriver',
      header: t.noDriver,
      align: 'right',
      secondary: true,
      cell: (g) => g.no_driver,
    },
    {
      id: 'reach',
      header: t.averageReach,
      align: 'right',
      secondary: true,
      cell: (g) => formatDuration(g.average_reach_time_seconds),
    },
    {
      id: 'rating',
      header: t.rating,
      align: 'right',
      secondary: true,
      cell: (g) => formatRating(g.average_rating),
    },
  ];

  return (
    <Section title={t.kpiHeading} id="platform-kpi-heading">
      <FilterBar
        active={!!(scope.tenant || scope.city) || hours !== '24'}
        onClear={() => {
          setScope({ tenant: '', city: '' });
          setHours('24');
        }}
      >
        <ScopeFilters
          scope={scope}
          onScope={setScope}
          platformWide={ctx.platformWide}
          tenants={ctx.tenants}
          cities={ctx.cities}
        />
        <div className="w-52">
          <SelectField
            label={t.window}
            value={hours}
            onChange={setHours}
            options={Object.entries(t.windowOptions).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </FilterBar>
      {kpis.isPending ? (
        <TableSkeleton rows={3} />
      ) : kpis.isError ? (
        <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(g) => g.group_uuid ?? 'none'}
          caption={t.kpiHeading}
          emptyMessage={t.noRows}
          initialSort={{ columnId: 'trips', direction: 'desc' }}
        />
      )}
    </Section>
  );
}

function Usage({ ctx }: { ctx: ReturnType<typeof usePlatformContext> }) {
  const [hours, setHours] = useState('720');
  const [scope, setScope] = useState<Scope>({ tenant: '', city: '' });
  const usage = useQuery({
    queryKey: ['usage', hours, scope.city],
    queryFn: () =>
      getUsage({
        // The window ends now and starts `hours` earlier, like the trips table.
        since: new Date(Date.now() - Number(hours) * 3_600_000).toISOString(),
        city_uuid: scope.city || undefined,
      }),
  });
  const rows = (usage.data ?? []).filter((u) => !scope.tenant || u.tenant_uuid === scope.tenant);

  const columns: Column<TenantUsage>[] = [
    {
      id: 'tenant',
      header: t.tenant,
      sortValue: (u) => ctx.nameOf(u.tenant_uuid),
      cell: (u) => <span className="font-medium text-slate-900">{ctx.nameOf(u.tenant_uuid)}</span>,
    },
    {
      id: 'drivers',
      header: t.activeDrivers,
      align: 'right',
      sortValue: (u) => u.active_drivers,
      cell: (u) => u.active_drivers,
    },
    {
      id: 'vehicles',
      header: t.vehicles,
      align: 'right',
      sortValue: (u) => u.vehicles,
      cell: (u) => u.vehicles,
    },
    {
      id: 'trips',
      header: t.trips,
      align: 'right',
      sortValue: (u) => u.trips,
      cell: (u) => u.trips,
    },
    {
      id: 'in',
      header: t.inbound,
      align: 'right',
      secondary: true,
      sortValue: (u) => u.inbound_messages,
      cell: (u) => u.inbound_messages,
    },
    {
      id: 'out',
      header: t.outbound,
      align: 'right',
      secondary: true,
      sortValue: (u) => u.outbound_messages,
      cell: (u) => u.outbound_messages,
    },
  ];

  return (
    <Section title={t.usageHeading} id="platform-usage-heading">
      <p className="text-xs text-slate-500">{t.usageHint}</p>
      <FilterBar
        active={!!(scope.tenant || scope.city) || hours !== '720'}
        onClear={() => {
          setScope({ tenant: '', city: '' });
          setHours('720');
        }}
      >
        <ScopeFilters
          scope={scope}
          onScope={setScope}
          platformWide={ctx.platformWide}
          tenants={ctx.tenants}
          cities={ctx.cities}
        />
        <div className="w-52">
          <SelectField
            label={t.window}
            value={hours}
            onChange={setHours}
            options={Object.entries(t.windowOptions).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </FilterBar>
      {usage.isPending ? (
        <TableSkeleton rows={3} />
      ) : usage.isError ? (
        <ErrorState error={usage.error} onRetry={() => void usage.refetch()} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(u) => u.tenant_uuid}
          caption={t.usageHeading}
          emptyMessage={t.noRows}
          initialSort={{ columnId: 'trips', direction: 'desc' }}
        />
      )}
    </Section>
  );
}

function Json({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function AuditLog({ ctx }: { ctx: ReturnType<typeof usePlatformContext> }) {
  const nameOf = ctx.nameOf;
  const [page, setPage] = useState(1);
  const [tenant, setTenant] = useState('');
  const [table, setTable] = useState('');

  const audit = useQuery({
    queryKey: ['audit', page, tenant, table],
    queryFn: () =>
      listAuditLogs({
        page,
        page_size: 25,
        tenant_id: tenant || undefined,
        table_name: table.trim() || undefined,
      }),
  });

  const columns: Column<AuditEntry>[] = [
    {
      id: 'when',
      header: t.when,
      cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.created_at)}</span>,
    },
    { id: 'tenant', header: t.tenant, secondary: true, cell: (e) => nameOf(e.tenant_uuid) },
    { id: 'table', header: t.auditTable, cell: (e) => e.table_name },
    { id: 'action', header: t.action, cell: (e) => e.action },
    {
      id: 'entity',
      header: t.entity,
      secondary: true,
      cell: (e) => <span className="font-mono text-xs">{e.entity_id.slice(0, 8)}</span>,
    },
    {
      id: 'actor',
      header: t.actor,
      secondary: true,
      cell: (e) => <span className="font-mono text-xs">{e.actor_id?.slice(0, 8) ?? EMPTY}</span>,
    },
    {
      id: 'details',
      header: t.details,
      cell: (e) =>
        e.before || e.after ? (
          <details>
            <summary className="cursor-pointer text-xs underline">{t.details}</summary>
            <div className="mt-2 space-y-2">
              <Json label={t.before} value={e.before} />
              <Json label={t.after} value={e.after} />
            </div>
          </details>
        ) : (
          EMPTY
        ),
    },
  ];

  return (
    <Section title={t.auditHeading} id="platform-audit-heading">
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <SelectFilter
          label={strings.filters.tenant}
          value={tenant}
          onChange={(value) => {
            setTenant(value);
            setPage(1);
          }}
          allLabel={t.allTenants}
          options={ctx.tenants.map((x) => ({ value: x.tenant_id, label: x.name }))}
        />
        <Field
          label={t.auditTable}
          value={table}
          onChange={(value) => {
            setTable(value);
            setPage(1);
          }}
        />
      </div>
      {audit.isPending ? (
        <TableSkeleton rows={4} />
      ) : audit.isError ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : (
        <>
          <DataTable
            rows={audit.data.items}
            columns={columns}
            rowKey={(e) => e.audit_log_uuid}
            caption={t.auditHeading}
            emptyMessage={t.noAudit}
          />
          <Pager page={audit.data.page} pages={audit.data.pages} onPage={setPage} />
        </>
      )}
    </Section>
  );
}

/** Superadmin view: trips and usage per empresa and per city, and the audit trail. */
export default function Platform() {
  const ctx = usePlatformContext();
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
      {/* Cross-empresa figures: a business acting as itself sees only its own usage below. */}
      {ctx.platformWide && <KpiByTenant ctx={ctx} />}
      <Usage ctx={ctx} />
      {ctx.platformWide && <AuditLog ctx={ctx} />}
    </div>
  );
}
