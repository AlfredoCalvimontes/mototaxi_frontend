import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { deleteWhatsAppConfig, listWhatsAppConfigs, setWhatsAppConfig } from '@/api/admin';
import type { WhatsAppConfig as Config } from '@/api/types';
import { useAuth } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { errorText } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { strings } from '@/lib/strings';
import { useTenantList } from '@/lib/useTenantList';

const t = strings.whatsapp;

/**
 * The token is write-only: it is never read back, so the field always starts
 * empty and a blank value on an update means "keep the stored one".
 */
function ConfigForm({
  tenantName,
  config,
  onDone,
}: {
  tenantName: string;
  config: Config | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [phoneNumberId, setPhoneNumberId] = useState(config?.phone_number_id ?? '');
  const [token, setToken] = useState('');
  const [waba, setWaba] = useState(config?.waba_id ?? '');
  const [display, setDisplay] = useState(config?.display_phone_number ?? '');
  const [isActive, setIsActive] = useState(config?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      setWhatsAppConfig({
        phone_number_id: phoneNumberId.trim(),
        ...(token.trim() && { access_token: token.trim() }),
        waba_id: waba.trim() || null,
        display_phone_number: display.trim() || null,
        is_active: isActive,
      }),
    onSuccess: () => {
      setToken('');
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-configs'] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteWhatsAppConfig,
    onSuccess: () => {
      setRemoving(false);
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-configs'] });
      onDone();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const next: Record<string, string> = {};
    if (!phoneNumberId.trim()) next.phone = strings.fleet.requiredField;
    if (!config && !token.trim()) next.token = t.tokenRequired;
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="text-base font-semibold text-slate-900">
        {config ? t.edit : t.configure} — {tenantName}
      </h2>
      {!config && <p className="text-sm text-slate-600">{t.notConfigured}</p>}
      <Field
        label={t.phoneNumberId}
        value={phoneNumberId}
        onChange={setPhoneNumberId}
        required
        error={errors.phone}
      />
      <div className="space-y-1">
        <Field
          label={t.accessToken}
          type="password"
          value={token}
          onChange={setToken}
          required={!config}
          hint={config ? t.tokenHintEdit : t.tokenHintNew}
          error={errors.token}
        />
      </div>
      <Field label={t.waba} value={waba} onChange={setWaba} />
      <Field label={t.displayNumber} value={display} onChange={setDisplay} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {t.isActive}
      </label>

      {save.error != null && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorText(save.error)}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          {t.saved}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {save.isPending ? strings.common.loading : strings.common.save}
        </button>
        {config && (
          <button
            type="button"
            onClick={() => setRemoving(true)}
            className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            {t.remove}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={removing}
        title={t.removeTitle}
        body={t.removeBody(tenantName)}
        confirmLabel={t.remove}
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
        onClose={() => setRemoving(false)}
      />
    </form>
  );
}

/** Superadmin: every tenant's WhatsApp number, and the form for the one being acted as. */
export default function WhatsAppConfig() {
  const { actingAsTenant } = useAuth();
  const tenants = useTenantList(true);

  const configs = useQuery({
    // The list is scoped to the acted-as tenant, so the key follows it.
    queryKey: ['whatsapp-configs', actingAsTenant],
    queryFn: listWhatsAppConfigs,
  });

  if (configs.isPending) return <TableSkeleton rows={3} />;
  if (configs.isError) {
    return <ErrorState error={configs.error} onRetry={() => void configs.refetch()} />;
  }

  const names = new Map((tenants.data?.items ?? []).map((x) => [x.tenant_id, x.name]));
  const nameOf = (id: string) => names.get(id) ?? id;

  const columns: Column<Config>[] = [
    {
      id: 'tenant',
      header: t.tenant,
      sortValue: (c) => nameOf(c.tenant_uuid),
      cell: (c) => <span className="font-medium text-slate-900">{nameOf(c.tenant_uuid)}</span>,
    },
    { id: 'number', header: t.displayNumber, cell: (c) => c.display_phone_number ?? '—' },
    { id: 'phone', header: t.phoneNumberId, secondary: true, cell: (c) => c.phone_number_id },
    { id: 'waba', header: t.waba, secondary: true, cell: (c) => c.waba_id ?? '—' },
    {
      id: 'status',
      header: t.status,
      sortValue: (c) => (c.is_active ? 1 : 0),
      cell: (c) => (
        <span className={c.is_active ? 'text-emerald-700' : 'text-slate-500'}>
          {c.is_active ? t.active : t.inactive}
        </span>
      ),
    },
    {
      id: 'updated',
      header: t.updated,
      secondary: true,
      cell: (c) => formatDateTime(c.updated_at),
    },
  ];

  const current = actingAsTenant
    ? (configs.data.find((c) => c.tenant_uuid === actingAsTenant) ?? null)
    : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
      <p className="text-sm text-slate-600">{t.intro}</p>

      {configs.data.length === 0 ? (
        <p className="text-sm text-slate-500">{t.none}</p>
      ) : (
        <DataTable
          rows={configs.data}
          columns={columns}
          rowKey={(c) => c.tenant_uuid}
          caption={t.heading}
          initialSort={{ columnId: 'tenant', direction: 'asc' }}
        />
      )}

      {actingAsTenant ? (
        // Re-keyed so switching tenant or saving starts the form from the server's state.
        <ConfigForm
          key={`${actingAsTenant}:${current?.updated_at ?? 'new'}`}
          tenantName={nameOf(actingAsTenant)}
          config={current}
          onDone={() => undefined}
        />
      ) : (
        <p className="text-sm text-slate-500">{t.pickTenant}</p>
      )}
    </div>
  );
}
