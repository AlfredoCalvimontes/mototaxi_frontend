import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { listCities } from '@/api/admin';
import type { City } from '@/api/types';
import { useAuth } from '@/auth/context';
import { ADMIN } from '@/auth/roles';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { NewCityDialog } from '@/views/tenancy/NewCityDialog';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/Skeleton';
import { strings } from '@/lib/strings';

const t = strings.tenancy;

export default function Cities() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const cities = useQuery({
    queryKey: ['cities', tenantId, page],
    queryFn: () => listCities(tenantId!, { page }),
    enabled: !!tenantId,
  });

  const columns: Column<City>[] = [
    {
      id: 'name',
      header: t.cityName,
      sortValue: (c) => c.name,
      cell: (c) => <span className="font-medium text-slate-900">{c.name}</span>,
    },
    {
      id: 'timezone',
      header: t.cityTimezone,
      sortValue: (c) => c.timezone,
      cell: (c) => c.timezone,
    },
    {
      id: 'status',
      header: t.cityStatus,
      sortValue: (c) => (c.is_active ? 1 : 0),
      cell: (c) => (
        <span className={c.is_active ? 'text-emerald-700' : 'text-slate-500'}>
          {c.is_active ? t.cityActive : t.cityInactive}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (c) => (
        <button
          type="button"
          onClick={() => navigate(`/tenants/${tenantId}/cities/${c.city_id}`)}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
        >
          {strings.common.edit}
        </button>
      ),
    },
  ];

  if (cities.isPending) return <TableSkeleton rows={5} />;
  if (cities.isError) {
    return <ErrorState error={cities.error} onRetry={() => void cities.refetch()} />;
  }

  const canCreate = !!user && ADMIN.includes(user.role);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{t.citiesHeading}</h1>
        <div className="flex items-center gap-3">
          {canCreate && (
            <>
              <Link
                to={`/tenants/${tenantId}`}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                ← {t.backToTenant}
              </Link>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                {t.newCity}
              </button>
            </>
          )}
        </div>
      </div>

      {cities.data.items.length === 0 ? (
        <p className="text-sm text-slate-500">{t.noCities}</p>
      ) : (
        <DataTable
          rows={cities.data.items}
          columns={columns}
          rowKey={(c) => c.city_id}
          caption={t.citiesHeading}
          searchPlaceholder={strings.common.search}
          initialSort={{ columnId: 'name', direction: 'asc' }}
        />
      )}
      <Pager page={cities.data.page} pages={cities.data.pages} onPage={setPage} />
      {creating && tenantId && (
        <NewCityDialog tenantId={tenantId} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
