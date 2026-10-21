import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getKpisByTenant, getUsage, listAuditLogs } from '@/api/admin';
import type { AuditEntry, TenantUsage, TripKpiGroup } from '@/api/types';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, SelectField } from '@/components/Field';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/Skeleton';
import { EMPTY, formatDateTime, formatDuration, formatRating } from '@/lib/format';
import { strings } from '@/lib/strings';
import { useTenantList } from '@/lib/useTenantList';

const t = strings.platform;

function useTenantNames() {
  const tenants = useTenantList(true);
  const names = new Map((tenants.data?.items ?? []).map((x) => [x.tenant_id, x.name]));
  return (id: string | null) => (id ? (names.get(id) ?? id) : EMPTY);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function KpiByTenant() {
  const nameOf = useTenantNames();
  const [hours, setHours] = useState('24');
  const kpis = useQuery({
    queryKey: ['kpis', 'by-tenant', hours],
    queryFn: () => getKpisByTenant(Number(hours)),
  });

  const columns: Column<TripKpiGroup>[] = [
    {
      id: 'tenant',
      header: t.tenant,
      sortValue: (g) => nameOf(g.group_uuid),
      cell: (g) => <span className="font-medium text-slate-900">{nameOf(g.group_uuid)}</span>,
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
    <Section title={t.kpiHeading}>
      <div className="max-w-xs">
        <SelectField
          label={t.window}
          value={hours}
          onChange={setHours}
          options={Object.entries(t.windowOptions).map(([value, label]) => ({ value, label }))}
        />
      </div>
      {kpis.isPending ? (
        <TableSkeleton rows={3} />
      ) : kpis.isError ? (
        <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />
      ) : (
        <DataTable
          rows={kpis.data}
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

/** `YYYY-MM-DD` from a date input to the start/end of that day in UTC. */
function dayBound(date: string, end: boolean): string | undefined {
  return date ? `${date}T${end ? '23:59:59' : '00:00:00'}Z` : undefined;
}

function Usage() {
  const nameOf = useTenantNames();
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const usage = useQuery({
    queryKey: ['usage', since, until],
    queryFn: () => getUsage({ since: dayBound(since, false), until: dayBound(until, true) }),
  });

  const columns: Column<TenantUsage>[] = [
    {
      id: 'tenant',
      header: t.tenant,
      sortValue: (u) => nameOf(u.tenant_uuid),
      cell: (u) => <span className="font-medium text-slate-900">{nameOf(u.tenant_uuid)}</span>,
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
    <Section title={t.usageHeading}>
      <p className="text-xs text-slate-500">{t.usageHint}</p>
      <div className="grid max-w-md gap-3 sm:grid-cols-2">
        <Field label={t.since} type="date" value={since} onChange={setSince} />
        <Field label={t.until} type="date" value={until} onChange={setUntil} />
      </div>
      {usage.isPending ? (
        <TableSkeleton rows={3} />
      ) : usage.isError ? (
        <ErrorState error={usage.error} onRetry={() => void usage.refetch()} />
      ) : (
        <DataTable
          rows={usage.data}
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

function AuditLog() {
  const nameOf = useTenantNames();
  const tenants = useTenantList(true);
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
    <Section title={t.auditHeading}>
      <div className="grid max-w-md gap-3 sm:grid-cols-2">
        <SelectField
          label={t.tenant}
          value={tenant}
          onChange={(value) => {
            setTenant(value);
            setPage(1);
          }}
          options={[
            { value: '', label: t.auditAllTenants },
            ...(tenants.data?.items ?? []).map((x) => ({ value: x.tenant_id, label: x.name })),
          ]}
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

/** Superadmin operations: cross-tenant numbers, usage and the audit trail. Tables, no charts. */
export default function Platform() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
      <KpiByTenant />
      <Usage />
      <AuditLog />
    </div>
  );
}
