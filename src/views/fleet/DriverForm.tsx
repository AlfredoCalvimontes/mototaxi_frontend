import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { createDriver, updateDriver } from '@/api/admin';
import type { Driver } from '@/api/types';
import { Field, FormDialog } from '@/components/Field';
import { driverChanges, hasChanges, type DriverFormValues } from '@/lib/dirty';
import { errorText } from '@/lib/errors';
import { strings } from '@/lib/strings';

function toValues(driver: Driver): DriverFormValues {
  return {
    name: driver.name,
    phone_whatsapp: driver.phone_whatsapp,
    license_number: driver.license_number ?? '',
  };
}

const emptyValues: DriverFormValues = { name: '', phone_whatsapp: '', license_number: '' };

export function DriverForm({ driver, onClose }: { driver: Driver | null; onClose: () => void }) {
  const editing = driver !== null;
  const initial = driver ? toValues(driver) : emptyValues;
  const queryClient = useQueryClient();

  const [values, setValues] = useState<DriverFormValues>(initial);
  // Registration only: the API refuses to edit a CI, since it is the identity
  // the driver was verified under in person.
  const [ci, setCi] = useState('');
  const [validation, setValidation] = useState<Partial<Record<string, string>>>({});

  const { payload, unclearable } = driverChanges(initial, values);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return updateDriver(driver.driver_uuid, payload);
      return createDriver({
        name: values.name.trim(),
        ci: ci.trim(),
        phone_whatsapp: values.phone_whatsapp.trim(),
        license_number: values.license_number.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      void queryClient.invalidateQueries({ queryKey: ['driver'] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!values.name.trim()) errors.name = strings.fleet.requiredField;
    if (!values.phone_whatsapp.trim()) errors.phone = strings.fleet.requiredField;
    if (!editing && !ci.trim()) errors.ci = strings.fleet.requiredField;
    setValidation(errors);
    if (Object.keys(errors).length > 0) return;
    if (editing && !hasChanges(payload)) {
      onClose();
      return;
    }
    save.mutate();
  }

  return (
    <FormDialog
      title={editing ? strings.fleet.editDriver : strings.fleet.newDriver}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field
          label={strings.drivers.name}
          value={values.name}
          onChange={(name) => setValues((v) => ({ ...v, name }))}
          required
          error={validation.name}
        />

        {editing ? (
          <p className="text-xs text-slate-500">
            {strings.drivers.ci}: {driver.ci} — {strings.fleet.ciNotEditable}
          </p>
        ) : (
          <Field
            label={strings.drivers.ci}
            value={ci}
            onChange={setCi}
            required
            error={validation.ci}
          />
        )}

        <Field
          label={strings.drivers.phone}
          type="tel"
          value={values.phone_whatsapp}
          onChange={(phone_whatsapp) => setValues((v) => ({ ...v, phone_whatsapp }))}
          required
          placeholder="+591 7XXXXXXX"
          hint={strings.fleet.phoneHint}
          error={validation.phone}
        />

        <Field
          label={strings.drivers.license}
          value={values.license_number}
          onChange={(license_number) => setValues((v) => ({ ...v, license_number }))}
        />

        {editing && unclearable.length > 0 && (
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
