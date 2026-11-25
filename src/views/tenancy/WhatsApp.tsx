import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import {
  assignNumberCity,
  createRoutingNumber,
  delegateCity,
  deleteRoutingNumber,
  listAllCities,
  listCityRouting,
  listPlatformRoutingNumbers,
  listRoutingNumbers,
  previewCityServing,
  savePlatformNumber,
  setNumberActive,
  undelegateCity,
  type CreateNumberPayload,
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
import { Field, FormDialog, SelectField } from '@/components/Field';
import { FilterBar, SelectFilter } from '@/components/Filters';
import { TableSkeleton } from '@/components/Skeleton';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';
import { useIsMainBusiness } from '@/lib/useActingTenant';
import { useActingTenantName } from '@/lib/useActingTenantName';
import { useTenantList } from '@/lib/useTenantList';

const t = strings.waPage;
const r = strings.routing;

/** The reason a city is refused, in the owner's words. */
function denyText(reason: DenyReason): string {
  if (reason === 'not_operating') return r.denyNotOperating;
  if (reason === 'no_coverage') return r.denyNoCoverage;
  return r.denyNumberUnavailable;
}

function numberLabel(n: RoutingNumber): string {
  return n.display_phone_number ?? n.phone_number_id;
}

/** Who answers a city, in the words the operator needs: own, main, or platform. */
function originOf(serving: Serving): string {
  const n = serving.number;
  if (!n) return serving.deny_reason ? denyText(serving.deny_reason) : t.origin.none;
  if (n.scope === 'PLATFORM') return t.origin.platform;
  return n.role === 'CITY' ? t.origin.own : t.origin.main;
}

/** Number form. The token is required on every save: the backend keeps none for an update. */
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
    if (!token.trim()) next.token = r.tokenHint;
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
        label={r.phoneNumberId}
        value={phoneNumberId}
        onChange={setPhoneNumberId}
        required
        error={errors.phone}
      />
      <Field
        label={r.accessToken}
        type="password"
        value={token}
        onChange={setToken}
        required
        hint={r.tokenHint}
        error={errors.token}
      />
      <Field label={r.waba} value={waba} onChange={setWaba} />
      <Field label={r.displayNumber} value={display} onChange={setDisplay} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {r.isActive}
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
          {r.cancel}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? strings.common.loading : r.save}
        </button>
      </div>
    </form>
  );
}

/** A new number for the company: its MAIN (only while it has none) or a spare. */
function CompanyNumberForm({
  hasMain,
  onDone,
  onSaved,
}: {
  hasMain: boolean;
  onDone: () => void;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<RoutingRole>(hasMain ? 'CITY' : 'MAIN');
  const save = useMutation({
    mutationFn: (base: SaveNumberPayload) =>
      createRoutingNumber({ ...base, role } as CreateNumberPayload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatsappRouting });
      onSaved(t.saved);
      onDone();
    },
  });
  return (
    <NumberForm
      title={t.newNumber}
      initial={null}
      pending={save.isPending}
      error={save.error}
      onCancel={onDone}
      onSubmit={(base) => save.mutate(base)}
    >
      <SelectField
        label={t.kind}
        value={role}
        onChange={(v) => setRole(v as RoutingRole)}
        options={[
          ...(hasMain ? [] : [{ value: 'MAIN', label: t.kindMain }]),
          { value: 'CITY', label: t.kindSpare },
        ]}
        hint={hasMain ? t.mainTaken : undefined}
      />
    </NumberForm>
  );
}

/** Platform numbers the Super Admin sets: the main one, or a city's. */
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
      savePlatformNumber({ ...base, role, city_uuid: role === 'CITY' ? cityUuid : null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatsappRouting });
      onSaved(t.saved);
      onDone();
    },
  });
  return (
    <NumberForm
      title={t.addPlatform}
      initial={null}
      pending={save.isPending}
      error={save.error}
      onCancel={onDone}
      onSubmit={(base) => {
        if (role === 'CITY' && !cityUuid) {
          setCityError(r.pickCity);
          return;
        }
        setCityError(undefined);
        save.mutate(base);
      }}
    >
      <SelectField
        label={r.role}
        value={role}
        onChange={(v) => setRole(v as RoutingRole)}
        options={[
          { value: 'MAIN', label: r.roleMain },
          { value: 'CITY', label: r.roleCity },
        ]}
      />
      {role === 'CITY' && (
        <div className="space-y-1">
          <SelectField
            label={r.cityOptional}
            value={cityUuid}
            onChange={setCityUuid}
            options={(catalog.data?.items ?? []).map((c) => ({ value: c.city_id, label: c.name }))}
            required
          />
          {cityError && <p className="text-sm text-red-700">{cityError}</p>}
        </div>
      )}
    </NumberForm>
  );
}

/** Pick one of the company's numbers for a city. The city's previous number becomes spare. */
function AssignDialog({
  city,
  candidates,
  cityNameOf,
  onDone,
  onAssigned,
}: {
  city: CityRouting;
  candidates: RoutingNumber[];
  cityNameOf: (cityUuid: string) => string;
  onDone: () => void;
  onAssigned: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [numberUuid, setNumberUuid] = useState('');
  const assign = useMutation({
    mutationFn: () => assignNumberCity(numberUuid, city.city_uuid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.whatsappRouting });
      onAssigned(t.assigned);
      onDone();
    },
  });
  const options = candidates
    .filter((n) => n.number_uuid !== city.own_city_number?.number_uuid)
    .map((n) => ({
      value: n.number_uuid,
      label: `${numberLabel(n)} — ${n.city_uuid ? cityNameOf(n.city_uuid) : t.spare}`,
    }));
  return (
    <FormDialog title={t.assignTitle(city.city_name)} onClose={onDone}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (numberUuid) assign.mutate();
        }}
      >
        <p className="text-sm text-slate-600">{t.assignHint}</p>
        {options.length === 0 ? (
          <p className="text-sm text-slate-600">{t.assignNone}</p>
        ) : (
          <SelectField
            label={t.assignSave}
            value={numberUuid}
            onChange={setNumberUuid}
            options={[{ value: '', label: r.pickCity }, ...options]}
            required
          />
        )}
        {assign.error != null && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(assign.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {r.cancel}
          </button>
          <button
            type="submit"
            disabled={!numberUuid || assign.isPending}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {t.assignSave}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

/** "¿Quién atiende una ciudad?" — optional, collapsed; the resolver's answer for one city. */
function ServingPreview({ cities }: { cities: { city_uuid: string; city_name: string }[] }) {
  const [cityUuid, setCityUuid] = useState('');
  const preview = useQuery({
    queryKey: ['whatsapp-routing', 'serving', cityUuid],
    queryFn: () => previewCityServing(cityUuid),
    enabled: cityUuid !== '',
  });
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">{t.whoServesHint}</p>
      <SelectField
        label={r.city}
        value={cityUuid}
        onChange={setCityUuid}
        options={[
          { value: '', label: r.previewPick },
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
          {preview.data.number
            ? `${numberLabel(preview.data.number)} · ${originOf(preview.data)}`
            : originOf(preview.data)}
        </p>
      )}
    </div>
  );
}

export default function WhatsApp() {
  const { user, actingAsTenant } = useAuth();
  const queryClient = useQueryClient();
  const isSuper = user?.role === 'SUPERADMIN';
  const platformWide = isSuper && !actingAsTenant;
  // A company (its own admin, or a superadmin acting as it) manages its own numbers.
  const businessWrite = !platformWide && !!user;
  const ownName = useActingTenantName();
  // The main business manages the platform's numbers too, with the super admin.
  const isMain = useIsMainBusiness();
  const tenants = useTenantList(platformWide);

  const numbers = useQuery({
    queryKey: queryKeys.routingNumbers(actingAsTenant),
    queryFn: listRoutingNumbers,
    enabled: !!user,
  });
  const platform = useQuery({
    queryKey: queryKeys.platformRoutingNumbers,
    queryFn: listPlatformRoutingNumbers,
    enabled: !!user,
  });
  const cities = useQuery({
    queryKey: queryKeys.cityRouting(actingAsTenant),
    queryFn: listCityRouting,
    enabled: !!user,
  });

  const [tenantFilter, setTenantFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState<'company' | 'platform' | null>(null);
  const [assigning, setAssigning] = useState<CityRouting | null>(null);
  const [removal, setRemoval] = useState<RoutingNumber | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.whatsappRouting });

  const toggle = useMutation({
    mutationFn: (n: RoutingNumber) => setNumberActive(n.number_uuid, !n.is_active),
    onSuccess: () => {
      setNotice(t.saved);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (n: RoutingNumber) => deleteRoutingNumber(n.number_uuid),
    onSuccess: () => {
      setRemoval(null);
      setNotice(r.removed);
      refresh();
    },
  });
  const unassign = useMutation({
    mutationFn: (cityRow: CityRouting) =>
      assignNumberCity(cityRow.own_city_number!.number_uuid, null),
    onSuccess: () => {
      setNotice(t.unassigned);
      refresh();
    },
  });
  const delegation = useMutation({
    mutationFn: (vars: { cityUuid: string; delegate: boolean }) =>
      vars.delegate ? delegateCity(vars.cityUuid) : undelegateCity(vars.cityUuid),
    onSuccess: (_d, vars) => {
      setNotice(vars.delegate ? r.delegatedDone : r.undelegatedDone);
      refresh();
    },
  });

  const tenantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const x of tenants.data?.items ?? []) map.set(x.tenant_id, x.name);
    for (const c of cities.data ?? []) {
      if (c.tenant_uuid && c.tenant_name) map.set(c.tenant_uuid, c.tenant_name);
    }
    return map;
  }, [tenants.data, cities.data]);
  const nameOf = (id: string | null | undefined): string => {
    if (!id) return t.ownerPlatform;
    if (user?.tenant_id === id || actingAsTenant === id) return ownName ?? t.empresa;
    return tenantNames.get(id) ?? t.empresa;
  };

  const allNumbers = useMemo(() => {
    const byId = new Map<string, RoutingNumber>();
    for (const n of [...(numbers.data ?? []), ...(platform.data ?? [])]) byId.set(n.number_uuid, n);
    return [...byId.values()];
  }, [numbers.data, platform.data]);

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cities.data ?? []) map.set(c.city_uuid, c.city_name);
    return [...map]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cities.data]);

  const tenantOptions = useMemo(
    () =>
      [...tenantNames]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [tenantNames],
  );

  const cityRows = (cities.data ?? []).filter(
    (c) =>
      (!tenantFilter || c.tenant_uuid === tenantFilter) &&
      (!cityFilter || c.city_uuid === cityFilter),
  );

  const numberRows = allNumbers.filter(
    (n) =>
      (!tenantFilter ||
        (tenantFilter === 'platform' ? n.scope === 'PLATFORM' : n.owner_tenant === tenantFilter)) &&
      (!cityFilter || n.city_uuid === cityFilter) &&
      (!statusFilter || n.is_active === (statusFilter === 'on')),
  );

  const hasMain = (numbers.data ?? []).some((n) => n.role === 'MAIN' && n.is_active);
  const cityNameById = new Map((cities.data ?? []).map((c) => [c.city_uuid, c.city_name]));

  /** Numbers of the empresa a city belongs to, that could be put on that city. */
  function candidatesFor(row: CityRouting): RoutingNumber[] {
    const owner = row.tenant_uuid ?? null;
    return allNumbers.filter(
      (n) =>
        n.scope === 'TENANT' && n.role === 'CITY' && (owner === null || n.owner_tenant === owner),
    );
  }

  function canManage(n: RoutingNumber): boolean {
    if (n.scope === 'PLATFORM') return platformWide || isMain;
    return platformWide || businessWrite;
  }

  if (numbers.isPending || cities.isPending || platform.isPending)
    return <TableSkeleton rows={4} />;
  const failed = numbers.error ?? cities.error ?? platform.error;
  if (failed) {
    return (
      <ErrorState
        error={failed}
        onRetry={() => {
          void numbers.refetch();
          void cities.refetch();
          void platform.refetch();
        }}
      />
    );
  }

  const cityColumns: Column<CityRouting>[] = [
    {
      id: 'city',
      header: t.city,
      sortValue: (c) => c.city_name,
      cell: (c) => <span className="font-medium text-slate-900">{c.city_name}</span>,
    },
    ...(platformWide
      ? [
          {
            id: 'empresa',
            header: t.empresa,
            secondary: true,
            sortValue: (c: CityRouting) => nameOf(c.tenant_uuid),
            cell: (c: CityRouting) => nameOf(c.tenant_uuid),
          },
        ]
      : []),
    {
      id: 'own',
      header: r.ownNumber,
      cell: (c) => (c.own_city_number ? numberLabel(c.own_city_number) : '—'),
    },
    {
      id: 'serves',
      header: t.serves,
      cell: (c) => (
        <span>
          {c.serving.number ? numberLabel(c.serving.number) : t.origin.none}
          <span className="block text-xs text-slate-500">{originOf(c.serving)}</span>
        </span>
      ),
    },
    {
      id: 'delegated',
      header: r.delegated,
      secondary: true,
      cell: (c) => (c.delegated ? t.delegatedYes : t.delegatedNo),
    },
    {
      id: 'actions',
      header: t.actions,
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setAssigning(c)}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            {c.own_city_number ? t.change : t.assign}
          </button>
          {c.own_city_number && (
            <button
              type="button"
              onClick={() => unassign.mutate(c)}
              disabled={unassign.isPending}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {t.unassign}
            </button>
          )}
          {!platformWide &&
            (c.delegated ? (
              <button
                type="button"
                onClick={() => delegation.mutate({ cityUuid: c.city_uuid, delegate: false })}
                disabled={delegation.isPending}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {r.undelegate}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => delegation.mutate({ cityUuid: c.city_uuid, delegate: true })}
                disabled={delegation.isPending || c.own_city_number !== null}
                title={c.own_city_number ? r.delegateHint : undefined}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {r.delegate}
              </button>
            ))}
        </div>
      ),
    },
  ];

  const numberColumns: Column<RoutingNumber>[] = [
    {
      id: 'owner',
      header: t.owner,
      sortValue: (n) => nameOf(n.owner_tenant),
      cell: (n) => (
        <span className="font-medium text-slate-900">
          {n.scope === 'PLATFORM' ? t.ownerPlatform : nameOf(n.owner_tenant)}
        </span>
      ),
    },
    {
      id: 'kind',
      header: t.kind,
      cell: (n) =>
        n.role === 'MAIN'
          ? t.mainLabel
          : n.city_uuid
            ? (cityNameById.get(n.city_uuid) ?? r.roleCity)
            : t.spare,
    },
    {
      id: 'number',
      header: r.displayNumber,
      sortValue: (n) => numberLabel(n),
      cell: (n) => numberLabel(n),
    },
    { id: 'phone', header: r.phoneNumberId, secondary: true, cell: (n) => n.phone_number_id },
    { id: 'waba', header: r.waba, secondary: true, cell: (n) => n.waba_id ?? '—' },
    {
      id: 'status',
      header: t.status,
      cell: (n) =>
        canManage(n) ? (
          <button
            type="button"
            onClick={() => toggle.mutate(n)}
            disabled={toggle.isPending}
            className={`rounded border px-2 py-1 text-xs font-medium whitespace-nowrap disabled:opacity-50 ${
              n.is_active
                ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {n.is_active ? `${t.active} · ${t.switchOff}` : `${t.inactive} · ${t.switchOn}`}
          </button>
        ) : (
          <span className={n.is_active ? 'text-emerald-700' : 'text-slate-500'}>
            {n.is_active ? t.active : t.inactive}
          </span>
        ),
    },
    {
      id: 'actions',
      header: t.actions,
      cell: (n) =>
        canManage(n) ? (
          <button
            type="button"
            onClick={() => setRemoval(n)}
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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
      <p className="text-sm text-slate-600">{platformWide ? t.introPlatform : t.intro}</p>

      <FilterBar
        active={!!(tenantFilter || cityFilter || statusFilter)}
        onClear={() => {
          setTenantFilter('');
          setCityFilter('');
          setStatusFilter('');
        }}
      >
        {platformWide && (
          <SelectFilter
            label={t.filters.tenant}
            value={tenantFilter}
            onChange={(v) => {
              setTenantFilter(v);
              setCityFilter('');
            }}
            allLabel={strings.platform.allTenants}
            options={[{ value: 'platform', label: t.ownerPlatform }, ...tenantOptions]}
          />
        )}
        <SelectFilter
          label={t.filters.city}
          value={cityFilter}
          onChange={setCityFilter}
          allLabel={strings.filters.allCities}
          options={cityOptions}
        />
        <SelectFilter
          label={t.filters.status}
          value={statusFilter}
          onChange={setStatusFilter}
          allLabel={strings.filters.allStatuses}
          options={[
            { value: 'on', label: t.active },
            { value: 'off', label: t.inactive },
          ]}
        />
      </FilterBar>

      {!platformWide && (
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            {t.whoServes}
          </summary>
          <div className="mt-3 max-w-md">
            <ServingPreview cities={cityRows} />
          </div>
        </details>
      )}

      <section aria-labelledby="wa-cities-heading" className="space-y-2">
        <h2 id="wa-cities-heading" className="text-sm font-semibold text-slate-900">
          {t.citiesHeading}
        </h2>
        {cityRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t.citiesEmpty}</p>
        ) : (
          <DataTable
            rows={cityRows}
            columns={cityColumns}
            rowKey={(c) => `${c.tenant_uuid ?? 'mine'}:${c.city_uuid}`}
            caption={t.citiesHeading}
            initialSort={{ columnId: 'city', direction: 'asc' }}
          />
        )}
        {delegation.error != null && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(delegation.error)}
          </p>
        )}
        {unassign.error != null && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(unassign.error)}
          </p>
        )}
      </section>

      <section aria-labelledby="wa-numbers-heading" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="wa-numbers-heading" className="text-sm font-semibold text-slate-900">
            {t.numbersHeading}
          </h2>
          {businessWrite && formOpen !== 'company' && (
            <button
              type="button"
              onClick={() => setFormOpen('company')}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t.newNumber}
            </button>
          )}
          {(platformWide || isMain) && formOpen !== 'platform' && (
            <button
              type="button"
              onClick={() => setFormOpen('platform')}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t.addPlatform}
            </button>
          )}
        </div>

        {formOpen === 'company' && (
          <CompanyNumberForm
            hasMain={hasMain}
            onDone={() => setFormOpen(null)}
            onSaved={setNotice}
          />
        )}
        {formOpen === 'platform' && (
          <PlatformNumberForm onDone={() => setFormOpen(null)} onSaved={setNotice} />
        )}

        {numberRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t.numbersEmpty}</p>
        ) : (
          <DataTable
            rows={numberRows}
            columns={numberColumns}
            rowKey={(n) => n.number_uuid}
            caption={t.numbersHeading}
            initialSort={{ columnId: 'owner', direction: 'asc' }}
          />
        )}
      </section>

      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {toggle.error != null && (
        <p role="alert" className="text-sm text-red-700">
          {errorText(toggle.error)}
        </p>
      )}

      {assigning && (
        <AssignDialog
          city={assigning}
          candidates={candidatesFor(assigning)}
          cityNameOf={(id) => cityNameById.get(id) ?? r.roleCity}
          onDone={() => setAssigning(null)}
          onAssigned={setNotice}
        />
      )}

      <ConfirmDialog
        open={removal !== null}
        title={t.removeTitle}
        body={removal ? t.removeBody(numberLabel(removal)) : ''}
        confirmLabel={t.remove}
        destructive
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => removal && remove.mutate(removal)}
        onClose={() => setRemoval(null)}
      />
    </div>
  );
}
