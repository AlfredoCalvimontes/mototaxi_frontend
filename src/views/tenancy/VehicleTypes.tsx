import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { createVehicleType, listVehicleTypes, listVehicles, updateVehicleType } from '@/api/admin';
import { queryKeys } from '@/api/queries';
import type { AttributeSchemaField, AttributeType, VehicleType } from '@/api/types';
import { useAuth } from '@/auth/context';
import { DataTable, type Column } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { Field, FormDialog, SelectField } from '@/components/Field';
import { TableSkeleton } from '@/components/Skeleton';
import { ToneBadge } from '@/components/StatusBadge';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.vehicleTypes;

const TYPE_OPTIONS = (Object.keys(t.types) as AttributeType[]).map((value) => ({
  value,
  label: t.types[value],
}));

function SchemaEditor({
  rows,
  onChange,
}: {
  rows: AttributeSchemaField[];
  onChange: (rows: AttributeSchemaField[]) => void;
}) {
  function patch(index: number, change: Partial<AttributeSchemaField>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }
  return (
    <fieldset className="space-y-3 rounded border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-700">{t.attributes}</legend>
      <p className="text-xs text-slate-500">{t.attributesHint}</p>
      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded border border-slate-100 p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              label={t.attributeKey}
              value={row.key}
              onChange={(key) => patch(index, { key })}
            />
            <Field
              label={t.attributeLabel}
              value={row.label}
              onChange={(label) => patch(index, { label })}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <SelectField
              label={t.attributeType}
              value={row.type}
              options={TYPE_OPTIONS}
              onChange={(type) => patch(index, { type: type as AttributeType })}
            />
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={row.required}
                onChange={(e) => patch(index, { required: e.target.checked })}
              />
              {t.attributeRequired}
            </label>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className="pb-2 text-sm text-red-700 underline"
            >
              {t.removeAttribute}
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { key: '', type: 'string', required: false, label: '' }])}
        className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
      >
        {t.addAttribute}
      </button>
    </fieldset>
  );
}

function TypeForm({ type, onClose }: { type: VehicleType | null; onClose: () => void }) {
  const { user, actingAsTenant } = useAuth();
  const queryClient = useQueryClient();
  const editing = type !== null;
  const isSuper = user?.role === 'SUPERADMIN';
  // A superadmin who is not acting as a tenant has no tenant to own a type.
  const mustBeGlobal = isSuper && !actingAsTenant;

  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState(type?.display_name ?? '');
  const [isGlobal, setIsGlobal] = useState(mustBeGlobal);
  const [rows, setRows] = useState<AttributeSchemaField[]>(type?.attribute_schema ?? []);
  const [problem, setProblem] = useState<string | null>(null);

  // The schema is additive-only once vehicles use the type, so warn only then.
  const vehicles = useQuery({
    queryKey: queryKeys.vehiclesIn(null),
    queryFn: () => listVehicles(),
    enabled: editing,
  });
  const inUse = editing
    ? (vehicles.data ?? []).filter((v) => v.vehicle_type_uuid === type.vehicle_type_uuid).length
    : 0;

  const save = useMutation({
    mutationFn: () => {
      const schema = rows.map((r) => ({
        ...r,
        key: r.key.trim(),
        label: r.label.trim() || r.key.trim(),
      }));
      if (editing) {
        return updateVehicleType(type.vehicle_type_uuid, {
          display_name: displayName.trim(),
          attribute_schema: schema,
        });
      }
      return createVehicleType({
        code: code.trim(),
        display_name: displayName.trim(),
        attribute_schema: schema,
        ...(isSuper && isGlobal ? { is_global: true } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleTypes });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim() || (!editing && code.trim().length < 2)) {
      setProblem(strings.fleet.requiredField);
      return;
    }
    if (rows.some((r) => !r.key.trim())) {
      setProblem(strings.fleet.requiredField);
      return;
    }
    setProblem(null);
    save.mutate();
  }

  return (
    <FormDialog title={editing ? t.editType : t.newType} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!editing && (
          <Field label={t.code} value={code} onChange={setCode} hint={t.codeHint} required />
        )}
        <Field label={t.displayName} value={displayName} onChange={setDisplayName} required />
        {!editing && isSuper && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isGlobal}
              disabled={mustBeGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
            />
            {t.makeGlobal}
          </label>
        )}
        <SchemaEditor rows={rows} onChange={setRows} />
        {inUse > 0 && <p className="text-xs text-amber-700">{t.schemaWarning(inUse)}</p>}
        {(problem || save.error != null) && (
          <p
            role="alert"
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {problem ?? errorText(save.error)}
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

export default function VehicleTypes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ type: VehicleType | null } | null>(null);
  const types = useQuery({ queryKey: queryKeys.vehicleTypes, queryFn: () => listVehicleTypes() });

  const toggle = useMutation({
    mutationFn: (type: VehicleType) =>
      updateVehicleType(type.vehicle_type_uuid, { is_active: !type.is_active }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleTypes }),
  });

  if (types.isPending) return <TableSkeleton rows={3} />;
  if (types.isError) return <ErrorState error={types.error} onRetry={() => void types.refetch()} />;

  /** Global types are the platform's; a tenant admin sees them but cannot touch them. */
  const canEdit = (type: VehicleType) => !type.is_global || user?.role === 'SUPERADMIN';

  const columns: Column<VehicleType>[] = [
    {
      id: 'name',
      header: t.displayName,
      sortValue: (x) => x.display_name,
      cell: (x) => (
        <span className="font-medium text-slate-900">
          {!canEdit(x) && (
            <span role="img" aria-label={t.globalLocked} title={t.globalLocked}>
              🔒{' '}
            </span>
          )}
          {x.display_name}
        </span>
      ),
    },
    { id: 'code', header: t.code, sortValue: (x) => x.code, cell: (x) => x.code },
    {
      id: 'scope',
      header: t.scope,
      sortValue: (x) => (x.is_global ? 0 : 1),
      cell: (x) => (
        <ToneBadge tone={x.is_global ? 'neutral' : 'good'}>
          {x.is_global ? t.global : t.own}
        </ToneBadge>
      ),
    },
    {
      id: 'attributes',
      header: t.attributes,
      secondary: true,
      cell: (x) => x.attribute_schema.map((a) => a.label).join(', ') || '—',
    },
    {
      id: 'status',
      header: t.status,
      sortValue: (x) => (x.is_active ? 0 : 1),
      cell: (x) => (
        <ToneBadge tone={x.is_active ? 'good' : 'neutral'}>
          {x.is_active ? t.active : t.inactive}
        </ToneBadge>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (x) =>
        canEdit(x) && (
          <div className="flex justify-end gap-3 text-sm">
            <button type="button" className="underline" onClick={() => setDialog({ type: x })}>
              {strings.common.edit}
            </button>
            <button
              type="button"
              className="underline"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(x)}
            >
              {x.is_active ? t.deactivate : t.activate}
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">{t.heading}</h1>
        <button
          type="button"
          onClick={() => setDialog({ type: null })}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t.newType}
        </button>
      </div>
      <p className="text-sm text-slate-600">{t.intro}</p>
      {toggle.error != null && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorText(toggle.error)}
        </p>
      )}
      <DataTable
        rows={types.data}
        columns={columns}
        rowKey={(x) => x.vehicle_type_uuid}
        caption={t.heading}
        emptyMessage={t.empty}
      />
      {dialog && <TypeForm type={dialog.type} onClose={() => setDialog(null)} />}
    </div>
  );
}
