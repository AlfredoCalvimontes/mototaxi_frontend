import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { createTenant, listTenants, setTenantActive } from '@/api/admin';
import type { Tenant } from '@/api/types';
import { useAuth } from '@/auth/context';
import { ActiveToggle } from '@/components/ActiveToggle';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, FormDialog } from '@/components/Field';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/Skeleton';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.tenancy;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function NewTenantDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () =>
      createTenant({
        name: name.trim(),
        slug: slug.trim(),
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenants'] });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = strings.fleet.requiredField;
    if (!SLUG_RE.test(slug.trim())) next.slug = t.tenantSlugHint;
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  }

  return (
    <FormDialog title={t.newTenant} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t.tenantName} value={name} onChange={setName} required error={errors.name} />
        <Field
          label={t.tenantSlug}
          value={slug}
          onChange={setSlug}
          required
          hint={t.tenantSlugHint}
          error={errors.slug}
        />
        <Field label={t.tenantContactEmail} value={email} onChange={setEmail} />
        <Field label={t.tenantContactPhone} type="tel" value={phone} onChange={setPhone} />
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

/** Superadmin: every tenant, provisioning, and the way into one ("Actuar como"). */
export default function Tenants() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setActingAsTenant } = useAuth();

  const tenants = useQuery({
    queryKey: ['tenants', page],
    queryFn: () => listTenants({ page }),
  });

  const columns: Column<Tenant>[] = [
    {
      id: 'name',
      header: t.tenantName,
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-medium text-slate-900">{x.name}</span>,
    },
    { id: 'slug', header: t.tenantSlug, sortValue: (x) => x.slug, cell: (x) => x.slug },
    {
      id: 'status',
      header: t.tenantStatus,
      sortValue: (x) => (x.is_active ? 1 : 0),
      cell: (x) => (
        <span className={x.is_active ? 'text-emerald-700' : 'text-slate-500'}>
          {x.is_active ? t.active : t.inactive}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: (x) => (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setActingAsTenant(x.tenant_id)}
            disabled={!x.is_active}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {t.actAs}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/tenants/${x.tenant_id}`)}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
          >
            {strings.common.edit}
          </button>
          <ActiveToggle
            active={x.is_active}
            activateLabel={t.activate}
            deactivateLabel={t.deactivate}
            confirmTitle={t.deactivateTenantTitle}
            confirmBody={t.deactivateTenantBody(x.name)}
            toggle={(next) => setTenantActive(x.tenant_id, next)}
            onDone={() => void queryClient.invalidateQueries({ queryKey: ['tenants'] })}
          />
        </div>
      ),
    },
  ];

  if (tenants.isPending) return <TableSkeleton rows={5} />;
  if (tenants.isError) {
    return <ErrorState error={tenants.error} onRetry={() => void tenants.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{t.tenantsHeading}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.newTenant}
        </button>
      </div>
      <DataTable
        rows={tenants.data.items}
        columns={columns}
        rowKey={(x) => x.tenant_id}
        caption={t.tenantsHeading}
        searchPlaceholder={strings.common.search}
        initialSort={{ columnId: 'name', direction: 'asc' }}
      />
      <Pager page={tenants.data.page} pages={tenants.data.pages} onPage={setPage} />
      {creating && <NewTenantDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
