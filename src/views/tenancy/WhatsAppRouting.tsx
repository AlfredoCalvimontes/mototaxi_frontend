import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';

import {
  delegateCity,
  deleteRoutingNumber,
  listAllCities,
  listCityRouting,
  listPlatformRoutingNumbers,
  listRoutingNumbers,
  previewCityServing,
  saveCityNumber,
  savePlatformNumber,
  undelegateCity,
} from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type {
  CityRouting,
  DenyReason,
  RoutingNumber,
  RoutingRole,
  SaveNumberPayload,
  Serving,
} from '@/api/types';
import { useAuth } from '@/auth/context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, SelectField } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.routing;

/** The reason a city is refused, in the owner's words. */
function denyText(reason: DenyReason): string {
  if (reason === 'not_operating') return t.denyNotOperating;
  if (reason === 'no_coverage') return t.denyNoCoverage;
  return t.denyNumberUnavailable;
}

function numberLabel(n: RoutingNumber): string {
  return n.display_phone_number ?? n.phone_number_id;
}

function servingLabel(serving: Serving): string {
  if (serving.number) return numberLabel(serving.number);
  return serving.deny_reason ? denyText(serving.deny_reason) : t.previewNone;
}

/**
 * Number form. The token is required on every save: the backend keeps no
 * token for an update, so there is nothing to fall back to.
 */
function NumberForm({
  title,
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  initial: RoutingNumber | null;
  pending: boolean;
  error: unknown;
  onSubmit: (base: SaveNumberPayload) => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(initial?.phone_number_id ?? '');
  const [token, setToken] = useState('');
  const [waba, setWaba] = useState(initial?.waba_id ?? '');
  const [display, setDisplay] = useState(initial?.display_phone_number ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!phoneNumberId.trim()) next.phone = strings.fleet.requiredField;
    if (!token.trim()) next.token = t.tokenHint;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      phone_number_id: phoneNumberId.trim(),
      access_token: token.trim(),
      waba_id: waba.trim() || null,
      display_phone_number: display.trim() || null,
      is_active: isActive,
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={title}
      className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
      <Field
        label={t.phoneNumberId}
        value={phoneNumberId}
        onChange={setPhoneNumberId}
        required
        error={errors.phone}
      />
      <Field
        label={t.accessToken}
        type="password"
        value={token}
        onChange={setToken}
        required
        hint={t.tokenHint}
        error={errors.token}
      />
      <Field label={t.waba} value={waba} onChange={setWaba} />
      <Field label={t.displayNumber} value={display} onChange={setDisplay} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {t.isActive}
      </label>
      {error != null && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorText(error)}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? strings.common.loading : t.save}
        </button>
      </div>
    </form>
  );
}

/** Platform numbers the Super Admin can set. The city list is the superadmin catalog. */
function PlatformNumberForm({
  onDone,
  onSaved,
}: {
  onDone: () => void;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<RoutingRole>('MAIN');
  const [cityUuid, setCityUuid] = useState('');
  const [cityError, setCityError] = useState<string | undefined>();
  const catalog = useQuery({
    queryKey: ['cities', 'catalog-for-routing'],
    queryFn: () => listAllCities({ page_size: 100, active: true }),
  });

  const save = useMutation({
    mutationFn: (base: SaveNumberPayload) =>
      savePlatformNumber({
        ...base,
        role,
        city_uuid: role === 'CITY' ? cityUuid : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatsappRouting });
      onSaved(t.saved);
      onDone();
    },
  });

  const cityOptions = (catalog.data?.items ?? []).map((c) => ({
    value: c.city_id,
    label: c.name,
  }));

  return (
    <NumberForm
      title={t.platformNumbers}
      initial={null}
      pending={save.isPending}
      error={save.error}
      onCancel={onDone}
      onSubmit={(base) => {
        if (role === 'CITY' && !cityUuid) {
          setCityError(t.pickCity);
          return;
        }
        setCityError(undefined);
        save.mutate(base);
      }}
    >
      <SelectField
        label={t.role}
        value={role}
        onChange={(v) => setRole(v as RoutingRole)}
        options={[
          { value: 'MAIN', label: t.roleMain },
          { value: 'CITY', label: t.roleCity },
        ]}
      />
      {role === 'CITY' && (
        <div className="space-y-1">
          <SelectField
            label={t.cityOptional}
            value={cityUuid}
            onChange={setCityUuid}
            options={cityOptions}
            required
          />
          {cityError && <p className="text-sm text-red-700">{cityError}</p>}
        </div>
      )}
    </NumberForm>
  );
}

/** Routing for one city, and the Super Admin's actions on it. */
function CityActions({
  row,
  canWrite,
  onAssign,
  onRemoveOwn,
  onDelegate,
  onUndelegate,
  busy,
}: {
  row: CityRouting;
  canWrite: boolean;
  onAssign: () => void;
  onRemoveOwn: () => void;
  onDelegate: () => void;
  onUndelegate: () => void;
  busy: boolean;
}) {
  if (!canWrite) return <span className="text-slate-400">—</span>;
  const btn =
    'rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  return (
    <div className="flex flex-wrap gap-1">
      <button type="button" className={btn} onClick={onAssign} disabled={busy}>
        {row.own_city_number ? t.replaceNumber : t.assignNumber}
      </button>
      {row.delegated ? (
        <button type="button" className={btn} onClick={onUndelegate} disabled={busy}>
          {t.undelegate}
        </button>
      ) : (
        <button
          type="button"
          className={btn}
          onClick={onDelegate}
          disabled={busy || row.own_city_number !== null}
          title={row.own_city_number ? t.delegateHint : undefined}
        >
          {t.delegate}
        </button>
      )}
      {row.own_city_number && (
        <button
          type="button"
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          onClick={onRemoveOwn}
          disabled={busy}
        >
          {t.removeOwn}
        </button>
      )}
    </div>
  );
}

/** "¿Quién atiende una ciudad?" — the resolver's answer for one city. */
function ServingPreview({ cities }: { cities: CityRouting[] }) {
  const [cityUuid, setCityUuid] = useState('');
  const preview = useQuery({
    queryKey: ['whatsapp-routing', 'serving', cityUuid],
    queryFn: () => previewCityServing(cityUuid),
    enabled: cityUuid !== '',
  });
  return (
    <section aria-labelledby="serving-heading" className="space-y-2">
      <h2 id="serving-heading" className="text-sm font-semibold text-slate-900">
        {t.preview}
      </h2>
      <SelectField
        label={t.city}
        value={cityUuid}
        onChange={setCityUuid}
        options={[
          { value: '', label: t.previewPick },
          ...cities.map((c) => ({ value: c.city_uuid, label: c.city_name })),
        ]}
      />
      {preview.isError && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(preview.error)}
        </p>
      )}
      {preview.data && (
        <p role="status" className="text-sm text-slate-700">
          {servingLabel(preview.data)}
        </p>
      )}
    </section>
  );
}

/** Numbers table for the tenant or the platform. */
function NumbersTable({
  rows,
  caption,
  empty,
  canDelete,
  onDelete,
}: {
  rows: RoutingNumber[];
  caption: string;
  empty: string;
  canDelete: (n: RoutingNumber) => boolean;
  onDelete: (n: RoutingNumber) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  const columns: Column<RoutingNumber>[] = [
    {
      id: 'role',
      header: t.role,
      cell: (n) => (n.role === 'MAIN' ? t.roleMain : t.roleCity),
    },
    {
      id: 'number',
      header: t.displayNumber,
      cell: (n) => <span className="font-medium text-slate-900">{numberLabel(n)}</span>,
    },
    { id: 'phone', header: t.phoneNumberId, secondary: true, cell: (n) => n.phone_number_id },
    {
      id: 'status',
      header: t.status,
      cell: (n) => (
        <span className={n.is_active ? 'text-emerald-700' : 'text-slate-500'}>
          {n.is_active ? t.active : t.inactive}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t.actions,
      cell: (n) =>
        canDelete(n) ? (
          <button
            type="button"
            onClick={() => onDelete(n)}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            {t.remove}
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];
  return (
    <DataTable rows={rows} columns={columns} rowKey={(n) => n.number_uuid} caption={caption} />
  );
}

type Target = { cityUuid: string; cityName: string; existing: RoutingNumber | null };
type Removal = { number: RoutingNumber; label: string };

/** Platform numbers. Shown with or without an acted-as tenant: they are not tenant-scoped. */
function PlatformSection({
  rows,
  isSuper,
  formOpen,
  onOpenForm,
  onCloseForm,
  onRemove,
  onSaved,
}: {
  rows: RoutingNumber[];
  isSuper: boolean;
  formOpen: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onRemove: (n: RoutingNumber) => void;
  onSaved: (message: string) => void;
}) {
  return (
    <section aria-labelledby="platform-numbers-heading" className="space-y-2">
      <h2 id="platform-numbers-heading" className="text-sm font-semibold text-slate-900">
        {t.platformNumbers}
      </h2>
      <NumbersTable
        rows={rows}
        caption={t.platformNumbers}
        empty={t.noPlatformNumbers}
        canDelete={(n) => isSuper && n.scope === 'PLATFORM'}
        onDelete={onRemove}
      />
      {isSuper && !formOpen && (
        <button
          type="button"
          onClick={onOpenForm}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t.addPlatform}
        </button>
      )}
      {isSuper && formOpen && <PlatformNumberForm onDone={onCloseForm} onSaved={onSaved} />}
    </section>
  );
}

/**
 * WhatsApp routing per city. Tenant admins read their routes and the platform's
 * numbers; the Super Admin changes them (city actions act as the tenant that is
 * selected in the header).
 */
export default function WhatsAppRouting() {
  const { user, actingAsTenant } = useAuth();
  const queryClient = useQueryClient();
  // Nothing is fetched until the profile is known: until then the role is unknown.
  const ready = user !== null;
  const isSuper = user?.role === 'SUPERADMIN';
  const cityWrite = isSuper && actingAsTenant !== null;
  const needsTenant = ready && isSuper && actingAsTenant === null;

  const [target, setTarget] = useState<Target | null>(null);
  const [platformFormOpen, setPlatformFormOpen] = useState(false);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const cities = useQuery({
    queryKey: queryKeys.cityRouting(actingAsTenant),
    queryFn: listCityRouting,
    enabled: ready && !needsTenant,
  });
  const numbers = useQuery({
    queryKey: queryKeys.routingNumbers(actingAsTenant),
    queryFn: listRoutingNumbers,
    enabled: ready && !needsTenant,
  });
  const platform = useQuery({
    queryKey: queryKeys.platformRoutingNumbers,
    queryFn: listPlatformRoutingNumbers,
    enabled: ready,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.whatsappRouting });

  const saveCity = useMutation({
    mutationFn: (base: SaveNumberPayload) => saveCityNumber(target!.cityUuid, base),
    onSuccess: () => {
      setTarget(null);
      setNotice(t.saved);
      refresh();
    },
  });

  const delegation = useMutation({
    mutationFn: (vars: { cityUuid: string; delegate: boolean }) =>
      vars.delegate ? delegateCity(vars.cityUuid) : undelegateCity(vars.cityUuid),
    onSuccess: (_data, vars) => {
      setNotice(vars.delegate ? t.delegatedDone : t.undelegatedDone);
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (n: RoutingNumber) => deleteRoutingNumber(n.number_uuid),
    onSuccess: () => {
      setRemoval(null);
      setNotice(t.removed);
      refresh();
    },
  });

  const noticeLine = notice ? (
    <p role="status" className="text-sm text-emerald-700">
      {notice}
    </p>
  ) : null;

  const removalDialog = (
    <ConfirmDialog
      open={removal !== null}
      title={t.removeTitle}
      body={removal ? t.removeBody(removal.label) : ''}
      confirmLabel={t.remove}
      destructive
      pending={remove.isPending}
      error={remove.error}
      onConfirm={() => removal && remove.mutate(removal.number)}
      onClose={() => setRemoval(null)}
    />
  );

  const platformSection = platform.error ? (
    <ErrorState error={platform.error} onRetry={() => void platform.refetch()} />
  ) : platform.data ? (
    <PlatformSection
      rows={platform.data}
      isSuper={isSuper}
      formOpen={platformFormOpen}
      onOpenForm={() => setPlatformFormOpen(true)}
      onCloseForm={() => setPlatformFormOpen(false)}
      onRemove={(n) => setRemoval({ number: n, label: numberLabel(n) })}
      onSaved={setNotice}
    />
  ) : (
    <TableSkeleton rows={2} />
  );

  if (needsTenant) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
        <p className="text-sm text-slate-600">{t.intro}</p>
        <p className="text-sm text-slate-500">{t.pickTenant}</p>
        {noticeLine}
        {platformSection}
        {removalDialog}
      </div>
    );
  }

  if (cities.isPending || numbers.isPending || platform.isPending) {
    return <TableSkeleton rows={3} />;
  }
  const failed = cities.error ?? numbers.error ?? platform.error;
  if (failed) {
    return (
      <ErrorState
        error={failed}
        onRetry={() => {
          void cities.refetch();
          void numbers.refetch();
          void platform.refetch();
        }}
      />
    );
  }

  const cityRows = cities.data;
  const tenantNumbers = numbers.data;

  const cityColumns: Column<CityRouting>[] = [
    {
      id: 'city',
      header: t.city,
      sortValue: (c) => c.city_name,
      cell: (c) => <span className="font-medium text-slate-900">{c.city_name}</span>,
    },
    {
      id: 'own',
      header: t.ownNumber,
      cell: (c) => (c.own_city_number ? numberLabel(c.own_city_number) : '—'),
    },
    {
      id: 'delegated',
      header: t.delegated,
      cell: (c) => (c.delegated ? t.yes : t.no),
    },
    {
      id: 'serving',
      header: t.serving,
      secondary: true,
      cell: (c) => servingLabel(c.serving),
    },
    {
      id: 'actions',
      header: t.actions,
      cell: (c) => (
        <CityActions
          row={c}
          canWrite={cityWrite}
          busy={delegation.isPending || saveCity.isPending}
          onAssign={() =>
            setTarget({
              cityUuid: c.city_uuid,
              cityName: c.city_name,
              existing: c.own_city_number,
            })
          }
          onRemoveOwn={() =>
            c.own_city_number &&
            setRemoval({
              number: c.own_city_number,
              label: `${numberLabel(c.own_city_number)} (${c.city_name})`,
            })
          }
          onDelegate={() => delegation.mutate({ cityUuid: c.city_uuid, delegate: true })}
          onUndelegate={() => delegation.mutate({ cityUuid: c.city_uuid, delegate: false })}
        />
      ),
    },
  ];

  const canDeleteTenant = (n: RoutingNumber) => cityWrite && n.scope === 'TENANT';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
      <p className="text-sm text-slate-600">{t.intro}</p>

      <section aria-labelledby="cities-heading" className="space-y-2">
        <h2 id="cities-heading" className="text-sm font-semibold text-slate-900">
          {t.cities}
        </h2>
        {cityRows && cityRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t.noCities}</p>
        ) : (
          <DataTable
            rows={cityRows ?? []}
            columns={cityColumns}
            rowKey={(c) => c.city_uuid}
            caption={t.cities}
            initialSort={{ columnId: 'city', direction: 'asc' }}
          />
        )}
      </section>

      {delegation.error != null && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorText(delegation.error)}
        </p>
      )}

      {target && cityWrite && (
        <NumberForm
          title={`${target.existing ? t.replaceNumber : t.assignNumber} — ${target.cityName}`}
          initial={target.existing}
          pending={saveCity.isPending}
          error={saveCity.error}
          onCancel={() => setTarget(null)}
          onSubmit={(base) => saveCity.mutate(base)}
        />
      )}

      {cityRows && cityRows.length > 0 && <ServingPreview cities={cityRows} />}

      <section aria-labelledby="tenant-numbers-heading" className="space-y-2">
        <h2 id="tenant-numbers-heading" className="text-sm font-semibold text-slate-900">
          {t.tenantNumbers}
        </h2>
        <NumbersTable
          rows={tenantNumbers ?? []}
          caption={t.tenantNumbers}
          empty={t.noTenantNumbers}
          canDelete={canDeleteTenant}
          onDelete={(n) => setRemoval({ number: n, label: numberLabel(n) })}
        />
      </section>

      {noticeLine}

      {platformSection}

      {removalDialog}
    </div>
  );
}
