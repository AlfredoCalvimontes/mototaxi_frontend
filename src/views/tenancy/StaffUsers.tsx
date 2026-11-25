import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';

import { createStaffUser, listCities, listStaffUsers, updateStaffUser } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type {
  City,
  CreateStaffUserPayload,
  StaffUser,
  UpdateStaffUserPayload,
  UUID,
} from '@/api/types';
import { useAuth } from '@/auth/context';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, FormDialog, SelectField } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { ToneBadge } from '@/components/StatusBadge';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';
import { useTenantList } from '@/lib/useTenantList';

const t = strings.staffUsers;

type AssignableRole = 'TENANT_ADMIN' | 'CITY_ADMIN' | 'OPERATOR';

export default function StaffUsers() {
  const { user, actingAsTenant } = useAuth();
  const isSuper = user?.role === 'SUPERADMIN';
  // Without an empresa picked, a Super Admin sees every empresa's staff.
  const platformWide = isSuper && actingAsTenant === null;
  const [creating, setCreating] = useState(false);
  const tenants = useTenantList(platformWide);
  const staff = useQuery({ queryKey: queryKeys.staffUsers, queryFn: listStaffUsers });

  const nameOf = (id: UUID | null) =>
    id === null
      ? strings.waPage.ownerPlatform
      : (tenants.data?.items.find((x) => x.tenant_id === id)?.name ?? id);

  // A Super Admin edits any account but another Super Admin's. A tenant admin edits
  // only the city roles of its own empresa, never another tenant admin.
  const canManage = (u: StaffUser) =>
    isSuper
      ? u.role !== 'SUPERADMIN'
      : u.tenant_id === (user?.tenant_id ?? null) &&
        (u.role === 'CITY_ADMIN' || u.role === 'OPERATOR');
  const [editing, setEditing] = useState<StaffUser | null>(null);

  const columns: Column<StaffUser>[] = [
    {
      id: 'name',
      header: t.name,
      sortValue: (u) => u.name,
      cell: (u) => (
        <span className="font-medium text-slate-900">
          {u.name} {u.first_lastname} {u.second_lastname ?? ''}
        </span>
      ),
    },
    { id: 'email', header: t.email, secondary: true, cell: (u) => u.email ?? '—' },
    {
      id: 'role',
      header: t.role,
      sortValue: (u) => u.role,
      cell: (u) => t.roles[u.role],
    },
    ...(platformWide
      ? [
          {
            id: 'company',
            header: t.company,
            sortValue: (u: StaffUser) => nameOf(u.tenant_id),
            cell: (u: StaffUser) => nameOf(u.tenant_id),
          },
        ]
      : []),
    {
      id: 'cities',
      header: t.cities,
      cell: (u: StaffUser) => (u.role === 'TENANT_ADMIN' ? t.allCities : `${u.city_uuids.length}`),
    },
    {
      id: 'status',
      header: t.active,
      cell: (u) => (
        <ToneBadge tone={u.is_active ? 'good' : 'neutral'}>
          {u.is_active ? t.active : t.inactive}
        </ToneBadge>
      ),
    },
    {
      id: 'actions',
      header: t.actions,
      cell: (u) =>
        canManage(u) ? (
          <button
            type="button"
            onClick={() => setEditing(u)}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            {t.edit}
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t.newUser}
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600">{t.intro}</p>

      {editing && (
        <EditStaffForm
          key={editing.user_uuid}
          member={editing}
          isSuper={isSuper}
          selfId={user?.user_uuid ?? null}
          onClose={() => setEditing(null)}
        />
      )}

      {creating && (
        <NewStaffForm
          isSuper={isSuper}
          tenantId={actingAsTenant ?? user?.tenant_id ?? null}
          onClose={() => setCreating(false)}
        />
      )}

      {staff.isPending ? (
        <TableSkeleton rows={3} />
      ) : staff.isError ? (
        <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
      ) : (
        <DataTable
          rows={staff.data}
          columns={columns}
          rowKey={(u) => u.user_uuid}
          caption={t.heading}
          emptyMessage={t.empty}
          initialSort={{ columnId: 'name', direction: 'asc' }}
        />
      )}
    </div>
  );
}

function NewStaffForm({
  isSuper,
  tenantId,
  onClose,
}: {
  isSuper: boolean;
  tenantId: UUID | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const tenants = useTenantList(isSuper && tenantId === null);
  const [company, setCompany] = useState<UUID | ''>(tenantId ?? '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [firstLastname, setFirstLastname] = useState('');
  const [secondLastname, setSecondLastname] = useState('');
  const [role, setRole] = useState<AssignableRole>('OPERATOR');
  const [cityIds, setCityIds] = useState<UUID[]>([]);
  const [problems, setProblems] = useState<Record<string, string>>({});

  const targetTenant = tenantId ?? (company || null);
  const cities = useQuery({
    queryKey: ['cities', 'staff-form', targetTenant],
    queryFn: () => listCities(targetTenant as UUID, { page_size: 100 }),
    enabled: targetTenant !== null,
  });
  const activeCities: City[] = useMemo(
    () => (cities.data?.items ?? []).filter((c) => c.is_active),
    [cities.data],
  );

  const roleOptions: { value: AssignableRole; label: string }[] = [
    ...(isSuper ? [{ value: 'TENANT_ADMIN' as const, label: t.roles.TENANT_ADMIN }] : []),
    { value: 'CITY_ADMIN', label: t.roles.CITY_ADMIN },
    { value: 'OPERATOR', label: t.roles.OPERATOR },
  ];
  const cityRole = role !== 'TENANT_ADMIN';

  const save = useMutation({
    mutationFn: (payload: CreateStaffUserPayload) => createStaffUser(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = strings.fleet.requiredField;
    if (!name.trim()) next.name = strings.fleet.requiredField;
    if (!firstLastname.trim()) next.firstLastname = strings.fleet.requiredField;
    if (isSuper && !tenantId && !company) next.company = strings.fleet.requiredField;
    if (cityRole && cityIds.length === 0) next.cities = t.pickCities;
    setProblems(next);
    if (Object.keys(next).length > 0) return;
    save.mutate({
      email: email.trim(),
      name: name.trim(),
      first_lastname: firstLastname.trim(),
      second_lastname: secondLastname.trim() || null,
      role,
      tenant_id: isSuper && !tenantId ? (company as UUID) : null,
      city_uuids: cityRole ? cityIds : [],
    });
  }

  function toggleCity(id: UUID) {
    setCityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <FormDialog title={t.newUser} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {isSuper && !tenantId && (
          <SelectField
            label={t.pickCompany}
            value={company}
            onChange={(v) => {
              setCompany(v);
              setCityIds([]);
            }}
            options={(tenants.data?.items ?? []).map((x) => ({
              value: x.tenant_id,
              label: x.name,
            }))}
            required
            disabled={tenants.isPending}
          />
        )}
        <Field label={t.email} value={email} onChange={setEmail} required error={problems.email} />
        <Field label={t.name} value={name} onChange={setName} required error={problems.name} />
        <Field
          label={t.firstLastname}
          value={firstLastname}
          onChange={setFirstLastname}
          required
          error={problems.firstLastname}
        />
        <Field label={t.secondLastname} value={secondLastname} onChange={setSecondLastname} />
        <SelectField
          label={t.role}
          value={role}
          onChange={(v) => {
            setRole(v as AssignableRole);
            setCityIds([]);
          }}
          options={roleOptions}
          hint={cityRole ? t.cityRolesHint : t.tenantRoleHint}
          required
        />
        {cityRole && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">{t.pickCities}</legend>
            {targetTenant === null ? null : cities.isPending ? (
              <TableSkeleton rows={1} />
            ) : activeCities.length === 0 ? (
              <p className="text-sm text-slate-500">{t.noCities}</p>
            ) : (
              activeCities.map((c) => (
                <label key={c.city_id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={cityIds.includes(c.city_id)}
                    onChange={() => toggleCity(c.city_id)}
                  />
                  {c.name}
                </label>
              ))
            )}
            {problems.cities && <p className="text-sm text-red-700">{problems.cities}</p>}
          </fieldset>
        )}
        <p className="text-xs text-slate-500">{t.setupHint}</p>
        {save.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(save.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {strings.common.cancel}
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? strings.common.loading : strings.common.save}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}

/** The city checkboxes of a city role; shared by the create and edit forms. */
function CityChecklist({
  cities,
  picked,
  onToggle,
  legendError,
}: {
  cities: { isPending: boolean; data: { items: City[] } | undefined };
  picked: UUID[];
  onToggle: (id: UUID) => void;
  legendError?: string;
}) {
  const active = (cities.data?.items ?? []).filter((c) => c.is_active);
  if (cities.isPending) return <TableSkeleton rows={1} />;
  if (active.length === 0) return <p className="text-sm text-slate-500">{t.noCities}</p>;
  return (
    <div className="space-y-1">
      <label htmlFor="staff-cities" className="block text-sm font-medium text-slate-700">
        {t.pickCities}
      </label>
      <select
        id="staff-cities"
        multiple
        size={Math.min(active.length, 6)}
        value={picked}
        onChange={(e) => {
          const chosen = Array.from(e.target.selectedOptions, (o) => o.value as UUID);
          // Report each change as a toggle so the parent keeps one list of ids.
          for (const id of chosen) if (!picked.includes(id)) onToggle(id);
          for (const id of picked) if (!chosen.includes(id)) onToggle(id);
        }}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
      >
        {active.map((c) => (
          <option key={c.city_id} value={c.city_id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">{t.citiesMulti}</p>
      {legendError && <p className="text-sm text-red-700">{legendError}</p>}
    </div>
  );
}

function EditStaffForm({
  member,
  isSuper,
  selfId,
  onClose,
}: {
  member: StaffUser;
  isSuper: boolean;
  selfId: UUID | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isSelf = selfId === member.user_uuid;
  const [role, setRole] = useState<AssignableRole>(
    member.role === 'SUPERADMIN' ? 'OPERATOR' : (member.role as AssignableRole),
  );
  const [active, setActive] = useState(member.is_active);
  const [cityIds, setCityIds] = useState<UUID[]>(member.city_uuids);
  const [name, setName] = useState(member.name);
  const [firstLastname, setFirstLastname] = useState(member.first_lastname);
  const [secondLastname, setSecondLastname] = useState(member.second_lastname ?? '');
  const [email, setEmail] = useState(member.email ?? '');
  const [phone, setPhone] = useState(member.phone_number ?? '');
  const [problem, setProblem] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email' | 'phone', string>>>({});
  const cityRole = role !== 'TENANT_ADMIN';
  const cities = useQuery({
    queryKey: ['cities', 'staff-edit', member.tenant_id],
    queryFn: () => listCities(member.tenant_id as UUID, { page_size: 100 }),
    enabled: member.tenant_id !== null,
  });
  const roleOptions: { value: AssignableRole; label: string }[] = [
    ...(isSuper || member.role === 'TENANT_ADMIN'
      ? [{ value: 'TENANT_ADMIN' as const, label: t.roles.TENANT_ADMIN }]
      : []),
    { value: 'CITY_ADMIN', label: t.roles.CITY_ADMIN },
    { value: 'OPERATOR', label: t.roles.OPERATOR },
  ];

  const save = useMutation({
    mutationFn: (payload: UpdateStaffUserPayload) => updateStaffUser(member.user_uuid, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.staffUsers });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (cityRole && cityIds.length === 0) {
      setProblem(t.pickCities);
      return;
    }
    const errors: typeof fieldErrors = {};
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) errors.email = t.invalidEmail;
    const tel = phone.trim().replace(/[\s-]/g, '');
    if (tel !== '' && !/^\+[1-9]\d{6,14}$/.test(tel)) errors.phone = t.invalidPhone;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setProblem(undefined);
    const payload: UpdateStaffUserPayload = {
      is_active: active,
      city_uuids: cityRole ? cityIds : [],
    };
    if (member.role !== 'SUPERADMIN' && role !== member.role) payload.role = role;
    // Only changed personal data goes out.
    if (name.trim() !== member.name) payload.name = name.trim();
    if (firstLastname.trim() !== member.first_lastname)
      payload.first_lastname = firstLastname.trim();
    if ((secondLastname.trim() || null) !== member.second_lastname)
      payload.second_lastname = secondLastname.trim() || null;
    if (mail !== (member.email ?? '')) payload.email = mail;
    if (tel !== (member.phone_number ?? '')) payload.phone_number = tel;
    save.mutate(payload);
  }

  return (
    <FormDialog title={`${t.editTitle}: ${member.name} ${member.first_lastname}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <SelectField
          label={t.role}
          value={role}
          onChange={(v) => setRole(v as AssignableRole)}
          options={roleOptions}
          hint={cityRole ? t.cityRolesHint : t.tenantRoleHint}
          required
        />
        <Field label={t.name} value={name} onChange={setName} required />
        <Field label={t.firstLastname} value={firstLastname} onChange={setFirstLastname} required />
        <Field label={t.secondLastname} value={secondLastname} onChange={setSecondLastname} />
        <Field
          label={t.email}
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          required
        />
        <Field
          label={t.phone}
          value={phone}
          onChange={setPhone}
          hint={t.phoneHint}
          error={fieldErrors.phone}
        />
        {cityRole && (
          <CityChecklist
            cities={cities}
            picked={cityIds}
            onToggle={(id) =>
              setCityIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            legendError={problem}
          />
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={active}
            disabled={isSelf}
            onChange={(e) => setActive(e.target.checked)}
          />
          {t.active}
        </label>
        {isSelf && <p className="text-xs text-slate-500">{t.cannotEditSelf}</p>}
        {save.error != null && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {errorText(save.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {strings.common.cancel}
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {save.isPending ? strings.common.loading : strings.common.save}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
