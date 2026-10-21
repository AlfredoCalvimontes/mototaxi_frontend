import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createCity, listCities } from '@/api/admin';
import type { City } from '@/api/types';
import { useAuth } from '@/auth/context';
import { ADMIN } from '@/auth/roles';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, FormDialog } from '@/components/Field';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/Skeleton';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.tenancy;

function NewCityDialog({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/La_Paz');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => createCity(tenantId, { name: name.trim(), timezone: timezone.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cities'] });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = strings.fleet.requiredField;
    if (!timezone.trim()) next.timezone = strings.fleet.requiredField;
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  }

  return (
    <FormDialog title={t.newCity} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t.cityName} value={name} onChange={setName} required error={errors.name} />
        <Field
          label={t.cityTimezone}
          value={timezone}
          onChange={setTimezone}
          required
          hint={t.cityTimezoneHint}
          error={errors.timezone}
        />
        {create.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(create.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {strings.common.cancel}
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {create.isPending ? strings.common.loading : strings.common.save}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

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
