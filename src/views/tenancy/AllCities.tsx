import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { listAllCities } from '@/api/admin';
import type { City } from '@/api/types';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, SelectField } from '@/components/Field';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/Skeleton';
import { useTenantList } from '@/lib/useTenantList';
import { strings } from '@/lib/strings';

const t = strings.tenancy;

/** Superadmin: every city of the platform catalog, filterable by tenant and status. */
export default function AllCities() {
  const [page, setPage] = useState(1);
  const [tenant, setTenant] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const tenants = useTenantList(true);

  const cities = useQuery({
    queryKey: ['cities', 'all', page, tenant, status, search],
    queryFn: () =>
      listAllCities({
        page,
        tenant_id: tenant || undefined,
        active: status === '' ? undefined : status === 'active',
        q: search.trim() || undefined,
      }),
  });

  const tenantName = (id: string) =>
    tenants.data?.items.find((x) => x.tenant_id === id)?.name ?? id;

  const columns: Column<City>[] = [
    {
      id: 'name',
      header: t.cityName,
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-medium text-slate-900">{x.name}</span>,
    },
    {
      id: 'tenant',
      header: t.allCitiesTenant,
      sortValue: (x) => tenantName(x.tenant_id),
      cell: (x) => tenantName(x.tenant_id),
    },
    {
      id: 'timezone',
      header: t.cityTimezone,
      sortValue: (x) => x.timezone,
      cell: (x) => x.timezone,
    },
    {
      id: 'status',
      header: t.allCitiesStatus,
      sortValue: (x) => (x.is_active ? 1 : 0),
      cell: (x) => (
        <span className={x.is_active ? 'text-emerald-700' : 'text-slate-500'}>
          {x.is_active ? t.cityActive : t.cityInactive}
        </span>
      ),
    },
    {
      id: 'open',
      header: '',
      cell: (x) => (
        <Link
          to={`/tenants/${x.tenant_id}/cities/${x.city_id}`}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
        >
          {t.allCitiesOpen}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t.allCitiesHeading}</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label={t.allCitiesTenant}
          value={tenant}
          onChange={(value) => {
            setTenant(value);
            setPage(1);
          }}
          options={[
            { value: '', label: t.allCitiesAllTenants },
            ...(tenants.data?.items ?? []).map((x) => ({ value: x.tenant_id, label: x.name })),
          ]}
        />
        <SelectField
          label={t.allCitiesStatus}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: '', label: t.allCitiesAllStatus },
            { value: 'active', label: t.cityActive },
            { value: 'inactive', label: t.cityInactive },
          ]}
        />
        <Field
          label={t.allCitiesSearch}
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      </div>
      {cities.isPending ? (
        <TableSkeleton rows={5} />
      ) : cities.isError ? (
        <ErrorState error={cities.error} onRetry={() => void cities.refetch()} />
      ) : (
        <>
          <DataTable
            rows={cities.data.items}
            columns={columns}
            rowKey={(x) => x.city_id}
            caption={t.allCitiesCaption}
            searchPlaceholder={strings.common.search}
            initialSort={{ columnId: 'name', direction: 'asc' }}
            emptyMessage={t.allCitiesEmpty}
          />
          <Pager page={cities.data.page} pages={cities.data.pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
