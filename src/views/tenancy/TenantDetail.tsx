import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getTenant, setMainBusiness, setTenantActive, updateTenant } from '@/api/admin';
import type { Tenant } from '@/api/types';
import { useAuth } from '@/auth/context';
import { ActiveToggle } from '@/components/ActiveToggle';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { hasChanges, tenantChanges, type TenantFormValues } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.tenancy;

function toValues(tenant: Tenant): TenantFormValues {
  return {
    name: tenant.name,
    contact_email: tenant.contact_email ?? '',
    contact_phone: tenant.contact_phone ?? '',
  };
}

/** "Mi empresa" for a tenant admin; any tenant for a superadmin. */
export default function TenantDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const queryClient = useQueryClient();

  const tenant = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => getTenant(tenantId!),
    enabled: !!tenantId,
  });

  if (tenant.isPending) return <TableSkeleton rows={3} />;
  if (tenant.isError) {
    return <ErrorState error={tenant.error} onRetry={() => void tenant.refetch()} />;
  }

  return (
    <TenantForm
      tenant={tenant.data}
      onSaved={() => {
        void queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
        void queryClient.invalidateQueries({ queryKey: ['tenants'] });
      }}
    />
  );
}

function TenantForm({ tenant, onSaved }: { tenant: Tenant; onSaved: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // A superadmin came from the list of empresas; a tenant admin has no list.
  const backTo = user?.role === 'SUPERADMIN' ? '/tenants' : '/';
  const backLabel = user?.role === 'SUPERADMIN' ? t.backToTenants : t.backToPanel;
  const initial = toValues(tenant);
  const [values, setValues] = useState<TenantFormValues>(initial);
  const [validation, setValidation] = useState<Partial<Record<string, string>>>({});

  const { payload, unclearable } = tenantChanges(initial, values);

  const save = useMutation({
    mutationFn: () => updateTenant(tenant.tenant_id, payload),
    onSuccess: onSaved,
  });
  const isSuperadmin = user?.role === 'SUPERADMIN';
  const toggleMain = useMutation({
    mutationFn: () => setMainBusiness(tenant.tenant_id, !tenant.is_default),
    onSuccess: onSaved,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.name.trim()) errors.name = strings.fleet.requiredField;
    setValidation(errors);
    if (Object.keys(errors).length > 0 || !hasChanges(payload)) return;
    save.mutate();
  }

  return (
    <div className="space-y-4">
      <Link to={backTo} className="inline-block text-sm text-slate-600 hover:text-slate-900">
        ← {backLabel}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {tenant.name}
            {tenant.is_default && (
              <span className="ml-2 align-middle text-xs font-medium text-emerald-700">
                {t.mainBusinessBadge}
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500">{tenant.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={tenant.is_active ? 'text-emerald-700' : 'text-slate-500'}>
            {tenant.is_active ? t.active : t.inactive}
          </span>
          {user?.role === 'SUPERADMIN' && (
            <ActiveToggle
              active={tenant.is_active}
              activateLabel={t.activate}
              deactivateLabel={t.deactivate}
              confirmTitle={t.deactivateTenantTitle}
              confirmBody={t.deactivateTenantBody(tenant.name)}
              toggle={(next) => setTenantActive(tenant.tenant_id, next)}
              onDone={onSaved}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/tenants/${tenant.tenant_id}/cities`}
          className="inline-block rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t.citiesLink}
        </Link>
      </div>

      {isSuperadmin && (
        <div className="max-w-md space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{t.mainBusiness}</h2>
            <button
              type="button"
              disabled={toggleMain.isPending || (!tenant.is_default && !tenant.is_active)}
              onClick={() => toggleMain.mutate()}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {tenant.is_default ? t.removeMainBusiness : t.makeMainBusiness}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t.mainBusinessHint}</p>
          {toggleMain.error != null && (
            <p role="alert" className="text-sm text-red-800">
              {errorText(toggleMain.error)}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md space-y-4" noValidate>
        <Field
          label={t.tenantName}
          value={values.name}
          onChange={(name) => setValues((v) => ({ ...v, name }))}
          required
          error={validation.name}
        />
        <Field
          label={t.tenantContactEmail}
          value={values.contact_email}
          onChange={(contact_email) => setValues((v) => ({ ...v, contact_email }))}
        />
        <Field
          label={t.tenantContactPhone}
          type="tel"
          value={values.contact_phone}
          onChange={(contact_phone) => setValues((v) => ({ ...v, contact_phone }))}
        />

        {unclearable.length > 0 && (
          <p
            role="alert"
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {strings.fleet.cannotClearFields}
          </p>
        )}
        {save.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(save.error)}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? strings.common.loading : strings.common.save}
          </button>
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {strings.common.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
