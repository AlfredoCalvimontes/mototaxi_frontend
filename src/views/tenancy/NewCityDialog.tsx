import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { createCity } from '@/api/admin';
import { Field, FormDialog, SelectField } from '@/components/Field';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

const t = strings.tenancy;

/**
 * Create a city for an empresa. Acting as one, the empresa is that one; the
 * platform-wide view passes `tenants` and the city goes to the one picked.
 */
export function NewCityDialog({
  tenantId,
  tenants,
  onClose,
}: {
  tenantId?: string;
  tenants?: { tenant_id: string; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [owner, setOwner] = useState(tenantId ?? '');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/La_Paz');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => createCity(owner, { name: name.trim(), timezone: timezone.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cities'] });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!owner) next.owner = strings.fleet.requiredField;
    if (!name.trim()) next.name = strings.fleet.requiredField;
    if (!timezone.trim()) next.timezone = strings.fleet.requiredField;
    setErrors(next);
    if (Object.keys(next).length === 0) create.mutate();
  }

  return (
    <FormDialog title={t.newCity} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!tenantId && tenants && (
          <SelectField
            label={t.allCitiesTenant}
            value={owner}
            onChange={setOwner}
            options={[
              { value: '', label: t.pickTenant },
              ...tenants.map((x) => ({ value: x.tenant_id, label: x.name })),
            ]}
            required
          />
        )}
        {errors.owner && <p className="text-sm text-red-700">{errors.owner}</p>}
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
